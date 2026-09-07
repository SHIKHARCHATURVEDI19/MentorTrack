const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const supabase = require('./supabaseClient');

// Resolve data directory. In serverless read-only environments (like Vercel), fall back to /tmp/data
let DATA_DIR = path.join(__dirname, '..', 'data');
try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (e) {
  DATA_DIR = path.join('/tmp', 'data');
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
  }
}

const MENTORS_FILE = path.join(DATA_DIR, 'mentors.json');
const LC_HISTORY_FILE = path.join(DATA_DIR, 'leetcode_history.json');

// --- Circuit Breaker for Supabase ---
let supabaseAvailable = null; // null = untested, true = online, false = offline
let lastCheckTime = 0;

async function isSupabaseOnline() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes('placeholder') || url.includes('ffxgqzflztypvnbaxhvi')) {
    supabaseAvailable = false;
    return false;
  }

  const now = Date.now();
  // If tested within last 5 minutes (when offline) or 1 minute (when online), reuse status
  if (supabaseAvailable !== null && (now - lastCheckTime < (supabaseAvailable ? 60000 : 300000))) {
    return supabaseAvailable;
  }

  try {
    const res = await Promise.race([
      fetch(`${url}/rest/v1/`, { headers: { apikey: key } }).catch(() => null),
      new Promise(resolve => setTimeout(() => resolve(null), 1500))
    ]);

    supabaseAvailable = !!(res && (res.status === 200 || res.status === 401 || res.status === 403));
  } catch (err) {
    supabaseAvailable = false;
  }

  lastCheckTime = now;
  return supabaseAvailable;
}

function readJSON(file, fallback = []) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    }
  } catch (err) {
    console.warn(`[DB] Error reading ${file}:`, err.message);
  }
  return fallback;
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.warn(`[DB] Error writing ${file}:`, err.message);
    return false;
  }
}

// -------------------------------------------------------------
// Mentors
// -------------------------------------------------------------

async function findMentorByEmail(email) {
  const normEmail = String(email).trim().toLowerCase();

  // Fast check: Try Supabase only if confirmed online
  if (await isSupabaseOnline()) {
    try {
      const { data: mentor, error } = await supabase
        .from('mentors')
        .select('*')
        .eq('email', normEmail)
        .single();

      if (mentor && !error) {
        return {
          id: mentor.id,
          email: mentor.email,
          name: mentor.name,
          password_hash: mentor.password_hash || mentor.password
        };
      }
    } catch (err) {}
  }

  // Fast local JSON fallback (< 1ms)
  const mentors = readJSON(MENTORS_FILE, []);
  const local = mentors.find(m => String(m.email).trim().toLowerCase() === normEmail);
  if (local) {
    return {
      id: local.id,
      email: local.email,
      name: local.name,
      password_hash: local.password || local.password_hash
    };
  }
  return null;
}

async function findMentorById(id) {
  if (await isSupabaseOnline()) {
    try {
      const { data: mentor, error } = await supabase
        .from('mentors')
        .select('id, email, name, created_at')
        .eq('id', id)
        .single();

      if (mentor && !error) return mentor;
    } catch (err) {}
  }

  const mentors = readJSON(MENTORS_FILE, []);
  const local = mentors.find(m => String(m.id) === String(id));
  if (local) {
    return {
      id: local.id,
      email: local.email,
      name: local.name,
      created_at: local.createdAt || local.created_at
    };
  }
  return null;
}

async function createMentor({ email, name, password_hash }) {
  const normEmail = String(email).trim().toLowerCase();
  const id = String(Date.now());
  const newMentor = {
    id,
    email: normEmail,
    name: name.trim(),
    password: password_hash,
    createdAt: new Date().toISOString()
  };

  // Always persist locally
  const mentors = readJSON(MENTORS_FILE, []);
  mentors.push(newMentor);
  writeJSON(MENTORS_FILE, mentors);

  // Sync to Supabase if online
  if (await isSupabaseOnline()) {
    try {
      const { data, error } = await supabase
        .from('mentors')
        .insert([{
          id,
          email: normEmail,
          name: name.trim(),
          password_hash: password_hash
        }])
        .select()
        .single();
      if (data && !error) {
        return { id: data.id, email: data.email, name: data.name };
      }
    } catch (err) {}
  }

  return { id: newMentor.id, email: newMentor.email, name: newMentor.name };
}

// -------------------------------------------------------------
// Students
// -------------------------------------------------------------

function getStudentsFile(mentorId) {
  return path.join(DATA_DIR, `students_${mentorId}.json`);
}

