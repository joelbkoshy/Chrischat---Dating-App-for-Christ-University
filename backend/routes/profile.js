const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Report = require('../models/Report');

const router = express.Router();

// Use Cloudinary in production, local disk in development
const useCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);
let upload;

if (useCloudinary) {
  const { profileUpload } = require('../config/cloudinary');
  upload = profileUpload;
} else {
  // Local disk fallback for development
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${req.user._id}-${Date.now()}${ext}`);
    },
  });

  upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.avi', '.mkv'];
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, allowed.includes(ext));
    },
    limits: { fileSize: 50 * 1024 * 1024 },
  });
}

// Get own profile
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile
router.put(
  '/',
  auth,
  [
    body('bio').optional().isLength({ max: 300 }),
    body('age').optional().isInt({ min: 18, max: 30 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const allowedFields = [
        'name', 'bio', 'age', 'gender', 'interestedIn',
        'interests', 'year', 'campus', 'photos', 'profilePrompts',
        'mode', 'studySubjects', 'isVisible',
      ];

      const updates = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      // Check if profile is complete
      const user = await User.findById(req.user._id);
      const merged = { ...user.toObject(), ...updates };
      if (merged.age && merged.gender && merged.bio && merged.year) {
        updates.isProfileComplete = true;
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      // Badge: Profile Pro (completed profile with bio > 50 chars, 3+ interests, prompts)
      if (
        updatedUser.isProfileComplete &&
        updatedUser.bio.length > 50 &&
        updatedUser.interests.length >= 3 &&
        !updatedUser.badges.find((b) => b.name === 'Profile Pro')
      ) {
        updatedUser.badges.push({ name: 'Profile Pro' });
        await updatedUser.save();
      }

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Upload photos
router.post('/photos', auth, upload.array('photos', 6), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const user = await User.findById(req.user._id);
    // Cloudinary returns .path with full URL; local returns .filename
    const newPhotos = req.files.map((f) => f.path || `/uploads/${f.filename}`);

    // Max 6 photos total
    const totalPhotos = [...user.photos, ...newPhotos].slice(0, 6);
    user.photos = totalPhotos;
    await user.save();

    res.json({ photos: user.photos });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a photo
router.delete('/photos/:index', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const index = parseInt(req.params.index);

    if (index < 0 || index >= user.photos.length) {
      return res.status(400).json({ message: 'Invalid photo index' });
    }

    const photo = user.photos[index];
    // Delete from Cloudinary if it's a URL, otherwise delete local file
    if (photo.startsWith('http') && useCloudinary) {
      const { cloudinary } = require('../config/cloudinary');
      // Extract public_id from Cloudinary URL
      const parts = photo.split('/');
      const folderAndFile = parts.slice(parts.indexOf('chrischat')).join('/');
      const publicId = folderAndFile.replace(/\.[^/.]+$/, '');
      await cloudinary.uploader.destroy(publicId).catch(() => {});
    } else {
      const photoPath = path.join(__dirname, '..', photo);
      if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
    }

    user.photos.splice(index, 1);
    await user.save();

    res.json({ photos: user.photos });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle visibility
router.post('/visibility', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.isVisible = !user.isVisible;
    await user.save();
    res.json({ isVisible: user.isVisible });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get badges
router.get('/badges', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json(user.badges);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Block a user
router.post('/block/:id', auth, async (req, res) => {
  try {
    const targetId = req.params.id;

    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { blockedUsers: targetId },
    });

    await User.findByIdAndUpdate(targetId, {
      $addToSet: { blockedBy: req.user._id },
    });

    // Deactivate any match between them
    const Match = require('../models/Match');
    await Match.updateMany(
      { users: { $all: [req.user._id, targetId] } },
      { isActive: false }
    );

    res.json({ blocked: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Unblock a user
router.post('/unblock/:id', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { blockedUsers: req.params.id },
    });

    await User.findByIdAndUpdate(req.params.id, {
      $pull: { blockedBy: req.user._id },
    });

    res.json({ unblocked: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Report a user
router.post(
  '/report/:id',
  auth,
  [
    body('reason').isIn(['inappropriate', 'harassment', 'spam', 'fake_profile', 'underage', 'other']),
    body('description').optional().isLength({ max: 500 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const targetId = req.params.id;
      if (targetId === req.user._id.toString()) {
        return res.status(400).json({ message: 'Cannot report yourself' });
      }

      // Check duplicate
      const existing = await Report.findOne({
        reporter: req.user._id,
        reportedUser: targetId,
      });
      if (existing) {
        return res.status(400).json({ message: 'Already reported this user' });
      }

      await Report.create({
        reporter: req.user._id,
        reportedUser: targetId,
        reason: req.body.reason,
        description: req.body.description || '',
      });

      res.json({ reported: true });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get blocked users
router.get('/blocked', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('blockedUsers', 'name photos department');
    res.json(user.blockedUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user profile by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-likes -dislikes -blockedUsers -blockedBy -superLikes');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
