# FocusFlow ⚡ — Personal Productivity Suite

FocusFlow is a modern full-stack productivity command center that integrates calendar management, task tracking, smart notifications, and an AI-powered scheduling assistant with a companion Chrome extension.

---

## 🌟 Key Features

- **Interactive Calendar**: Full month, week, and day views with seamless time-slot navigation and color-coded event tags.
- **AI Scheduling Assistant**: Natural language voice and text input powered by Google Gemini with multi-turn conversation context and conflict-resolution suggestions.
- **Task Management**: Priority-based task tracking with status workflows and deadline alerts.
- **Smart Conflict Detection**: Proactively detects overlapping events and recommends open alternate time slots.
- **Chrome Companion Extension**: One-click event scraper for **Luma** and **Meetup**, plus quick-view agenda directly from the browser toolbar.
- **Fast & Responsive**: Built with React, Tailwind CSS, and optimized Express API.

---

## 🚀 Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend**: Node.js, Express, TypeScript, Prisma ORM, JWT Authentication
- **AI Engine**: Google GenAI SDK (Gemini 3.5 Flash Lite)
- **Extension**: Chrome Manifest V3, Vanilla JS / CSS

---

## 📂 Project Structure

```
focusflow/
├── frontend/           # Vite + React web application
│   ├── src/
│   │   ├── components/ # Reusable UI components (QuickAddBar, Layout, Bell, etc.)
│   │   ├── contexts/   # Auth and state management
│   │   ├── pages/      # Dashboard, Calendar, Tasks, Settings, Auth
│   │   └── lib/        # API client & Axios configuration
│   └── vercel.json     # Vercel SPA routing configuration
├── backend/            # Express REST API
│   ├── src/
│   │   ├── routes/     # Auth, Events, Tasks, Reminders, AI
│   │   ├── services/   # Gemini AI integration & heuristic fallback
│   │   ├── middleware/ # JWT authentication & validation
│   │   └── lib/        # Prisma client & persistent dev store
│   └── prisma/         # PostgreSQL schema & migrations
└── extension/          # Manifest V3 Chrome Extension
    ├── content.js      # Luma & Meetup scraper
    ├── popup.html/js   # Toolbar extension interface
    └── manifest.json   # Chrome MV3 extension configuration
```

---

## 🛠️ Local Development

### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env   # Configure GEMINI_API_KEY and JWT_SECRET
npm run build
npm run start
```
*API runs on `http://localhost:3001`*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Web app runs on `http://localhost:5173`*

### 3. Chrome Extension
1. Open `chrome://extensions` in Google Chrome.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `/extension` directory.

---

## ☁️ Deployment

### 1. Backend (Render / Railway)
- **Root Directory**: `backend`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Environment Variables**:
  - `NODE_ENV` = `production`
  - `PORT` = `3001`
  - `JWT_SECRET` = `[your-secret]`
  - `GEMINI_API_KEY` = `[your-gemini-key]`

### 2. Frontend (Vercel)
- **Root Directory**: `frontend`
- **Framework Preset**: `Vite`
- **Environment Variables**:
  - `VITE_API_URL` = `https://[your-backend-url]`

---

## 📄 License
MIT License
