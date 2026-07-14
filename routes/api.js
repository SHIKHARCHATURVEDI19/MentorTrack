const express = require('express');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const supabase = require('../services/supabaseClient');
const { fetchLeetCodeData } = require('../services/leetcode');
const { fetchGitHubData } = require('../services/github');

const router = express.Router();

// GET /api/leetcode/:handle
router.get('/leetcode/:handle', authMiddleware, async (req, res) => {
  try {
    const { handle } = req.params;

    if (!handle) {
      return res.status(400).json({ error: 'LeetCode handle is required.' });
    }

    console.log(`Fetching LeetCode data for: ${handle}`);
    const data = await fetchLeetCodeData(handle);

    // Fetch student IDs matching this handle
    const { data: students } = await supabase
      .from('students')
      .select('id')
      .eq('leetcode_handle', handle);

    let history = [];
    if (students && students.length > 0) {
      const studentIds = students.map(s => s.id);
      // Fetch history for these students
      const { data: historyData } = await supabase
        .from('leetcode_history')
        .select('*')
        .in('student_id', studentIds);
      
      if (historyData) {
        // Map to frontend expected format and deduplicate by date (in case multiple mentors track the same handle)
        const uniqueDates = {};
        historyData.forEach(record => {
          uniqueDates[record.snapshot_date] = {
            date: record.snapshot_date,
            totalSolved: record.total_solved,
            easy: record.easy_solved,
            medium: record.medium_solved,
            hard: record.hard_solved
          };
        });
        history = Object.values(uniqueDates);
      }
    }
    
    // As a fallback, check the old JSON file if Supabase has no history yet
    if (history.length === 0) {
      const historyFile = path.join(__dirname, '..', 'data', 'leetcode_history.json');
      if (fs.existsSync(historyFile)) {
        const historyData = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
        history = historyData[handle] || [];
      }
    }

    data.history = history;

    res.json(data);
  } catch (err) {
    console.error('[SERVER ERROR] LeetCode API:', err.stack || err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/github/:username
router.get('/github/:username', authMiddleware, async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ error: 'GitHub username is required.' });
    }

    console.log(`Fetching GitHub data for: ${username}`);
    const data = await fetchGitHubData(username);

    res.json(data);
  } catch (err) {
    console.error('[SERVER ERROR] GitHub API:', err.stack || err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/export (protected)
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const mentorId = req.user.id;

    // Fetch students from Supabase
    const { data: dbStudents, error } = await supabase
      .from('students')
      .select('*')
      .eq('mentor_id', mentorId);

    if (error) throw error;

    if (!dbStudents || dbStudents.length === 0) {
      return res.status(404).json({ error: 'No students found. Please upload a student list first.' });
    }

    // Map to old format for existing logic
    const students = dbStudents.map(s => ({
      name: s.name,
      leetcodeHandle: s.leetcode_handle,
      githubUsername: s.github_username
    }));

    console.log(`Generating export for ${students.length} students (mentor: ${mentorId})`);

    // Fetch all data in parallel
    const leetcodePromises = students.map(s =>
      s.leetcodeHandle
        ? fetchLeetCodeData(s.leetcodeHandle).catch(err => ({
            handle: s.leetcodeHandle, error: true, errors: [err.message]
          }))
        : Promise.resolve(null)
    );

    const githubPromises = students.map(s =>
      s.githubUsername
        ? fetchGitHubData(s.githubUsername).catch(err => ({
            username: s.githubUsername, error: true, errors: [err.message]
          }))
        : Promise.resolve(null)
    );

    const [leetcodeResults, githubResults] = await Promise.all([
      Promise.all(leetcodePromises),
      Promise.all(githubPromises)
    ]);

    // Build LeetCode sheet data
    const leetcodeRows = students.map((student, i) => {
      const lc = leetcodeResults[i];
      return {
        'Name': student.name,
        'Handle': student.leetcodeHandle || 'N/A',
        'Rating': lc ? lc.contestRating : 'N/A',
        'Total Solved': lc ? lc.totalSolved : 'N/A',
        'Easy': lc ? lc.easySolved : 'N/A',
        'Medium': lc ? lc.mediumSolved : 'N/A',
        'Hard': lc ? lc.hardSolved : 'N/A',
        'Active Days': lc ? lc.totalActiveDays : 'N/A',
        'Streak': lc ? lc.streak : 'N/A'
      };
    });

    // Build GitHub sheet data
    const githubRows = students.map((student, i) => {
      const gh = githubResults[i];
      return {
        'Name': student.name,
        'Username': student.githubUsername || 'N/A',
        'Status': gh ? gh.status : 'N/A',
        'Last Activity': gh ? gh.lastActivityDate || 'None' : 'N/A',
        'Active Days (30d)': gh ? gh.activeDays30 : 'N/A',
        'Active Days (60d)': gh ? gh.activeDays60 : 'N/A',
        'Current Streak': gh ? gh.currentStreak : 'N/A',
        'Public Repos': gh ? gh.publicRepos : 'N/A',
        'Last Checked': gh ? gh.lastChecked || 'Never' : 'N/A'
      };
    });

    // Create Excel workbook
    const workbook = xlsx.utils.book_new();

    const leetcodeSheet = xlsx.utils.json_to_sheet(leetcodeRows);
    xlsx.utils.book_append_sheet(workbook, leetcodeSheet, 'LeetCode');

    const githubSheet = xlsx.utils.json_to_sheet(githubRows);
    xlsx.utils.book_append_sheet(workbook, githubSheet, 'GitHub');

    // Generate buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    const filename = `mentor_report_${Date.now()}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);

    console.log(`Export complete: ${filename}`);
  } catch (err) {
    console.error('Export error:', err.message);
    res.status(500).json({ error: 'Failed to generate export.', message: err.message });
  }
});

module.exports = router;
