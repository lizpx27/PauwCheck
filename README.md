# 🐯 PauwCheck — DePauw Student Wellness Companion

> **Personality-powered wellness, built for DePauw students — by DePauw students.**

PauwCheck is a gamified mental health and wellness web app that uses the **Big Five (OCEAN) personality model** to match DePauw University students with the right on-campus counselor. Students grow a virtual tiger companion as they build healthy daily habits, journal, and explore their personality profile.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Database Schema](#database-schema)
- [API Integrations](#api-integrations)
- [Setup & Usage Instructions](#setup--usage-instructions)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Team](#team)

---

## Overview

College students face a growing mental health crisis — 1 in 4 experience a diagnosable condition, yet most never seek help. The barrier isn't always awareness; it's **friction**: students don't know what kind of support they need, or which counselor would be the best fit for them.

PauwCheck removes that friction by:

1. **Profiling** the student using a validated 25-question Big Five personality assessment
2. **Matching** their OCEAN scores to a real DePauw counselor whose therapeutic approach fits their profile
3. **Engaging** them daily through habit logging, journaling, and a gamified companion — so wellness becomes a habit, not a crisis response

PauwCheck is **not** a replacement for counseling. It's the bridge that gets students there.

---

## Features

### 🔐 Authentication & Accounts
- Secure sign-up and login restricted to `@depauw.edu` email addresses
- 6-digit email verification code on every login
- User profiles stored in database (name, email, tiger configuration, progress)
- Session persistence via JWT tokens

### 🐯 Virtual Tiger Companion
- Customizable tiger with 5 color options (Yellow, Orange, Green, Pink, Blue)
- Named by the student during onboarding
- Grows and levels up as the student completes wellness activities
- Tap-to-pet interaction with 3-second cooldown and coin reward
- Accessory wardrobe (hats, glasses, outfits) unlockable with earned coins

### 📊 Big Five (OCEAN) Personality Assessment
- 25-question validated personality quiz
- Measures Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism
- Animated results dashboard with trait percentage breakdown
- Personalized wellness insights based on score patterns
- Counselor matching algorithm that maps OCEAN scores to counseling styles

### 🩺 Counselor Matching
- 5 real DePauw Counseling Services staff profiles
- Smart matching engine scores each counselor against the student's OCEAN profile
- Full counselor bios, credentials, contact info, and specialties
- Direct "Book a Session" link to DePauw's appointment portal
- Matched counselor highlighted across all views

### 📅 Daily Habit Logging
- Activity, Social, Schoolwork, and Wellbeing progress bars
- Tap-to-log habit chips (exercise, meals, study, meditation, etc.)
- 24-hour automatic reset with countdown timer
- Streak tracking across sessions

### 📓 Wellness Journal
- Rotating daily prompts to spark reflection
- Entries saved to database with timestamp
- Journal activity awards coins and boosts Wellbeing progress
- Entry history with expand/collapse view

### 🏆 Gamification
- Coin economy: earn coins by logging habits, journaling, petting tiger
- XP and level-up system with confetti celebration
- Daily challenge cards with bonus coin rewards
- Leaderboard comparing progress with friends (Zoo Map view)

### 👥 Social / Zoo Map
- Campus map showing friends' tigers in real time
- Friend request system
- Leaderboard ranked by coins

### 🌤️ Weather Integration *(API)*
- Live Greencastle, IN weather displayed on the home screen
- Powered by OpenWeatherMap API
- Weather affects daily activity suggestions

### 💬 Wellness Tip API *(API)*
- Daily wellness tip fetched from an external health content API
- Tips rotate daily and are contextualised to the student's OCEAN profile

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML5, CSS3, JavaScript (single-file PWA) |
| Backend | Node.js + Express.js |
| Database | Firebase Firestore (NoSQL) |
| Authentication | Firebase Auth (email/password + email verification) |
| Weather API | OpenWeatherMap API |
| Wellness Tips | API Ninjas — Health Tips endpoint |
| Hosting | Firebase Hosting |
| Version Control | Git + GitHub |

---

## Database Schema

PauwCheck uses **Firebase Firestore** with the following collections:

### `users` collection
Stores one document per registered student.

```
users/{userId}
├── name          : string       — "Lisa Pham"
├── email         : string       — "lpham@depauw.edu"
├── createdAt     : timestamp    — account creation date
├── tigerColor    : string       — "yellow" | "orange" | "green" | "pink" | "blue"
├── tigerName     : string       — "Goldie"
├── coins         : number       — 250
├── xp            : number       — 180
├── level         : number       — 2
├── streak        : number       — 7
├── equippedHat   : string|null  — "hat1"
├── equippedGlasses: string|null — null
├── equippedOutfit : string|null — "outfit2"
├── matchedCounselorId: number|null — 2
└── oceanPct      : map|null
    ├── O: number  — 72
    ├── C: number  — 55
    ├── E: number  — 38
    ├── A: number  — 81
    └── N: number  — 61
```

### `progress` subcollection
Stores daily progress per user. Document ID = date string (YYYY-MM-DD).

```
users/{userId}/progress/{dateId}
├── date          : string    — "2026-04-06"
├── actProgress   : number    — 45
├── socProgress   : number    — 20
├── schoolProgress: number    — 60
├── wbProgress    : number    — 80
├── loggedActivities: array   — ["exercise", "study", "meditation"]
└── resetAt       : timestamp — next midnight reset time
```

### `journal` subcollection
Stores each journal entry per user.

```
users/{userId}/journal/{entryId}
├── text      : string    — "Today I finished my assignment early..."
├── prompt    : string    — "What went well today?"
├── createdAt : timestamp — 2026-04-06T14:32:00Z
└── mood      : string    — optional mood tag
```

### `quizResults` subcollection
Stores each quiz attempt.

```
users/{userId}/quizResults/{resultId}
├── completedAt : timestamp
├── answers     : array[25]  — [3, 4, 2, 5, 1, ...]
├── oceanPct    : map         — { O:72, C:55, E:38, A:81, N:61 }
└── matchedCounselorId: number — 2
```

---

## API Integrations

### 1. OpenWeatherMap API — Live Weather
Displays current weather in Greencastle, IN on the home screen.

```javascript
const API_KEY = process.env.WEATHER_API_KEY;
const url = `https://api.openweathermap.org/data/2.5/weather?q=Greencastle,IN,US&appid=${API_KEY}&units=imperial`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    const temp = Math.round(data.main.temp);
    const condition = data.weather[0].description;
    // Display: "65°F — partly cloudy"
  });
```

**Get a free key:** https://openweathermap.org/api

### 2. API Ninjas — Daily Wellness Tips
Fetches a daily health/wellness tip shown on the home screen.

```javascript
const url = 'https://api.api-ninjas.com/v1/facts?category=health';
fetch(url, { headers: { 'X-Api-Key': process.env.NINJAS_API_KEY } })
  .then(res => res.json())
  .then(data => {
    // data[0].fact → display as daily tip
  });
```

**Get a free key:** https://api-ninjas.com

### 3. Firebase Auth — Email Verification
Handles real email verification (replacing the demo toast-based code).

```javascript
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";

async function doSignup(email, password) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(userCredential.user);
  // Redirect to verify screen — user must click link in email
}
```

### 4. Firebase Firestore — User Data Persistence
All user state (coins, XP, progress, journal entries) is saved to Firestore in real time.

```javascript
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";

