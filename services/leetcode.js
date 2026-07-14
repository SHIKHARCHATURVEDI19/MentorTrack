const fetch = require('node-fetch');

/**
 * Fetch LeetCode data using the official LeetCode GraphQL API.
 * This is significantly more reliable than 3rd party proxy APIs.
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

  const query = `
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        submitStats: submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
          }
        }
        userCalendar {
          streak
          totalActiveDays
          submissionCalendar
        }
      }
      userContestRanking(username: $username) {
        attendedContestsCount
        rating
        globalRanking
      }
    }
  `;

  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) MentorTrack/1.0'
      },
      body: JSON.stringify({
        query,
        variables: { username: handle }
      }),
      timeout: 10000
    });

    if (!res.ok) {
      result.error = true;
      result.errors.push(`GraphQL API returned status ${res.status}`);
      return result;
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      result.error = true;
      result.errors.push('Invalid JSON from LeetCode');
      return result;
    }

    if (data.errors) {
      result.error = true;
      result.errors.push(data.errors[0].message);
      return result;
    }

    const user = data?.data?.matchedUser;
    const contest = data?.data?.userContestRanking;
    const calendar = user?.userCalendar;

    if (user && user.submitStats) {
      const stats = user.submitStats.acSubmissionNum;
      result.totalSolved = stats.find(s => s.difficulty === 'All')?.count || 0;
      result.easySolved = stats.find(s => s.difficulty === 'Easy')?.count || 0;
      result.mediumSolved = stats.find(s => s.difficulty === 'Medium')?.count || 0;
      result.hardSolved = stats.find(s => s.difficulty === 'Hard')?.count || 0;
    }

    if (contest) {
      result.contestRating = Math.round(contest.rating || 0);
      result.contestRanking = contest.globalRanking || 0;
      result.contestsAttended = contest.attendedContestsCount || 0;
    }

    if (calendar) {
      result.streak = calendar.streak || 0;
      result.totalActiveDays = calendar.totalActiveDays || 0;
      try {
        result.submissionCalendar = JSON.parse(calendar.submissionCalendar || '{}');
      } catch (e) {
        result.submissionCalendar = {};
      }
    }

  } catch (err) {
    result.error = true;
    result.errors.push(`API Request failed: ${err.message}`);
  }

  return result;
}

module.exports = { fetchLeetCodeData };