async function getStudentsByMentor(mentorId) {
  if (await isSupabaseOnline()) {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('mentor_id', mentorId);

      if (data && !error && data.length > 0) {
        return data.map(s => ({
          id: s.id,
          name: s.name,
          leetcodeHandle: s.leetcode_handle || s.leetcodeHandle || '',
          githubUsername: s.github_username || s.githubUsername || ''
        }));
      }
    } catch (err) {}
  }

  const file = getStudentsFile(mentorId);
  const students = readJSON(file, []);
  return students.map((s, idx) => ({
    id: s.id || String(idx + 1),
    name: s.name || s.studentName || '',
    leetcodeHandle: s.leetcodeHandle || s.leetcode_handle || '',
    githubUsername: s.githubUsername || s.github_username || ''
  }));
}

async function saveStudents(mentorId, studentsList) {
  const normStudents = studentsList.map((s, idx) => ({
    id: s.id || String(idx + 1),
    name: String(s.name).trim(),
    leetcodeHandle: s.leetcodeHandle ? String(s.leetcodeHandle).trim() : (s.leetcode_handle ? String(s.leetcode_handle).trim() : ''),
    githubUsername: s.githubUsername ? String(s.githubUsername).trim() : (s.github_username ? String(s.github_username).trim() : '')
  }));

  // Always persist locally
  const file = getStudentsFile(mentorId);
  writeJSON(file, normStudents);

  // Sync to Supabase if online
  if (await isSupabaseOnline()) {
    try {
      await supabase.from('students').delete().eq('mentor_id', mentorId);
      const dbPayload = normStudents.map(s => ({
        mentor_id: mentorId,
        name: s.name,
        leetcode_handle: s.leetcodeHandle,
        github_username: s.githubUsername
      }));
      await supabase.from('students').insert(dbPayload);
    } catch (err) {}
  }

  return normStudents;
}

async function getAllStudents() {
  if (await isSupabaseOnline()) {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, leetcode_handle, github_username, name');

      if (data && !error && data.length > 0) {
        return data.map(s => ({
          id: s.id,
          name: s.name,
          leetcodeHandle: s.leetcode_handle,
          githubUsername: s.github_username
        }));
      }
    } catch (err) {}
  }

  const all = [];
  try {
    const files = fs.readdirSync(DATA_DIR);
    for (const f of files) {
      if (f.startsWith('students_') && f.endsWith('.json')) {
        const list = readJSON(path.join(DATA_DIR, f), []);
        all.push(...list);
      }
    }
  } catch (e) {}

  return all;
}

// -------------------------------------------------------------
// LeetCode History
// -------------------------------------------------------------

async function getLeetCodeHistory(handle) {
  const normHandle = String(handle).trim();

  if (await isSupabaseOnline()) {
    try {
      const { data: students } = await supabase
        .from('students')
        .select('id')
        .eq('leetcode_handle', normHandle);

      if (students && students.length > 0) {
        const studentIds = students.map(s => s.id);
        const { data: historyData } = await supabase
          .from('leetcode_history')
          .select('*')
          .in('student_id', studentIds);

        if (historyData && historyData.length > 0) {
          const uniqueDates = {};
          historyData.forEach(r => {
            uniqueDates[r.snapshot_date] = {
              date: r.snapshot_date,
              totalSolved: r.total_solved,
              easy: r.easy_solved,
              medium: r.medium_solved,
              hard: r.hard_solved
            };
          });
          return Object.values(uniqueDates);
        }
      }
    } catch (e) {}
  }

  const allHistory = readJSON(LC_HISTORY_FILE, {});
  const handleKey = Object.keys(allHistory).find(k => k.toLowerCase() === normHandle.toLowerCase());
  return handleKey ? (allHistory[handleKey] || []) : [];
}

async function saveLeetCodeSnapshot(handle, studentId, snapshot) {
  const normHandle = String(handle).trim();
  const today = new Date().toISOString().split('T')[0];

  const allHistory = readJSON(LC_HISTORY_FILE, {});
  const key = Object.keys(allHistory).find(k => k.toLowerCase() === normHandle.toLowerCase()) || normHandle;
  if (!allHistory[key]) allHistory[key] = [];

  const existingIdx = allHistory[key].findIndex(r => r.date === today);
  const record = {
    date: today,
    totalSolved: snapshot.totalSolved,
    easy: snapshot.easySolved,
    medium: snapshot.mediumSolved,
    hard: snapshot.hardSolved
  };

  if (existingIdx >= 0) {
    allHistory[key][existingIdx] = record;
  } else {
    allHistory[key].push(record);
  }
  writeJSON(LC_HISTORY_FILE, allHistory);

  if (studentId && await isSupabaseOnline()) {
    try {
      await supabase.from('leetcode_history').upsert({
        student_id: studentId,
        total_solved: snapshot.totalSolved,
        easy_solved: snapshot.easySolved,
        medium_solved: snapshot.mediumSolved,
        hard_solved: snapshot.hardSolved,
        snapshot_date: today
      }, { onConflict: 'student_id, snapshot_date' });
    } catch (e) {}
  }
}

module.exports = {
  findMentorByEmail,
  findMentorById,
  createMentor,
  getStudentsByMentor,
  saveStudents,
  getAllStudents,
  getLeetCodeHistory,
  saveLeetCodeSnapshot
};
