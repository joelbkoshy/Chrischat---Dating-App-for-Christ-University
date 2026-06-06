const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Match = require('../models/Match');

const router = express.Router();

// Get discoverable profiles (people to swipe on)
router.get('/discover', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);

    const alreadySwiped = [...currentUser.likes, ...currentUser.dislikes, currentUser._id];

    const filter = {
      _id: { $nin: alreadySwiped },
      isProfileComplete: true,
    };

    // Filter by gender preference
    if (currentUser.interestedIn !== 'Everyone') {
      filter.gender = currentUser.interestedIn;
    }

    const profiles = await User.find(filter)
      .select('-likes -dislikes -password')
      .limit(20);

    res.json(profiles);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Like a user
router.post('/like/:id', auth, async (req, res) => {
  try {
    const targetId = req.params.id;
    const currentUser = await User.findById(req.user._id);

    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot like yourself' });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add to likes if not already there
    if (!currentUser.likes.includes(targetId)) {
      currentUser.likes.push(targetId);
      await currentUser.save();
    }

    // Check if it's a mutual like (match!)
    const isMatch = targetUser.likes.includes(req.user._id);

    if (isMatch) {
      // Create a match
      const existingMatch = await Match.findOne({
        users: { $all: [req.user._id, targetId] },
      });

      if (!existingMatch) {
        await Match.create({
          users: [req.user._id, targetId],
        });
      }

      return res.json({
        matched: true,
        matchedUser: {
          _id: targetUser._id,
          name: targetUser.name,
          photos: targetUser.photos,
          department: targetUser.department,
        },
      });
    }

    res.json({ matched: false });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Dislike (pass) a user
router.post('/dislike/:id', auth, async (req, res) => {
  try {
    const targetId = req.params.id;
    const currentUser = await User.findById(req.user._id);

    if (!currentUser.dislikes.includes(targetId)) {
      currentUser.dislikes.push(targetId);
      await currentUser.save();
    }

    res.json({ passed: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all matches
router.get('/', auth, async (req, res) => {
  try {
    const matches = await Match.find({
      users: req.user._id,
      isActive: true,
    }).populate('users', 'name photos department bio');

    const formattedMatches = matches.map((match) => {
      const otherUser = match.users.find(
        (u) => u._id.toString() !== req.user._id.toString()
      );
      return {
        _id: match._id,
        user: otherUser,
        matchedAt: match.matchedAt,
      };
    });

    res.json(formattedMatches);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
