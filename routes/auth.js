const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('../middleware/auth');
const { JWT_SECRET } = require('../middleware/auth');
const supabase = require('../services/supabaseClient');

const router = express.Router();

// --- Rate Limiting Configurations ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes.' }
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many accounts created from this IP, please try again after an hour.' }
});

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { 
      expiresIn: '24h',
      issuer: 'MentorTrack',
      audience: 'MentorTrack-Users'
    }
  );
}

// POST /api/auth/signup
router.post(
  '/signup',
  signupLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required').escape(),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.warn('[AUDIT] Failed signup attempt (Validation Error)', req.ip);
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { email, password, name } = req.body;

      // Check if email already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('mentors')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        console.warn(`[AUDIT] Failed signup attempt (Email Exists): ${email}`);
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new mentor
      const { data: newMentor, error: insertError } = await supabase
        .from('mentors')
        .insert([{ email, name, password_hash: hashedPassword }])
        .select()
        .single();

      if (insertError) throw insertError;

      const token = generateToken(newMentor);
      console.log(`[AUDIT] Successful signup: ${email} (ID: ${newMentor.id})`);

      res.status(201).json({
        message: 'Account created successfully.',
        token,
        user: { id: newMentor.id, email: newMentor.email, name: newMentor.name }
      });
    } catch (err) {
      console.error('[SERVER ERROR] Signup:', err.stack || err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  loginLimiter,
  [
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.warn('[AUDIT] Failed login attempt (Validation Error)', req.ip);
        return res.status(400).json({ error: errors.array()[0].msg });
      }

      const { email, password } = req.body;

      // Find mentor by email
      const { data: mentor, error: fetchError } = await supabase
        .from('mentors')
        .select('*')
        .eq('email', email)
        .single();

      if (!mentor || fetchError) {
        console.warn(`[AUDIT] Failed login attempt (User Not Found): ${email}`);
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      // Verify password
      const isMatch = await bcrypt.compare(password, mentor.password_hash);
      if (!isMatch) {
        console.warn(`[AUDIT] Failed login attempt (Bad Password): ${email}`);
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const token = generateToken(mentor);
      console.log(`[AUDIT] Successful login: ${email} (ID: ${mentor.id})`);

      res.json({
        message: 'Login successful.',
        token,
        user: { id: mentor.id, email: mentor.email, name: mentor.name }
      });
    } catch (err) {
      console.error('[SERVER ERROR] Login:', err.stack || err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
);

// GET /api/auth/me (protected)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data: mentor, error } = await supabase
      .from('mentors')
      .select('id, email, name, created_at')
      .eq('id', req.user.id)
      .single();

    if (!mentor || error) {
      return res.status(404).json({ error: 'User not found.' });
    }

    res.json({ user: mentor });
  } catch (err) {
    console.error('[SERVER ERROR] Get user:', err.stack || err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
