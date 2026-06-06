const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

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
        'interests', 'year', 'campus', 'photos',
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

      res.json(updatedUser);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Get user profile by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-likes -dislikes');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
