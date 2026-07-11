const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const GITHUB_API_BASE = 'https://api.github.com';
const ACTIVITY_FILE = path.join(__dirname, '..', 'data', 'github_activity.json');

// Helper to check if a date is within X days of today
function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays <= days;
}

// Helper to calculate current streak
function calculateStreak(activeDays) {
  if (!activeDays || activeDays.length === 0) return 0;
  
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if they were active today or yesterday
  const lastActive = new Date(activeDays[0]);
  lastActive.setHours(0, 0, 0, 0);
  
  const diffToToday = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
  
  // If last active was more than 1 day ago (yesterday), streak is 0
  if (diffToToday > 1) {
    return 0;
  }

  let currentDate = lastActive;
  for (const dateStr of activeDays) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    
    const diff = Math.floor((currentDate - d) / (1000 * 60 * 60 * 24));
    
    if (diff === 0) {
      // Same day (first iteration)
      streak++;
    } else if (diff === 1) {
      // Consecutive day
      streak++;
      currentDate = d;
    } else {
      // Streak broken
      break;
    }
  }
  
  return streak;
}

/**
 * Fetch basic GitHub profile and combine with local activity tracking.
 * @param {string} username - GitHub username
 * @returns {object} - Combined user data and activity metrics
 */
async function fetchGitHubData(username) {
  const result = {
    username,
    name: null,
    avatarUrl: null,
    publicRepos: 0,
    followers: 0,
    
    // Custom metrics
    lastActivityDate: null,
    activeDays30: 0,
    activeDays60: 0,
    currentStreak: 0,
    status: 'Inactive',
    lastChecked: null,
    
    error: false,
    errors: []
  };

  const headers = { 'User-Agent': 'MentorTrack-App' };

  try {
    // 1. Fetch Profile Data
    const profileRes = await fetch(`${GITHUB_API_BASE}/users/${encodeURIComponent(username)}`, { headers, timeout: 10000 });
    if (profileRes.ok) {
      const profile = await profileRes.json();
      result.name = profile.name;
      result.avatarUrl = profile.avatar_url;
      result.publicRepos = profile.public_repos;
      result.followers = profile.followers;
    } else {
      result.error = true;
      result.errors.push(`GitHub profile API returned status ${profileRes.status}`);
    }

    // 2. Load Activity Data from local file
    if (fs.existsSync(ACTIVITY_FILE)) {
      const activityData = JSON.parse(fs.readFileSync(ACTIVITY_FILE, 'utf-8'));
      // Compare lowercased username to handle case differences
      const userActivity = activityData[username.toLowerCase()];

      if (userActivity) {
        result.lastActivityDate = userActivity.lastActivityDate;
        result.lastChecked = userActivity.lastChecked;
        
        const activeDays = userActivity.activeDays || [];
        
        result.activeDays30 = activeDays.filter(d => isWithinDays(d, 30)).length;
        result.activeDays60 = activeDays.filter(d => isWithinDays(d, 60)).length;
        result.totalActiveDays = activeDays.length;
        result.contributionCalendar = userActivity.contributionCalendar || {};
        result.totalContributions = Object.values(result.contributionCalendar).reduce((a, b) => a + b, 0);
        
        result.currentStreak = calculateStreak(activeDays);
        
        // Status is active if they had activity in the last 3 days
        if (result.lastActivityDate && isWithinDays(result.lastActivityDate, 3)) {
          result.status = 'Active';
        }
      }
    }

  } catch (err) {
    result.error = true;
    result.errors.push(`GitHub integration error: ${err.message}`);
  }

  return result;
}

module.exports = { fetchGitHubData };
