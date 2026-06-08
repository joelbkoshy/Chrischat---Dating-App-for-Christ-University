const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    date: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      required: true,
      trim: true,
    },
    campus: {
      type: String,
      enum: ['Main Campus', 'Kengeri Campus', 'Bannerghatta Road Campus', 'Lavasa Campus', 'NCR Campus', 'Pune Campus'],
      required: true,
    },
    category: {
      type: String,
      enum: ['social', 'academic', 'sports', 'cultural', 'party', 'other'],
      default: 'social',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    attendees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    maxAttendees: {
      type: Number,
      default: 0, // 0 = unlimited
    },
    imageUrl: String,
  },
  { timestamps: true }
);

eventSchema.index({ date: 1, campus: 1 });

module.exports = mongoose.model('Event', eventSchema);
