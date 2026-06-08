const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Event = require('../models/Event');

const router = express.Router();

// Get upcoming events
router.get('/', auth, async (req, res) => {
  try {
    const filter = { date: { $gte: new Date() } };

    if (req.query.campus) {
      filter.campus = req.query.campus;
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }

    const events = await Event.find(filter)
      .sort({ date: 1 })
      .limit(50)
      .populate('createdBy', 'name photos')
      .populate('attendees', 'name photos');

    res.json(events);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Create event
router.post(
  '/',
  auth,
  [
    body('title').trim().notEmpty().isLength({ max: 100 }),
    body('description').trim().notEmpty().isLength({ max: 500 }),
    body('date').isISO8601(),
    body('location').trim().notEmpty(),
    body('campus').isIn(['Main Campus', 'Kengeri Campus', 'Bannerghatta Road Campus', 'Lavasa Campus', 'NCR Campus', 'Pune Campus']),
    body('category').optional().isIn(['social', 'academic', 'sports', 'cultural', 'party', 'other']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const event = await Event.create({
        ...req.body,
        createdBy: req.user._id,
        attendees: [req.user._id],
      });

      await event.populate('createdBy', 'name photos');

      res.status(201).json(event);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// RSVP to event
router.post('/:id/rsvp', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const alreadyAttending = event.attendees.includes(req.user._id);

    if (alreadyAttending) {
      // Un-RSVP
      event.attendees = event.attendees.filter(
        (id) => id.toString() !== req.user._id.toString()
      );
    } else {
      if (event.maxAttendees > 0 && event.attendees.length >= event.maxAttendees) {
        return res.status(400).json({ message: 'Event is full' });
      }
      event.attendees.push(req.user._id);
    }

    await event.save();
    await event.populate('attendees', 'name photos');

    res.json({
      attending: !alreadyAttending,
      attendeeCount: event.attendees.length,
      attendees: event.attendees,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get event attendees
router.get('/:id/attendees', auth, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('attendees', 'name photos department campus');

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(event.attendees);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
