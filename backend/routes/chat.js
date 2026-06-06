const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Match = require('../models/Match');
const Message = require('../models/Message');

const router = express.Router();

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

    // Mark unread messages as read
    await Message.updateMany(
      {
        match: match._id,
        sender: { $ne: req.user._id },
        read: false,
      },
      { read: true }
    );

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message
router.post(
  '/:matchId',
  auth,
  [body('text').trim().notEmpty().isLength({ max: 1000 })],
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

      const message = await Message.create({
        match: match._id,
        sender: req.user._id,
        text: req.body.text,
      });

      await message.populate('sender', 'name photos');

      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

module.exports = router;
