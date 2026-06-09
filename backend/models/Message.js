const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    match: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      maxlength: 5000,
      default: '',
    },
    encrypted: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'icebreaker'],
      default: 'text',
    },
    imageUrl: String,
    videoUrl: String,
    audioUrl: String,
    audioDuration: Number,
    read: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
  },
  { timestamps: true }
);

messageSchema.index({ match: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
