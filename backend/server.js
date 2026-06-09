require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const matchRoutes = require('./routes/match');
const chatRoutes = require('./routes/chat');
const eventRoutes = require('./routes/events');
const confessionRoutes = require('./routes/confessions');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token'],
  credentials: true
}));
app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'ChrisChat API is running',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    env: {
      MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'NOT SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
      PORT: process.env.PORT || '5000 (default)',
    }
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/match', matchRoutes(io));
app.use('/api/chat', chatRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/confessions', confessionRoutes);

// Socket.IO for real-time chat
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user_online', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.userId = userId;
    // Broadcast online status
    socket.broadcast.emit('user_status', { userId, online: true });
  });

  socket.on('send_message', (data) => {
    const receiverSocket = onlineUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('receive_message', data);
    }
  });

  socket.on('typing', (data) => {
    const receiverSocket = onlineUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('user_typing', {
        userId: data.senderId,
        matchId: data.matchId,
        isTyping: data.isTyping,
      });
    }
  });

  socket.on('message_read', (data) => {
    const senderSocket = onlineUsers.get(data.senderId);
    if (senderSocket) {
      io.to(senderSocket).emit('messages_read', {
        matchId: data.matchId,
        readBy: data.readBy,
        readAt: new Date(),
      });
    }
  });

  socket.on('new_match', (data) => {
    const receiverSocket = onlineUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('match_notification', {
        matchId: data.matchId,
        user: data.user,
      });
    }
  });

  socket.on('super_like', (data) => {
    const receiverSocket = onlineUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('super_like_received', {
        from: data.from,
      });
    }
  });

  // WebRTC Video Call Signaling
  socket.on('call_user', (data) => {
    const receiverSocket = onlineUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('incoming_call', {
        callerId: data.callerId,
        callerName: data.callerName,
        callerPhoto: data.callerPhoto,
        matchId: data.matchId,
        offer: data.offer,
      });
    } else {
      // User is offline
      socket.emit('call_failed', { reason: 'User is offline' });
    }
  });

  socket.on('call_answer', (data) => {
    const callerSocket = onlineUsers.get(data.callerId);
    if (callerSocket) {
      io.to(callerSocket).emit('call_answered', {
        answer: data.answer,
      });
    }
  });

  socket.on('ice_candidate', (data) => {
    const receiverSocket = onlineUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('ice_candidate', {
        candidate: data.candidate,
        senderId: data.senderId,
      });
    }
  });

  socket.on('end_call', (data) => {
    const receiverSocket = onlineUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('call_ended', {
        reason: data.reason || 'ended',
      });
    }
  });

  socket.on('reject_call', (data) => {
    const callerSocket = onlineUsers.get(data.callerId);
    if (callerSocket) {
      io.to(callerSocket).emit('call_rejected', {
        reason: data.reason || 'rejected',
      });
    }
  });

  socket.on('disconnect', () => {
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        // Broadcast offline status
        socket.broadcast.emit('user_status', { userId, online: false });
        break;
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

// Periodic: expire boosts
setInterval(async () => {
  try {
    const User = require('./models/User');
    await User.updateMany(
      { isBoosted: true, boostExpiresAt: { $lt: new Date() } },
      { isBoosted: false, boostExpiresAt: null }
    );
  } catch {
    // Non-critical
  }
}, 60000); // Check every minute

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`ChrisChat server running on port ${PORT}`);
});
