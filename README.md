# ChrisChat — Dating App for Christ University

A full-featured mobile dating app built for Christ University students. Swipe, match, chat, share photos/videos, attend campus events, and post anonymous confessions.

Built with React Native (Expo SDK 56), Node.js, MongoDB, and Socket.IO.

---

## Features

### Core
- **Swipe to Match** — Tinder-style card swiping with like, dislike, and super like
- **Real-time Chat** — Instant messaging with typing indicators, read receipts, and icebreaker prompts
- **Photo & Video Uploads** — Pick from gallery or camera, send media in chat, upload profile photos
- **Profile Setup** — Bio, interests, department, campus, year, gender preferences, profile prompts

### Discovery
- **Smart Filters** — Filter by department, year, campus, age range, and mode (dating/study buddy)
- **Compatibility Score** — Auto-calculated % based on shared interests, department, campus, year, and age
- **Daily Pick** — One curated match per day based on compatibility
- **Super Like** — 3 per day, notifies the other person immediately
- **Undo** — Take back your last swipe within 30 seconds
- **Boost** — Appear at the top of discovery for 30 minutes

### Chat
- **Typing Indicators** — See when the other person is typing
- **Read Receipts** — ✓✓ Read status on messages
- **Image & Video Messages** — Send photos and videos in chat with inline playback
- **Icebreaker Prompts** — 12 conversation starters to break the ice
- **Chat Streaks** — Track consecutive daily conversations

### Social
- **Campus Events** — Create and RSVP to events, filter by campus and category
- **Anonymous Confessions** — Post confessions, like, report, filter by category
- **Badges** — Earn badges: First Swipe, First Match, Profile Pro, 10 Conversations

### Safety
- **Block & Report** — Block users and report with categorized reasons
- **Auto-hide Confessions** — Confessions with 5+ reports are auto-hidden
- **Visibility Toggle** — Hide your profile from discovery
- **Match Expiry** — Matches without messages expire after 48 hours

---

## Tech Stack

### Frontend
- React Native 0.85 + Expo SDK 56
- Expo Router (file-based navigation)
- TypeScript
- Socket.IO Client
- expo-image-picker (photo/video selection)
- expo-video (video playback)

### Backend
- Node.js + Express
- MongoDB + Mongoose
- Socket.IO (real-time messaging, typing, online status)
- JWT authentication + bcrypt
- Multer (local uploads) / Cloudinary (production)
- express-validator

---

## Project Structure

```
chrischat/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root layout + AuthProvider
│   ├── index.tsx                  # Entry redirect
│   ├── login.tsx                  # Login
│   ├── register.tsx               # Registration
│   ├── complete-profile.tsx       # Profile setup (mode, prompts, subjects)
│   ├── (tabs)/
│   │   ├── _layout.tsx            # 5-tab navigator
│   │   ├── discover.tsx           # Swipe cards + filters
│   │   ├── matches.tsx            # Match list + unread badges
│   │   ├── events.tsx             # Campus events + RSVP
│   │   ├── confessions.tsx        # Anonymous confessions
│   │   └── profile.tsx            # Profile + photo grid + settings
│   └── chat/
│       └── [matchId].tsx          # Chat + media + video playback
├── src/
│   ├── constants/theme.ts         # Design tokens
│   ├── context/AuthContext.tsx     # Auth state management
│   └── services/api.ts            # API client (all endpoints)
├── backend/
│   ├── server.js                  # Express + Socket.IO + routes
│   ├── config/
│   │   ├── db.js                  # MongoDB connection
│   │   └── cloudinary.js          # Cloudinary config (production)
│   ├── middleware/auth.js          # JWT middleware
│   ├── models/
│   │   ├── User.js                # User (profile, badges, streaks, blocks)
│   │   ├── Match.js               # Match (super like, expiry)
│   │   ├── Message.js             # Message (text, image, video, icebreaker)
│   │   ├── Report.js              # User reports
│   │   ├── Event.js               # Campus events
│   │   └── Confession.js          # Anonymous confessions
│   └── routes/
│       ├── auth.js                # Register / Login
│       ├── profile.js             # Profile CRUD, photos, block, report
│       ├── match.js               # Discover, like, super like, undo, boost
│       ├── chat.js                # Messages, images, videos, icebreakers
│       ├── events.js              # Events CRUD, RSVP
│       └── confessions.js         # Confessions, like, report
└── assets/                        # App icons and images
```

