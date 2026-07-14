const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const supabase = require('../services/supabaseClient');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel' // .xls
  ];
  const allowedExtensions = ['.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .xlsx and .xls files are allowed.'), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

/**
 * Flexibly match column names by trimming whitespace and doing case-insensitive comparison.
 * Returns the actual header key that matches, or null.
 */
function findColumn(headers, ...possibleNames) {
  for (const header of headers) {
    const normalized = header.trim().toLowerCase().replace(/[_\-]/g, ' ');
    for (const name of possibleNames) {
      if (normalized === name.toLowerCase()) {
        return header;
      }
    }
  }
  return null;
}

// POST /api/upload (protected)
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please upload an .xlsx or .xls file.' });
    }

    // Parse the Excel file
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet);

    if (rawData.length === 0) {
      return res.status(400).json({ error: 'The uploaded file contains no data.' });
    }

    // Get headers from the first row
    const headers = Object.keys(rawData[0]);

    // Flexibly find the column names
    const nameCol = findColumn(headers,
      'student name', 'name', 'student', 'full name', 'studentname'
    );
    const leetcodeCol = findColumn(headers,
      'leetcode handle', 'leetcode', 'leetcode username', 'leetcode id',
      'lc handle', 'leetcodehandle', 'lc username'
    );
    const githubCol = findColumn(headers,
      'github username', 'github', 'github handle', 'github id',
      'githubusername', 'github user', 'gh username'
    );

    if (!nameCol) {
      return res.status(400).json({
        error: 'Could not find a "Student Name" column. Available columns: ' + headers.join(', ')
      });
    }

    const mentorId = req.user.id;

    // Parse students to match DB schema
    const studentsToInsert = rawData
      .filter(row => row[nameCol] && String(row[nameCol]).trim() !== '')
      .map((row) => ({
        mentor_id: mentorId,
        name: String(row[nameCol]).trim(),
        leetcode_handle: leetcodeCol && row[leetcodeCol] ? String(row[leetcodeCol]).trim() : null,
        github_username: githubCol && row[githubCol] ? String(row[githubCol]).trim() : null
      }));

    if (studentsToInsert.length === 0) {
      return res.status(400).json({ error: 'No valid students found in the file.' });
    }

    // Delete existing students for this mentor (to match previous file overwrite behavior)
    await supabase.from('students').delete().eq('mentor_id', mentorId);

    // Bulk insert new students
    const { data: insertedStudents, error: insertError } = await supabase
      .from('students')
      .insert(studentsToInsert)
      .select();

    if (insertError) throw insertError;

    // Delete uploaded file after processing
    fs.unlinkSync(req.file.path);

    console.log(`Uploaded ${insertedStudents.length} students for mentor ${mentorId}`);

    // Map inserted students back to frontend expected format
    const students = insertedStudents.map(s => ({
      id: s.id,
      name: s.name,
      leetcodeHandle: s.leetcode_handle || '',
      githubUsername: s.github_username || ''
    }));

    res.json({
      message: `Successfully parsed ${students.length} students.`,
      students,
      columnsFound: {
        name: nameCol || null,
        leetcode: leetcodeCol || null,
        github: githubCol || null
      }
    });
  } catch (err) {
    console.error('[SERVER ERROR] Upload:', err.stack || err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/students (protected)
router.get('/students', authMiddleware, async (req, res) => {
  try {
    const mentorId = req.user.id;

    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('mentor_id', mentorId);

    if (error) throw error;

    // Map DB columns to frontend expected format
    const students = data.map(s => ({
      id: s.id,
      name: s.name,
      leetcodeHandle: s.leetcode_handle || '',
      githubUsername: s.github_username || ''
    }));

    res.json({ students });
  } catch (err) {
    console.error('[SERVER ERROR] Get students:', err.stack || err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
