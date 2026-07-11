const fetch = require('node-fetch');
const { fetchLeetCodeData } = require('./leetcode');
const supabase = require('./supabaseClient');

// Process LeetCode history for a student
async function processLeetCodeUser(student) {
  const handle = student.leetcode_handle;
  if (!handle) return;
  
  console.log(`[Cron] Processing LeetCode history for: ${handle} (Student ID: ${student.id})`);
  
  try {
    const lcData = await fetchLeetCodeData(handle);
    if (lcData.error) {
      console.log(`[Cron] LeetCode fetch error for ${handle}`);
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Upsert snapshot (since we have a unique constraint on student_id + snapshot_date)
    const { error } = await supabase
      .from('leetcode_history')
      .upsert({
        student_id: student.id,
        total_solved: lcData.totalSolved,
        easy_solved: lcData.easySolved,
        medium_solved: lcData.mediumSolved,
        hard_solved: lcData.hardSolved,
        snapshot_date: today
      }, { onConflict: 'student_id, snapshot_date' });

    if (error) throw error;

    console.log(`[Cron] ${handle} LC processed. Total solved: ${lcData.totalSolved}`);
  } catch (err) {
    console.error(`[Cron] Failed to process LC for ${handle}:`, err.message);
  }
}

async function runCronJob() {
  console.log(`\n--- [Cron] Starting Background Tracking (${new Date().toISOString()}) ---`);

  try {
    // 1. Fetch all distinct students from Supabase
    const { data: students, error } = await supabase
      .from('students')
      .select('id, leetcode_handle, github_username');

    if (error) throw error;
    if (!students || students.length === 0) {
      console.log('[Cron] No students found in database. Exiting.');
      return;
    }

    // 2. Process LeetCode
    // We only process one of each unique handle to avoid spamming the API
    const uniqueLCHandles = new Set();
    for (const student of students) {
      if (student.leetcode_handle && !uniqueLCHandles.has(student.leetcode_handle)) {
        uniqueLCHandles.add(student.leetcode_handle);
        await processLeetCodeUser(student);
        // Wait 2 seconds to avoid rate limits
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    // (GitHub processing can be added similarly with a github_history table)
    
  } catch (err) {
    console.error('[Cron] Fatal error:', err.message);
  }

  console.log(`--- [Cron] Background Tracking Complete ---\n`);
}

function startJob() {
  const INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
  
  // Run immediately on start
  runCronJob();
  
  // Schedule repeated runs
  setInterval(runCronJob, INTERVAL_MS);
  
  console.log('[Cron] Background monitoring scheduled (Runs every 6 hours using Supabase).');
}

module.exports = {
  startJob,
  runCronJob
};
