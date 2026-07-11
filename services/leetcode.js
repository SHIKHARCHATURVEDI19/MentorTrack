const fetch = require('node-fetch');

const LEETCODE_API_BASE = 'https://alfa-leetcode-api.onrender.com';

/**
 * Fetch LeetCode data for a given handle.
 * Combines solved stats, contest info, and submission calendar.
 */
async function fetchLeetCodeData(handle) {
  const result = {
    handle,
    totalSolved: 0,
    easySolved: 0,
    mediumSolved: 0,
    hardSolved: 0,
    contestRating: 0,
    contestRanking: 0,
    contestsAttended: 0,
    submissionCalendar: {},
    totalActiveDays: 0,
    streak: 0,
    error: false,
    errors: []
  };

  // Fetch solved data
  try {
    const solvedRes = await fetch(`${LEETCODE_API_BASE}/${encodeURIComponent(handle)}/solved`, {
      timeout: 15000
    });

    if (solvedRes.ok) {
      const solvedData = await solvedRes.json();
      result.totalSolved = solvedData.solvedProblem || solvedData.totalSolved || 0;
      result.easySolved = solvedData.easySolved || 0;
      result.mediumSolved = solvedData.mediumSolved || 0;
      result.hardSolved = solvedData.hardSolved || 0;
    } else {
      result.error = true;
      result.errors.push(`Solved API returned status ${solvedRes.status}`);
    }
  } catch (err) {
    result.error = true;
    result.errors.push(`Solved API error: ${err.message}`);
  }

  // Fetch contest data
  try {
    const contestRes = await fetch(`${LEETCODE_API_BASE}/${encodeURIComponent(handle)}/contest`, {
      timeout: 15000
    });

    if (contestRes.ok) {
      const contestData = await contestRes.json();
      result.contestRating = Math.round(contestData.contestRating || 0);
      result.contestRanking = contestData.contestGlobalRanking || contestData.contestRanking || 0;
      result.contestsAttended = contestData.contestAttend || contestData.totalParticipants || 0;
    } else {
      result.error = true;
      result.errors.push(`Contest API returned status ${contestRes.status}`);
    }
  } catch (err) {
    result.error = true;
    result.errors.push(`Contest API error: ${err.message}`);
  }

  // Fetch calendar data
  try {
    const calendarRes = await fetch(`${LEETCODE_API_BASE}/${encodeURIComponent(handle)}/calendar`, {
      timeout: 15000
    });

    if (calendarRes.ok) {
      const calendarData = await calendarRes.json();

      // Parse submission calendar - it may come as a JSON string or object
      let calendar = calendarData.submissionCalendar || {};
      if (typeof calendar === 'string') {
        try {
          calendar = JSON.parse(calendar);
        } catch (e) {
          calendar = {};
        }
      }

      result.submissionCalendar = calendar;
      result.totalActiveDays = calendarData.totalActiveDays || Object.keys(calendar).filter(k => calendar[k] > 0).length;
      result.streak = calendarData.streak || 0;
    } else {
      result.error = true;
      result.errors.push(`Calendar API returned status ${calendarRes.status}`);
    }
  } catch (err) {
    result.error = true;
    result.errors.push(`Calendar API error: ${err.message}`);
  }

  return result;
}

/**
 * Filter submission calendar to last N months.
 * Returns the number of problems solved and active days in that period.
 */
function filterByMonths(submissionCalendar, months) {
  if (!submissionCalendar || typeof submissionCalendar !== 'object') {
    return { solvedInPeriod: 0, activeDaysInPeriod: 0 };
  }

  const now = Date.now();
  const cutoff = now - (months * 30 * 24 * 60 * 60 * 1000); // approximate months in ms

  let solvedInPeriod = 0;
  let activeDaysInPeriod = 0;

  for (const [timestamp, count] of Object.entries(submissionCalendar)) {
    const ts = parseInt(timestamp, 10) * 1000; // LeetCode timestamps are in seconds
    if (ts >= cutoff) {
      solvedInPeriod += count;
      if (count > 0) {
        activeDaysInPeriod++;
      }
    }
  }

  return { solvedInPeriod, activeDaysInPeriod };
}

module.exports = { fetchLeetCodeData, filterByMonths };