---

## Getting Started

### Prerequisites
- Node.js >= 20
- MongoDB running locally
- Expo Go app on your phone

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/chrischat.git
cd chrischat

# Frontend dependencies
npm install

# Backend dependencies
cd backend
npm install
```

### 2. Backend Setup

Create `backend/.env`:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chrischat
JWT_SECRET=your-secret-key-here

# Optional: Add these for cloud file storage (required in production)
# CLOUDINARY_CLOUD_NAME=your-cloud-name
# CLOUDINARY_API_KEY=your-api-key
# CLOUDINARY_API_SECRET=your-api-secret
```

Start the backend:

```bash
cd backend
npm run dev
```

### 3. Frontend Setup

Update the API URL in `src/services/api.ts`:

```typescript
// For production, set your deployed backend URL:
const PRODUCTION_URL = '';  // e.g. 'https://chrischat-backend.onrender.com'
```

Start the Expo dev server:

```bash
npx expo start
```

Scan the QR code with Expo Go to run on your phone, or press `w` for web.

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/profile` | Get own profile |
| PUT | `/api/profile` | Update profile |
| GET | `/api/profile/:id` | Get user profile by ID |
| POST | `/api/profile/photos` | Upload photos (max 6) |
| DELETE | `/api/profile/photos/:index` | Delete a photo |
| POST | `/api/profile/visibility` | Toggle profile visibility |
| GET | `/api/profile/badges` | Get earned badges |
| POST | `/api/profile/block/:id` | Block a user |
| POST | `/api/profile/unblock/:id` | Unblock a user |
| GET | `/api/profile/blocked` | Get blocked users list |
| POST | `/api/profile/report/:id` | Report a user |

### Discovery & Matching
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/match/discover` | Get profiles (supports filters) |
| GET | `/api/match/daily-pick` | Get daily recommended match |
| POST | `/api/match/like/:id` | Like a user |
| POST | `/api/match/superlike/:id` | Super like (3/day) |
| POST | `/api/match/dislike/:id` | Pass on a user |
| POST | `/api/match/undo` | Undo last swipe (30s window) |
| GET | `/api/match` | Get all matches |
| POST | `/api/match/unmatch/:id` | Unmatch |
| POST | `/api/match/boost` | Boost profile (30 min) |
| GET | `/api/match/compatibility/:id` | Get compatibility score |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/icebreakers` | Get 3 random icebreakers |
| GET | `/api/chat/:matchId` | Get messages (paginated) |
| POST | `/api/chat/:matchId` | Send text message |
| POST | `/api/chat/:matchId/image` | Send image message |
| POST | `/api/chat/:matchId/video` | Send video message |
| POST | `/api/chat/:matchId/read` | Mark messages as read |

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/events` | Get events (filter by campus/category) |
| POST | `/api/events` | Create event |
| POST | `/api/events/:id/rsvp` | Toggle RSVP |
| GET | `/api/events/:id/attendees` | Get attendees |

### Confessions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/confessions` | Get confessions (paginated) |
| POST | `/api/confessions` | Post anonymous confession |
| POST | `/api/confessions/:id/like` | Toggle like |
| POST | `/api/confessions/:id/report` | Report confession |

---

## Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `user_online` | Client → Server | User comes online |
| `send_message` | Client → Server | Send a message |
| `receive_message` | Server → Client | Receive a message |
| `typing` | Client → Server | Typing indicator |
| `user_typing` | Server → Client | Peer typing status |
| `message_read` | Client → Server | Messages read |
| `messages_read` | Server → Client | Read receipt |
| `new_match` | Server → Client | New match notification |
| `super_like` | Client → Server | Super like sent |
| `super_like_received` | Server → Client | Super like notification |

---

## Deployment (Free)

| Service | Purpose | Cost |
|---------|---------|------|
| MongoDB Atlas M0 | Database | Free |
| Render (free tier) | Backend hosting | Free |
| Cloudinary (free tier) | Photo/video storage | Free |
| EAS Build (free tier) | Android APK builds | Free |

See the deployment guide in the project for full step-by-step instructions.

---

## License

See [LICENSE](LICENSE) for details.
