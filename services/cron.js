const fetch = require('node-fetch');
const { fetchLeetCodeData } = require('./leetcode');
const db = require('./db');

// Process LeetCode history for a student
async function processLeetCodeUser(student) {
  const handle = student.leetcodeHandle || student.leetcode_handle;
  if (!handle) return;
  
  console.log(`[Cron] Processing LeetCode history for: ${handle}`);
  
  try {
    const lcData = await fetchLeetCodeData(handle);
    if (lcData.error) {
      console.log(`[Cron] LeetCode fetch error for ${handle}`);
      return;
    }

    await db.saveLeetCodeSnapshot(handle, student.id, lcData);
    console.log(`[Cron] ${handle} LC processed. Total solved: ${lcData.totalSolved}`);
  } catch (err) {
    console.error(`[Cron] Failed to process LC for ${handle}:`, err.message);
  }
}

async function runCronJob() {
  console.log(`\n--- [Cron] Starting Background Tracking (${new Date().toISOString()}) ---`);

  try {
    const students = await db.getAllStudents();

    if (!students || students.length === 0) {
      console.log('[Cron] No students found. Exiting.');
      return;
    }

    const uniqueLCHandles = new Set();
    for (const student of students) {
      const handle = student.leetcodeHandle || student.leetcode_handle;
      if (handle && !uniqueLCHandles.has(handle.toLowerCase())) {
        uniqueLCHandles.add(handle.toLowerCase());
        await processLeetCodeUser(student);
        // Wait 2 seconds to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
      }
    }
  } catch (err) {
    console.error('[Cron] Error:', err.message);
  }

  console.log(`--- [Cron] Background Tracking Complete ---\n`);
}

function startJob() {
  const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  
  // Run in background after 5 seconds to let server finish startup
  setTimeout(() => {
    runCronJob();
  }, 5000);
  
  // Schedule repeated runs
  setInterval(runCronJob, INTERVAL_MS);
  
  console.log('[Cron] Background monitoring scheduled (Runs every 6 hours).');
}

module.exports = {
  startJob,
  runCronJob
};