// Save progress after activity log
async function saveProgress(userId, progressData) {
  const today = new Date().toISOString().split('T')[0];
  await setDoc(doc(db, "users", userId, "progress", today), progressData, { merge: true });
}

// Load user on login
async function loadUser(userId) {
  const snap = await getDoc(doc(db, "users", userId));
  if (snap.exists()) return snap.data();
}
```

---

## Setup & Usage Instructions

### Prerequisites

- Node.js v18 or higher
- npm v9 or higher
- A Firebase project (free tier is sufficient)
- An OpenWeatherMap API key (free tier)
- An API Ninjas key (free tier)

### 1. Clone the Repository

```bash
git clone https://github.com/[your-username]/pauwcheck.git
cd pauwcheck
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Firebase

1. Go to [https://console.firebase.google.com](https://console.firebase.google.com)
2. Create a new project named `pauwcheck`
3. Enable **Authentication** → Email/Password provider
4. Enable **Firestore Database** → Start in test mode
5. Go to Project Settings → Your apps → Add a web app
6. Copy your Firebase config object

### 4. Configure Environment Variables

Create a `.env` file in the root of the project:

```
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=pauwcheck.firebaseapp.com
FIREBASE_PROJECT_ID=pauwcheck
FIREBASE_STORAGE_BUCKET=pauwcheck.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
WEATHER_API_KEY=your_openweathermap_key
NINJAS_API_KEY=your_api_ninjas_key
```

### 5. Run Locally

```bash
npm start
```

Open `http://localhost:3000` in your browser.

### 6. Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

### Usage Flow

1. Open the app and create an account with your `@depauw.edu` email
2. Verify your email via the 6-digit code (or click the link in the real Firebase email)
3. Complete the 3-step onboarding: pick your tiger color and name it
4. Take the Big Five personality quiz (25 questions, ~5 minutes)
5. View your OCEAN profile and matched DePauw counselor
6. Log daily habits, write journal entries, and earn coins
7. Unlock wardrobe accessories for your tiger
8. Check the Zoo Map to see your friends' tigers

---

## Project Structure

```
pauwcheck/
├── index.html          # Main app (single-file HTML)
├── firebase.js         # Firebase init + Firestore helpers
├── auth.js             # Authentication logic
├── db.js               # Database read/write functions
├── api.js              # Weather + wellness tip API calls
├── .env                # Environment variables (not committed)
├── .gitignore
├── package.json
├── firebase.json       # Firebase hosting config
└── README.md
```

---

## Environment Variables

| Variable | Description | Where to get it |
|---|---|---|
| `FIREBASE_API_KEY` | Firebase project API key | Firebase Console → Project Settings |
| `FIREBASE_PROJECT_ID` | Firebase project ID | Firebase Console → Project Settings |
| `WEATHER_API_KEY` | OpenWeatherMap API key | openweathermap.org/api |
| `NINJAS_API_KEY` | API Ninjas key | api-ninjas.com |

---

## Team

Built at DePauw University Hackathon 2026

| Name | Role |
|---|---|
| [Your Name] | Full-stack development, Big Five algorithm |
| [Your Name] | UI/UX design, gamification system |
| [Your Name] | Counselor matching logic, pitch |
| [Your Name] | Database design, API integration |

---

## License

MIT License — free to use and adapt for educational purposes.

---

*PauwCheck is not a clinical tool and does not provide medical or psychological advice. If you are in crisis, please call DePauw Counseling Services at (765) 658-4268 or text HOME to 741741.*
