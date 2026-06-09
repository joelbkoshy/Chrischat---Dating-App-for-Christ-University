const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    year: {
      type: String,
      enum: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'PG 1st Year', 'PG 2nd Year', 'PhD'],
    },
    age: {
      type: Number,
      min: 18,
      max: 30,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
    },
    interestedIn: {
      type: String,
      enum: ['Male', 'Female', 'Everyone'],
      default: 'Everyone',
    },
    bio: {
      type: String,
      maxlength: 300,
      default: '',
    },
    photos: {
      type: [String],
      default: [],
    },
    interests: {
      type: [String],
      default: [],
    },
    campus: {
      type: String,
      enum: ['Main Campus', 'Kengeri Campus', 'Bannerghatta Road Campus', 'Lavasa Campus', 'NCR Campus', 'Pune Campus'],
      default: 'Main Campus',
    },
    isProfileComplete: {
      type: Boolean,
      default: false,
    },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    superLikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    superLikesRemaining: {
      type: Number,
      default: 3,
    },
    superLikesResetDate: {
      type: Date,
      default: Date.now,
    },
    lastSwipe: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      action: { type: String, enum: ['like', 'dislike', 'superlike'] },
      timestamp: Date,
    },
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    blockedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isVisible: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isBoosted: {
      type: Boolean,
      default: false,
    },
    boostExpiresAt: Date,
    profilePrompts: [
      {
        question: { type: String, maxlength: 100 },
        answer: { type: String, maxlength: 200 },
      },
    ],
    badges: [
      {
        name: String,
        earnedAt: { type: Date, default: Date.now },
      },
    ],
    streaks: {
      type: Map,
      of: {
        count: { type: Number, default: 0 },
        lastMessageDate: Date,
      },
      default: {},
    },
    mode: {
      type: String,
      enum: ['dating', 'study-buddy'],
      default: 'dating',
    },
    studySubjects: {
      type: [String],
      default: [],
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    publicKey: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
