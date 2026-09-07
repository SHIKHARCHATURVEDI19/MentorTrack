const express = require('express');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/auth');
const db = require('../services/db');
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

    // Fetch history from resilient storage
    const history = await db.getLeetCodeHistory(handle);
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

    // Fetch students from resilient storage
    const students = await db.getStudentsByMentor(mentorId);

    if (!students || students.length === 0) {
      return res.status(404).json({ error: 'No students found. Please upload a student list first.' });
    }

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
