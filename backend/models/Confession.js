const mongoose = require('mongoose');

const confessionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      maxlength: 500,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    campus: {
      type: String,
      enum: ['Main Campus', 'Kengeri Campus', 'Bannerghatta Road Campus', 'Lavasa Campus', 'NCR Campus', 'Pune Campus'],
    },
    category: {
      type: String,
      enum: ['crush', 'funny', 'academic', 'rant', 'advice', 'other'],
      default: 'other',
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    reports: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isHidden: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

confessionSchema.index({ createdAt: -1 });
confessionSchema.index({ campus: 1, createdAt: -1 });

module.exports = mongoose.model('Confession', confessionSchema);
