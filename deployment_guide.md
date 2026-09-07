# MentorTrack: Tech Stack & Deployment Guide

## 🛠️ The Tech Stack
MentorTrack was built from the ground up to be lightning-fast, highly aesthetic, and extremely scalable.

### Frontend (Client-Side)
* **Structure:** Pure Semantic HTML5.
* **Styling:** Custom Vanilla CSS3 featuring a sleek, minimalist Vercel-inspired monochromatic dark theme.
* **Logic:** Vanilla JavaScript (ES6+). Handles DOM manipulation, file drag-and-drop, dynamic sorting, and API fetching without the overhead of heavy frameworks.

### Backend (Server-Side)
* **Runtime:** Node.js (v18+).
* **Framework:** Express.js (handles routing, static file serving, and API endpoints) configured with Serverless export for Vercel.
* **Authentication:** `jsonwebtoken` (JWT) for secure session management and `bcryptjs` for cryptographic password hashing.
* **File Processing:** `multer` (in-memory processing) and `xlsx` (for parsing student lists and generating Excel exports).
* **Storage:** Resilient Hybrid Storage (`services/db.js`) supporting pre-seeded data, local persistence, and optional Supabase cloud syncing.

---

## 🚀 How to Deploy MentorTrack to Vercel (1-Click)

The project is **100% Vercel-Ready** with native Serverless Functions (`api/index.js`), automated Cron Jobs (`api/cron.js`), and pre-configured rewrites (`vercel.json`).

### Step-by-Step Vercel Deployment:

1. **Push to GitHub:**
   All changes are committed and pushed to your repository:
   `https://github.com/SHIKHARCHATURVEDI19/MentorTrack`

2. **Open Vercel:**
   - Go to [vercel.com](https://vercel.com) and log in with your GitHub account.
   - Click **"Add New..."** → **"Project"**.
   - Select **`MentorTrack`** and click **Import**.

3. **Configure Project:**
   - **Framework Preset:** Leave as *Other* (Vercel automatically detects `vercel.json`).
   - **Root Directory:** `./` (default).
   - **Build Command:** Leave empty (default).
   - **Output Directory:** Leave empty (default).

4. **Add Environment Variables:**
   Under the **Environment Variables** section on Vercel, add:
   - `JWT_SECRET`: `mentormentee_secret_key_2024` (or your own secret)
   - *(Optional)* `SUPABASE_URL`: (Your Supabase URL if you want cloud database sync)
   - *(Optional)* `SUPABASE_SERVICE_ROLE_KEY`: (Your Supabase key)
   - *(Optional)* `CRON_SECRET`: (Random string for securing background cron trigger)

5. **Click "Deploy"!**
   - Vercel will build and launch your application in under 30 seconds.
   - You will get a live production URL like `https://mentortrack-xxxx.vercel.app`.

---

## 🌐 Alternative Deployments

### Option 2: Render.com
1. Create a **Web Service** on [Render.com](https://render.com).
2. Connect `SHIKHARCHATURVEDI19/MentorTrack`.
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Add `JWT_SECRET` in Environment variables and click Deploy.

### Option 3: VPS (Ubuntu / PM2)
```bash
git clone https://github.com/SHIKHARCHATURVEDI19/MentorTrack.git
cd MentorTrack
npm install
npm start
```
