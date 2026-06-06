# ChrisChat - Dating App for Christ University

A mobile dating application built for Christ University students, powered by React Native (Expo) and MongoDB.

## Features

- **Swipe to Match**: Tinder-style swipe cards to like or pass on profiles
- **Real-time Chat**: Instant messaging with matched users via Socket.IO
- **Profile Setup**: Complete profile with bio, interests, department, campus, and year
- **Smart Discovery**: Filter profiles by gender preference, skip already-swiped users
- **Christ University Specific**: Departments, campuses, and student year selections tailored to Christ University

## Tech Stack

### Frontend
- React Native with Expo SDK 56
- Expo Router (file-based routing)
- TypeScript
- Socket.IO Client

### Backend
- Node.js + Express
- MongoDB with Mongoose
- Socket.IO for real-time messaging
- JWT authentication
- bcrypt password hashing

## Project Structure

```
chrischat/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout with AuthProvider
│   ├── index.tsx           # Entry redirect logic
│   ├── login.tsx           # Login screen
│   ├── register.tsx        # Registration screen
│   ├── complete-profile.tsx # Profile setup
│   ├── (tabs)/             # Tab navigation
│   │   ├── _layout.tsx     # Tab bar config
│   │   ├── discover.tsx    # Swipe cards screen
│   │   ├── matches.tsx     # Matches list
│   │   └── profile.tsx     # User profile
│   └── chat/
│       └── [matchId].tsx   # Chat conversation
├── src/
│   ├── constants/theme.ts  # Colors, fonts, spacing
│   ├── context/AuthContext.tsx # Authentication state
│   └── services/api.ts     # API client
├── backend/
│   ├── server.js           # Express + Socket.IO server
│   ├── config/db.js        # MongoDB connection
│   ├── middleware/auth.js   # JWT auth middleware
│   ├── models/
│   │   ├── User.js         # User model
│   │   ├── Match.js        # Match model
│   │   └── Message.js      # Message model
│   └── routes/
│       ├── auth.js         # Register/Login
│       ├── profile.js      # Profile CRUD
│       ├── match.js        # Like/Dislike/Discover
│       └── chat.js         # Messages
└── assets/                 # App icons and images
```

## Getting Started

### Prerequisites
- Node.js >= 20.19
- MongoDB installed and running locally
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (for testing)

### 1. Backend Setup

```bash
cd chrischat/backend

# Copy environment file and update values
cp .env.example .env

# Install dependencies (already done)
npm install

# Start MongoDB (if not running)
# Windows: net start MongoDB
# macOS/Linux: mongod

# Start the backend server
npm run dev
```

The backend runs on `http://localhost:5000`.

### 2. Frontend Setup

```bash
cd chrischat

# Install dependencies (already done)
npm install

# Start Expo dev server
npx expo start
```

Scan the QR code with Expo Go (Android) or Camera (iOS) to run on your device.

### 3. API URL Configuration

Edit `src/services/api.ts` and update the `API_URL`:

- **Android Emulator**: `http://10.0.2.2:5000/api`
- **iOS Simulator**: `http://localhost:5000/api`
- **Physical Device**: `http://<YOUR_PC_IP>:5000/api`

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/profile` | Get own profile |
| PUT | `/api/profile` | Update profile |
| GET | `/api/match/discover` | Get profiles to swipe |
| POST | `/api/match/like/:id` | Like a user |
| POST | `/api/match/dislike/:id` | Pass on a user |
| GET | `/api/match` | Get all matches |
| GET | `/api/chat/:matchId` | Get messages |
| POST | `/api/chat/:matchId` | Send a message |
