const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Match = require('../models/Match');
const Message = require('../models/Message');

// Calculate compatibility score between two users
function calculateCompatibility(user1, user2) {
  let score = 0;
  let factors = 0;

  // Shared interests (max 30 points)
  if (user1.interests && user2.interests) {
    const shared = user1.interests.filter((i) => user2.interests.includes(i));
    score += Math.min((shared.length / Math.max(user1.interests.length, 1)) * 30, 30);
    factors++;
  }

  // Same department (20 points)
  if (user1.department === user2.department) {
    score += 20;
  }
  factors++;

  // Same campus (20 points)
  if (user1.campus === user2.campus) {
    score += 20;
  }
  factors++;

  // Same year (15 points)
  if (user1.year === user2.year) {
    score += 15;
  }
  factors++;

  // Close age (15 points)
  if (user1.age && user2.age) {
    const ageDiff = Math.abs(user1.age - user2.age);
    if (ageDiff <= 1) score += 15;
    else if (ageDiff <= 3) score += 10;
    else if (ageDiff <= 5) score += 5;
  }
  factors++;

  return Math.round(score);
}

module.exports = function (io) {
const router = express.Router();

// Helper: find socket ID for a user
function getReceiverSocket(userId) {
  // Access the onlineUsers map from server.js via io
  const sockets = io.sockets.sockets;
  for (const [, socket] of sockets) {
    if (socket.userId === userId.toString()) return socket.id;
  }
  return null;
}

// Get discoverable profiles with filters
router.get('/discover', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);

    const alreadySwiped = [...currentUser.likes, ...currentUser.dislikes, ...currentUser.blockedUsers, currentUser._id];

    const filter = {
      _id: { $nin: alreadySwiped },
      isProfileComplete: true,
      isVisible: { $ne: false },
      blockedUsers: { $nin: [currentUser._id] },
    };

    // Filter by gender preference
    if (currentUser.interestedIn !== 'Everyone') {
      filter.gender = currentUser.interestedIn;
    }

    // Optional query filters
    if (req.query.department) {
      filter.department = req.query.department;
    }
    if (req.query.year) {
      filter.year = req.query.year;
    }
    if (req.query.campus) {
      filter.campus = req.query.campus;
    }
    if (req.query.minAge || req.query.maxAge) {
      filter.age = {};
      if (req.query.minAge) filter.age.$gte = parseInt(req.query.minAge);
      if (req.query.maxAge) filter.age.$lte = parseInt(req.query.maxAge);
    }
    if (req.query.mode) {
      filter.mode = req.query.mode;
    }

    // Boosted profiles first, then rest
    const profiles = await User.find(filter)
      .select('-likes -dislikes -password -blockedUsers -blockedBy -superLikes')
      .sort({ isBoosted: -1, lastActive: -1 })
      .limit(30);

    // Add compatibility score
    const profilesWithScore = profiles.map((p) => {
      const profileObj = p.toObject();
      profileObj.compatibility = calculateCompatibility(currentUser, p);
      return profileObj;
    });

    res.json(profilesWithScore);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Daily Pick - one curated profile per day
router.get('/daily-pick', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const alreadySwiped = [...currentUser.likes, ...currentUser.dislikes, ...currentUser.blockedUsers, currentUser._id];

    const filter = {
      _id: { $nin: alreadySwiped },
      isProfileComplete: true,
      isVisible: { $ne: false },
      blockedUsers: { $nin: [currentUser._id] },
    };

    if (currentUser.interestedIn !== 'Everyone') {
      filter.gender = currentUser.interestedIn;
    }

    // Prefer same campus users
    const sameCampus = await User.find({ ...filter, campus: currentUser.campus })
      .select('-likes -dislikes -password -blockedUsers -blockedBy')
      .limit(10);

    const pool = sameCampus.length > 0
      ? sameCampus
      : await User.find(filter).select('-likes -dislikes -password -blockedUsers -blockedBy').limit(10);

    if (pool.length === 0) {
      return res.json(null);
    }

    // Pick based on day seed so same pick all day
    const daySeed = new Date().toDateString();
    const index = (daySeed.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + currentUser._id.toString().charCodeAt(0)) % pool.length;
    const pick = pool[index].toObject();
    pick.compatibility = calculateCompatibility(currentUser, pool[index]);

    res.json(pick);
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
    if (!currentUser.likes.some(id => id.toString() === targetId)) {
      currentUser.likes.push(targetId);
      // Track last swipe for undo
      currentUser.lastSwipe = { userId: targetId, action: 'like', timestamp: new Date() };
      await currentUser.save();
    }

    // Check for badge: first like
    if (currentUser.likes.length === 1 && !currentUser.badges.find((b) => b.name === 'First Swipe')) {
      currentUser.badges.push({ name: 'First Swipe' });
      await currentUser.save();
    }

    // Check if it's a mutual like (match!)
    const isMatch = targetUser.likes.some(id => id.toString() === req.user._id.toString());

    // Notify the target user that someone liked them (only if not a match yet)
    if (!isMatch) {
      const likeTargetSocket = getReceiverSocket(targetId);
      if (likeTargetSocket) {
        io.to(likeTargetSocket).emit('like_received', {
          from: { _id: currentUser._id, name: currentUser.name, photos: currentUser.photos },
        });
      }
    }

    if (isMatch) {
      const existingMatch = await Match.findOne({
        users: { $all: [req.user._id, targetId] },
      });

      if (!existingMatch) {
        const match = await Match.create({
          users: [req.user._id, targetId],
        });

        // Badge: First Match
        if (!currentUser.badges.find((b) => b.name === 'First Match')) {
          currentUser.badges.push({ name: 'First Match' });
          await currentUser.save();
        }

        // Notify the other user about the match via socket
        const targetSocket = getReceiverSocket(targetId);
        if (targetSocket) {
          io.to(targetSocket).emit('match_notification', {
            matchId: match._id,
            user: { _id: currentUser._id, name: currentUser.name, photos: currentUser.photos },
          });
        }

        return res.json({
          matched: true,
          matchId: match._id,
          matchedUser: {
            _id: targetUser._id,
            name: targetUser.name,
            photos: targetUser.photos,
            department: targetUser.department,
          },
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

// Super Like a user
router.post('/superlike/:id', auth, async (req, res) => {
  try {
    const targetId = req.params.id;
    const currentUser = await User.findById(req.user._id);

    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot super like yourself' });
    }

    // Reset super likes if new day
    const now = new Date();
    const resetDate = currentUser.superLikesResetDate;
    if (!resetDate || now.toDateString() !== resetDate.toDateString()) {
      currentUser.superLikesRemaining = 3;
      currentUser.superLikesResetDate = now;
    }

    if (currentUser.superLikesRemaining <= 0) {
      return res.status(400).json({ message: 'No super likes remaining today' });
    }

    const targetUser = await User.findById(targetId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!currentUser.likes.some(id => id.toString() === targetId)) {
      currentUser.likes.push(targetId);
    }
    if (!currentUser.superLikes.some(id => id.toString() === targetId)) {
      currentUser.superLikes.push(targetId);
    }
    currentUser.superLikesRemaining -= 1;
    currentUser.lastSwipe = { userId: targetId, action: 'superlike', timestamp: new Date() };
    await currentUser.save();

    // Notify the target about the super like
    const targetSocket = getReceiverSocket(targetId);
    if (targetSocket) {
      io.to(targetSocket).emit('super_like_received', {
        from: { _id: currentUser._id, name: currentUser.name, photos: currentUser.photos },
      });
    }

    // Check if mutual
    const isMatch = targetUser.likes.some(id => id.toString() === req.user._id.toString());

    if (isMatch) {
      const existingMatch = await Match.findOne({
        users: { $all: [req.user._id, targetId] },
      });

      if (!existingMatch) {
        const match = await Match.create({
          users: [req.user._id, targetId],
          isSuperLike: true,
        });

        // Notify about match
        const targetSocket2 = getReceiverSocket(targetId);
        if (targetSocket2) {
          io.to(targetSocket2).emit('match_notification', {
            matchId: match._id,
            user: { _id: currentUser._id, name: currentUser.name, photos: currentUser.photos },
          });
        }
      }

      return res.json({
        matched: true,
        superLikesRemaining: currentUser.superLikesRemaining,
        matchedUser: {
          _id: targetUser._id,
          name: targetUser.name,
          photos: targetUser.photos,
          department: targetUser.department,
        },
      });
    }

    res.json({ matched: false, superLikesRemaining: currentUser.superLikesRemaining });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Undo last swipe
router.post('/undo', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);

    if (!currentUser.lastSwipe || !currentUser.lastSwipe.userId) {
      return res.status(400).json({ message: 'Nothing to undo' });
    }

    // Only allow undo within 30 seconds
    const elapsed = Date.now() - new Date(currentUser.lastSwipe.timestamp).getTime();
    if (elapsed > 30000) {
      return res.status(400).json({ message: 'Undo window expired (30 seconds)' });
    }

    const targetId = currentUser.lastSwipe.userId;

    if (currentUser.lastSwipe.action === 'like' || currentUser.lastSwipe.action === 'superlike') {
      currentUser.likes = currentUser.likes.filter((id) => id.toString() !== targetId.toString());
      if (currentUser.lastSwipe.action === 'superlike') {
        currentUser.superLikes = currentUser.superLikes.filter((id) => id.toString() !== targetId.toString());
        currentUser.superLikesRemaining += 1;
      }
      // Remove match if created
      await Match.deleteOne({ users: { $all: [req.user._id, targetId] } });
    } else {
      currentUser.dislikes = currentUser.dislikes.filter((id) => id.toString() !== targetId.toString());
    }

    currentUser.lastSwipe = undefined;
    await currentUser.save();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Dislike (pass) a user
router.post('/dislike/:id', auth, async (req, res) => {
  try {
    const targetId = req.params.id;
    const currentUser = await User.findById(req.user._id);

    if (!currentUser.dislikes.some(id => id.toString() === targetId)) {
      currentUser.dislikes.push(targetId);
      currentUser.lastSwipe = { userId: targetId, action: 'dislike', timestamp: new Date() };
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
    // Expire old matches without messages
    await Match.updateMany(
      {
        hasMessages: false,
        expiresAt: { $lt: new Date() },
        isActive: true,
      },
      { isActive: false }
    );

    const matches = await Match.find({
      users: req.user._id,
      isActive: true,
    }).populate('users', 'name photos department bio campus');

    // Get last message and unread count for each match
    const formattedMatches = await Promise.all(
      matches.map(async (match) => {
        const otherUser = match.users.find(
          (u) => u._id.toString() !== req.user._id.toString()
        );

        const lastMessage = await Message.findOne({ match: match._id })
          .sort({ createdAt: -1 })
          .select('text type encrypted createdAt sender');

        const unreadCount = await Message.countDocuments({
          match: match._id,
          sender: { $ne: req.user._id },
          read: false,
        });

        // Check if same campus
        const currentUser = await User.findById(req.user._id).select('campus');
        const sameCampus = currentUser.campus === otherUser.campus;

        let previewText = '';
        if (lastMessage) {
          if (lastMessage.type === 'image') previewText = '📷 Photo';
          else if (lastMessage.type === 'video') previewText = '🎬 Video';
          else if (lastMessage.type === 'audio') previewText = '🎙️ Voice message';
          else if (lastMessage.encrypted) previewText = '🔒 Encrypted message';
          else previewText = lastMessage.text;
        }

        return {
          _id: match._id,
          user: otherUser,
          matchedAt: match.matchedAt,
          isSuperLike: match.isSuperLike,
          expiresAt: match.expiresAt,
          hasMessages: match.hasMessages,
          sameCampus,
          lastMessage: lastMessage
            ? {
                text: previewText,
                createdAt: lastMessage.createdAt,
                isOwn: lastMessage.sender.toString() === req.user._id.toString(),
              }
            : null,
          unreadCount,
        };
      })
    );

    // Sort: unread first, then by last message time
    formattedMatches.sort((a, b) => {
      if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
      if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
      const aTime = a.lastMessage?.createdAt || a.matchedAt;
      const bTime = b.lastMessage?.createdAt || b.matchedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    res.json(formattedMatches);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Unmatch
router.post('/unmatch/:matchId', auth, async (req, res) => {
  try {
    const match = await Match.findOne({
      _id: req.params.matchId,
      users: req.user._id,
    });

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    match.isActive = false;
    await match.save();

    // Delete messages
    await Message.deleteMany({ match: match._id });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Boost profile
router.post('/boost', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.isBoosted = true;
    user.boostExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min boost
    await user.save();

    res.json({ boosted: true, expiresAt: user.boostExpiresAt });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Get compatibility with specific user
router.get('/compatibility/:id', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const targetUser = await User.findById(req.params.id);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const score = calculateCompatibility(currentUser, targetUser);
    const sharedInterests = currentUser.interests.filter((i) => targetUser.interests.includes(i));

    res.json({
      score,
      sharedInterests,
      sameCampus: currentUser.campus === targetUser.campus,
      sameDepartment: currentUser.department === targetUser.department,
      sameYear: currentUser.year === targetUser.year,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

return router;
};
