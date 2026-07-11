# Mentor-Mentee Tracker — Project Brain 🧠

## Project Overview
A web application that helps mentors track and monitor their mentees' coding progress across **LeetCode** and **GitHub** platforms.

## Core Workflow
1. **Mentor Sign-In** → Mentor logs in to the platform
2. **PDF Upload** → Mentor uploads a PDF containing student info (names, LeetCode handles, GitHub usernames)
3. **Data Extraction** → System parses the PDF and extracts student handles
4. **API Fetching** → System fetches live data from LeetCode and GitHub APIs
5. **Dashboard Display** → Data shown in a rich, filterable sheet/table format
6. **Report Export** → Mentor can export the full report

---

## Features

### 🔐 Authentication
- Mentor sign-in (email/password)
- Session management
- Protected routes

### 📄 Excel Upload & Parsing
- Upload Excel sheet (.xlsx/.xls) with student info
- Extract columns: Student Name, LeetCode Handle, GitHub Username
- Flexible column name matching (case-insensitive, trimmed)
- Store parsed data for future use

### 📊 LeetCode Dashboard
| Data Point | Description |
|---|---|
| Rating | Contest rating of the student |
| Questions Solved | Total (Easy/Medium/Hard breakdown) |
| Recent Activity | Submissions filtered by time period |

**Filters:** Last 1 month, 2 months, 3 months, 6 months, 1 year, All time

### 🐙 GitHub Dashboard
| Data Point | Description |
|---|---|
| Contributions | Total commits, PRs, issues |
| Active Days | Days with at least 1 contribution |
| Contribution Graph | Visual heatmap-style display |

**Filters:** Last 1 month, 2 months, 3 months, 6 months, 1 year, All time

### 📥 Export
- Export full report as Excel/CSV
- Include all student data with current filters applied

---

## Tech Stack (Planned)
- **Frontend:** HTML, CSS, JavaScript (Vanilla — premium UI)
- **Backend:** Node.js with Express
- **Database:** JSON file-based / SQLite for simplicity
- **PDF Parsing:** pdf-parse / pdf.js
- **APIs:** LeetCode GraphQL, GitHub REST/GraphQL API
- **Export:** xlsx / csv generation

---

## API Details

### LeetCode
- **Endpoint:** `https://leetcode.com/graphql` or third-party proxy like `alfa-leetcode-api`
- **Data:** User profile, contest rating, solved count, submission calendar
- **Auth:** No auth needed for public profiles

### GitHub
- **Endpoint:** `https://api.github.com/users/{username}` + GraphQL for contributions
- **Data:** Contribution count, active days, repos
- **Auth:** Optional (higher rate limits with token)

---

## File Structure (Planned)
```
mentormentee/
├── brain.md                 # This file — project knowledge base
├── package.json
├── server.js                # Express backend
├── public/
│   ├── index.html           # Landing / Sign-in page
│   ├── dashboard.html       # Main dashboard
│   ├── css/
│   │   └── style.css        # Premium styling
│   └── js/
│       ├── app.js           # Main app logic
│       ├── auth.js          # Authentication
│       ├── pdf-parser.js    # PDF upload & parsing
│       ├── leetcode.js      # LeetCode API integration
│       ├── github.js        # GitHub API integration
│       └── export.js        # Report export
├── routes/
│   ├── auth.js
│   ├── upload.js
│   ├── leetcode.js
│   └── github.js
├── data/                    # Stored mentor/student data
│   └── mentors.json
└── uploads/                 # Uploaded PDFs
```

---

## Status
- [x] Project initialized
- [x] Brain.md created
- [ ] Implementation plan created
- [ ] Backend setup
- [ ] Frontend setup
- [ ] PDF parsing
- [ ] LeetCode integration
- [ ] GitHub integration
- [ ] Dashboard UI
- [ ] Export feature
- [ ] Testing & polish

---

## Notes
- LeetCode doesn't have an official public API — we'll use their GraphQL endpoint or a proxy API
- GitHub has rate limits (60 req/hr unauthenticated, 5000 req/hr with token)
- PDF format should be standardized for reliable parsing
