const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Confession = require('../models/Confession');

const router = express.Router();

// Get confessions (paginated)
router.get('/', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = { isHidden: false };

    if (req.query.campus) {
      filter.campus = req.query.campus;
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const confessions = await Confession.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-author'); // Anonymous - don't expose author

    const total = await Confession.countDocuments(filter);

    res.json({
      confessions,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Post a confession
router.post(
  '/',
  auth,
  [
    body('text').trim().notEmpty().isLength({ max: 500 }),
    body('category').optional().isIn(['crush', 'funny', 'academic', 'rant', 'advice', 'other']),
    body('campus').optional().isIn(['Main Campus', 'Kengeri Campus', 'Bannerghatta Road Campus', 'Lavasa Campus', 'NCR Campus', 'Pune Campus']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const confession = await Confession.create({
        text: req.body.text,
        category: req.body.category || 'other',
        campus: req.body.campus,
        author: req.user._id,
      });

      // Return without author (anonymous)
      const result = confession.toObject();
      delete result.author;

      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Like/unlike a confession
router.post('/:id/like', auth, async (req, res) => {
  try {
    const confession = await Confession.findById(req.params.id);
    if (!confession) {
      return res.status(404).json({ message: 'Confession not found' });
    }

    const alreadyLiked = confession.likes.includes(req.user._id);

    if (alreadyLiked) {
      confession.likes = confession.likes.filter(
        (id) => id.toString() !== req.user._id.toString()
      );
    } else {
      confession.likes.push(req.user._id);
    }

    await confession.save();

    res.json({
      liked: !alreadyLiked,
      likeCount: confession.likes.length,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Report a confession
router.post('/:id/report', auth, async (req, res) => {
  try {
    const confession = await Confession.findById(req.params.id);
    if (!confession) {
      return res.status(404).json({ message: 'Confession not found' });
    }

    if (!confession.reports.includes(req.user._id)) {
      confession.reports.push(req.user._id);

      // Auto-hide if 5+ reports
      if (confession.reports.length >= 5) {
        confession.isHidden = true;
      }

      await confession.save();
    }

    res.json({ reported: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
