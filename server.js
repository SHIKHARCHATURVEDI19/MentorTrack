require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure data/ and uploads/ directories exist (skip on Vercel Serverless)
if (!process.env.VERCEL) {
  const dataDir = path.join(__dirname, 'data');
  const uploadsDir = path.join(__dirname, 'uploads');

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data/ directory');
  }

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads/ directory');
  }

  // Initialize data/mentors.json if it doesn't exist
  const mentorsFile = path.join(dataDir, 'mentors.json');
  if (!fs.existsSync(mentorsFile)) {
    fs.writeFileSync(mentorsFile, JSON.stringify([], null, 2));
    console.log('Initialized data/mentors.json');
  }
}

// Security & Middleware
app.use(helmet({
  contentSecurityPolicy: false // Disabled to allow inline styles/scripts for now
}));

const isProd = process.env.NODE_ENV === 'production';
const customAllowed = ['https://mentortrack.glbitm.ac.in', 'https://mentormentee.onrender.com'];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (!isProd) return callback(null, true); // Always allow in dev/local
    if (origin.includes('localhost') || origin.includes('127.0.0.1') || origin.endsWith('.vercel.app') || origin.endsWith('.onrender.com') || customAllowed.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Serve static files from ./public
app.use(express.static(path.join(__dirname, 'public')));

// Mount routes
const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const apiRoutes = require('./routes/api');

app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes);
app.use('/api', apiRoutes);

// Global error handler
app.use((err, req, res, next) => {
  // Log the real error internally for audit
  console.error('[SERVER ERROR]', err.stack || err.message);
  
  // Return generic error to client
  res.status(500).json({ message: 'Internal Server Error' });
});

if (require.main === module && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Mentor-Mentee Tracker server running on http://localhost:${PORT}`);
    
    // Start background monitoring jobs only if not on Vercel
    require('./services/cron').startJob();
  });
}

// Export for Vercel
module.exports = app;
