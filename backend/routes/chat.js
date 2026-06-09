const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Match = require('../models/Match');
const Message = require('../models/Message');
const User = require('../models/User');

const router = express.Router();

// Use Cloudinary in production, local disk in development
const useCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY);
let upload;

if (useCloudinary) {
  const { chatUpload } = require('../config/cloudinary');
  upload = chatUpload;
} else {
  const uploadsDir = path.join(__dirname, '..', 'uploads', 'chat');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `chat-${req.user._id}-${Date.now()}${ext}`);
    },
  });

  upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
      const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.mov', '.avi', '.mkv'];
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, allowed.includes(ext));
    },
    limits: { fileSize: 50 * 1024 * 1024 },
  });
}

const ICEBREAKERS = [
  "What's the most spontaneous thing you've ever done?",
  "If you could travel anywhere right now, where would you go?",
  "What's your go-to comfort food after a long day?",
  "What song has been stuck in your head lately?",
  "If we were on campus right now, where would you take me?",
  "What's your unpopular opinion about college life?",
  "What's the best class you've ever taken and why?",
  "Coffee or chai? And where's your favorite spot?",
  "What's one thing on your bucket list?",
  "What's your guilty pleasure show right now?",
  "If you could swap departments for a day, which would you pick?",
  "What's the most interesting thing you've learned recently?",
];

// Get icebreaker suggestions
router.get('/icebreakers', auth, (req, res) => {
  // Return 3 random icebreakers
  const shuffled = ICEBREAKERS.sort(() => 0.5 - Math.random());
  res.json(shuffled.slice(0, 3));
});

// Get messages for a match
router.get('/:matchId', auth, async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
    });

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ match: match._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'name photos');

    // Mark unread messages as read and set readAt
    const now = new Date();
    await Message.updateMany(
      {
        match: match._id,
        sender: { $ne: req.user._id },
        read: false,
      },
      { read: true, readAt: now }
    );

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a text message
router.post(
  '/:matchId',
  auth,
  [body('text').optional().trim().isLength({ max: 5000 })],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const match = await Match.findOne({
        _id: req.params.matchId,
        users: req.user._id,
      });

      if (!match) {
        return res.status(404).json({ message: 'Match not found' });
      }

      const msgData = {
        match: match._id,
        sender: req.user._id,
        text: req.body.text || '',
        type: req.body.type || 'text',
        encrypted: req.body.encrypted || false,
      };

      const message = await Message.create(msgData);
      await message.populate('sender', 'name photos');

      // Mark match as having messages (prevents expiration)
      if (!match.hasMessages) {
        match.hasMessages = true;
      }
      match.lastMessageAt = new Date();
      await match.save();

      // Update streaks
      const otherUserId = match.users.find((u) => u.toString() !== req.user._id.toString());
      await updateStreak(req.user._id, otherUserId.toString());

      // Badge: 10 Conversations
      const conversationCount = await Match.countDocuments({
        users: req.user._id,
        hasMessages: true,
        isActive: true,
      });
      if (conversationCount >= 10) {
        const user = await User.findById(req.user._id);
        if (!user.badges.find((b) => b.name === '10 Conversations')) {
          user.badges.push({ name: '10 Conversations' });
          await user.save();
        }
      }

      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Send an image message
router.post('/:matchId/image', auth, upload.single('image'), async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
    });

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    const message = await Message.create({
      match: match._id,
      sender: req.user._id,
      text: '',
      type: 'image',
      imageUrl: req.file.path || `/uploads/chat/${req.file.filename}`,
    });

    await message.populate('sender', 'name photos');

    if (!match.hasMessages) {
      match.hasMessages = true;
    }
    match.lastMessageAt = new Date();
    await match.save();

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a video message
router.post('/:matchId/video', auth, upload.single('video'), async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
    });

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No video uploaded' });
    }

    const message = await Message.create({
      match: match._id,
      sender: req.user._id,
      text: '',
      type: 'video',
      videoUrl: req.file.path || `/uploads/chat/${req.file.filename}`,
    });

    await message.populate('sender', 'name photos');

    if (!match.hasMessages) {
      match.hasMessages = true;
    }
    match.lastMessageAt = new Date();
    await match.save();

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark messages as read
router.post('/:matchId/read', auth, async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
    });

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const now = new Date();
    const result = await Message.updateMany(
      {
        match: match._id,
        sender: { $ne: req.user._id },
        read: false,
      },
      { read: true, readAt: now }
    );

    res.json({ markedRead: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper: update chat streak
async function updateStreak(userId, otherUserId) {
  try {
    const user = await User.findById(userId);
    const today = new Date().toDateString();

    const streakData = user.streaks.get(otherUserId) || { count: 0, lastMessageDate: null };

    if (streakData.lastMessageDate) {
      const lastDate = new Date(streakData.lastMessageDate).toDateString();
      const yesterday = new Date(Date.now() - 86400000).toDateString();

      if (lastDate === today) {
        // Already messaged today
        return;
      } else if (lastDate === yesterday) {
        // Consecutive day
        streakData.count += 1;
      } else {
        // Streak broken
        streakData.count = 1;
      }
    } else {
      streakData.count = 1;
    }

    streakData.lastMessageDate = new Date();
    user.streaks.set(otherUserId, streakData);
    await user.save();
  } catch {
    // Non-critical, don't fail the request
  }
}

module.exports = router;
