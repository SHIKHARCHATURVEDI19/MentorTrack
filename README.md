# 🎓 MentorTrack

MentorTrack is a high-performance, enterprise-grade tracking platform designed for college mentors. It allows mentors to automatically track, monitor, and export the real-time coding progress of their students across LeetCode and GitHub. 

Built with an intense focus on security, scalable architecture, and zero-dependency frontend performance.

## 🚀 Features
- **Automated Tracking**: Automatically scrapes and parses real-time data from LeetCode and GitHub.
- **Bulk Uploads**: Upload an Excel `.xlsx` sheet of your students to instantly track the entire class.
- **Historical Analysis**: A custom background Cron-Job engine takes daily snapshots of student progress to map historical growth.
- **Excel Exports**: Generate comprehensive, formatted Excel reports of your mentees' progress with a single click.
- **Bespoke UI**: A lightning-fast, zero-framework Vanilla CSS design system featuring glassmorphism and modern micro-animations.

## 🛡️ Enterprise Security Architecture
MentorTrack was rigorously audited and fortified against modern web vulnerabilities:
- **Stateless Authentication**: Powered by JWT (JSON Web Tokens) with strict Audience (`aud`), Issuer (`iss`), and 24-hour expiration claims.
- **Database IDOR Protection**: Migrated to Supabase PostgreSQL with strict Foreign Key constraints ensuring mentors can *only* access their own students' data.
- **Rate Limiting**: `express-rate-limit` actively throttles authentication endpoints to prevent brute-force and spam attacks.
- **HTTP Hardening**: Powered by `helmet` to automatically inject 14 distinct HTTP security headers (HSTS, XSS-Protection, Frame-Options).
- **Input Sanitization**: `express-validator` strictly enforces email formats, password strengths, and sanitizes input to prevent XSS.

## 🛠️ Tech Stack
- **Frontend**: Pure Semantic HTML5, Custom Vanilla CSS3, Vanilla ES6+ JavaScript
- **Backend**: Node.js, Express.js
- **Database**: Supabase (PostgreSQL)
- **Security**: bcryptjs, jsonwebtoken, express-validator, express-rate-limit, helmet
- **File Processing**: multer, xlsx

---

## 💻 Local Development Setup

### 1. Prerequisites
- Node.js (v18+)
- A free [Supabase](https://supabase.com/) account.

### 2. Clone the Repository
```bash
git clone https://github.com/yourusername/mentormentee.git
cd mentormentee
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Database Setup (Supabase)
1. Create a new project on Supabase.
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Run the following script to create the relational tables:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE mentors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES mentors(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    leetcode_handle TEXT,
    github_username TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE leetcode_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    total_solved INTEGER DEFAULT 0,
    easy_solved INTEGER DEFAULT 0,
    medium_solved INTEGER DEFAULT 0,
    hard_solved INTEGER DEFAULT 0,
    snapshot_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(student_id, snapshot_date)
);
```

### 5. Environment Variables
Create a `.env` file in the root directory and add the following:
```env
PORT=3000
JWT_SECRET=your_super_secret_jwt_key_here
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_secret_key
```

### 6. Run the Application
```bash
npm start
```
The server will start on `http://localhost:3000`.

---
*Built for scale. Built for speed. Built for security.*
