const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema(
  {
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    matchedAt: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSuperLike: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
    },
    hasMessages: {
      type: Boolean,
      default: false,
    },
    lastMessageAt: Date,
  },
  { timestamps: true }
);

matchSchema.index({ users: 1 });
matchSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Match', matchSchema);
