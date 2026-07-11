/* =========================================================
   MentorTrack — Dashboard Logic
   ========================================================= */

(function () {
  'use strict';

  // ==========================
  //  Constants & State
  // ==========================
  const API = '';                     // same-origin
  const token = localStorage.getItem('mentorToken');

  // Auth guard
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  const headers = () => ({
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json',
  });

  // Global application state
  const state = {
    mentor: null,
    students: [],
    leetcodeData: {},   // keyed by student id
    githubData: {},     // keyed by student id
    currentView: 'leetcode',
    currentFilter: 0,   // 0 = All
    sort: {
      leetcode: { key: 'rating', dir: 'desc' },
      github:   { key: 'contributions', dir: 'desc' },
    },
    selectedFile: null,
  };

  // ==========================
  //  DOM References
  // ==========================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const DOM = {
    // Sidebar
    sidebar:        $('#sidebar'),
    sidebarToggle:  $('#sidebarToggle'),
    sidebarOverlay: $('#sidebarOverlay'),
    userName:       $('#userName'),
    userAvatar:     $('#userAvatar'),
    logoutBtn:      $('#logoutBtn'),
    navItems:       $$('.nav-item'),

    // Pages
    pageDashboard:  $('#pageDashboard'),
    pageUpload:     $('#pageUpload'),
    pageSettings:   $('#pageSettings'),
    pageTitle:      $('#pageTitle'),
    exportBtn:      $('#exportBtn'),

    // Stats
    statStudents:   $('#statStudents'),
    statRating:     $('#statRating'),
    statContrib:    $('#statContrib'),
    statActive:     $('#statActive'),

    // Empty / Upload
    emptyState:     $('#emptyState'),
    uploadZone:     $('#uploadZone'),
    fileInput:      $('#fileInput'),
    uploadBtn:      $('#uploadBtn'),
    uploadZone2:    $('#uploadZone2'),
    fileInput2:     $('#fileInput2'),
    uploadBtn2:     $('#uploadBtn2'),

    // Filters & Tables
    filterSection:  $('#filterSection'),
    timePills:      $$('#timePills .filter-pill'),
    viewTabs:       $$('#viewTabs .view-tab'),
    leetcodeWrap:   $('#leetcodeTableWrap'),
    githubWrap:     $('#githubTableWrap'),
    leetcodeBody:   $('#leetcodeBody'),
    githubBody:     $('#githubBody'),
    leetcodeTable:  $('#leetcodeTable'),
    githubTable:    $('#githubTable'),

    // Settings
    ghToken:        $('#ghToken'),
    saveTokenBtn:   $('#saveTokenBtn'),
    settingName:    $('#settingName'),
    settingEmail:   $('#settingEmail'),

    // Toast
    toastContainer: $('#toastContainer'),
  };

  // ==========================
  //  Initialization
  // ==========================
  async function init() {
    bindEvents();
    await loadMentor();
    await loadStudents();
  }

  async function loadMentor() {
    try {
      const res = await fetch(API + '/api/auth/me', { headers: headers() });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      const user = data.user || data;
      state.mentor = user;
      DOM.userName.textContent = user.name || user.email;
      DOM.userAvatar.textContent = (user.name || user.email || 'M').charAt(0).toUpperCase();
      if (DOM.settingName)  DOM.settingName.value  = user.name  || '';
      if (DOM.settingEmail) DOM.settingEmail.value  = user.email || '';
    } catch (err) {
      // Token might be invalid
      localStorage.removeItem('token');
      window.location.href = 'login.html';
    }
  }

  async function loadStudents() {
    try {
      const res = await fetch(API + '/api/students', { headers: headers() });
      if (!res.ok) throw new Error('Failed to load students');
      const data = await res.json();
      state.students = Array.isArray(data) ? data : (data.students || []);

      if (state.students.length === 0) {
        showEmptyState();
      } else {
        showDataState();
        await fetchAllData();
      }
    } catch (err) {
      showEmptyState();
    }
  }

  function showEmptyState() {
    DOM.emptyState.classList.remove('hidden');
    DOM.filterSection.classList.add('hidden');
    updateStats();
  }

  function showDataState() {
    DOM.emptyState.classList.add('hidden');
    DOM.filterSection.classList.remove('hidden');
  }

  // ==========================
  //  Data Fetching
  // ==========================
  async function fetchAllData() {
    // Show loading skeletons
    showLoadingSkeleton(DOM.leetcodeBody, 10, 10);
    showLoadingSkeleton(DOM.githubBody, 10, 9);

    // Fetch LeetCode data in parallel
    const lcPromises = state.students.map(s =>
      fetch(API + '/api/leetcode/' + encodeURIComponent(s.leetcodeHandle || s.leetcode_handle || ''), { headers: headers() })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) state.leetcodeData[s._id || s.id] = d; })
        .catch(() => {})
    );

    // Fetch GitHub data in parallel
    const ghPromises = state.students.map(s =>
      fetch(API + '/api/github/' + encodeURIComponent(s.githubUsername || s.github_username || ''), { headers: headers() })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) state.githubData[s._id || s.id] = d; })
        .catch(() => {})
    );

    await Promise.allSettled([...lcPromises, ...ghPromises]);

    renderCurrentView();
    updateStats();
  }

  // ==========================
  //  Rendering — LeetCode Table
  // ==========================
  function renderLeetCodeTable() {
    const filterDays = state.currentFilter; // Now this is in days
    const sortCfg = state.sort.leetcode;

    let rows = state.students.map((s, i) => {
      const id = s._id || s.id;
      const lc = state.leetcodeData[id] || {};

      let activeDays = lc.totalActiveDays || lc.activeDays || 0;
      let totalSolved = lc.totalSolved || 0;
      let easy = lc.easySolved || 0;
      let medium = lc.mediumSolved || 0;
      let hard = lc.hardSolved || 0;
      let submissionsPeriod = 0;
      let solvedGrowth = 0; // The +X value
      
      const isFiltered = filterDays > 0;

      if (isFiltered) {
        // Filter the heatmap/calendar
        if (lc.submissionCalendar) {
          const filtered = filterCalendarByDays(lc.submissionCalendar, filterDays);
          activeDays = filtered.activeDays;
          submissionsPeriod = filtered.totalSubmissions;
        }

        // Calculate historical growth from our custom tracker
        if (lc.history && lc.history.length > 0) {
          const now = new Date();
          const targetDate = new Date(now.getTime() - (filterDays * 24 * 60 * 60 * 1000));
          
          // Find the history record closest to the target date (but not before it, or just the oldest available in that range)
          // Since history is sorted chronologically (or we can just find the first record >= targetDate)
          let closestRecord = null;
          let minDiff = Infinity;
          
          lc.history.forEach(record => {
            const recordDate = new Date(record.date);
            // We want the record that is closest to our cutoff targetDate
            const diff = Math.abs(recordDate - targetDate);
            if (diff < minDiff) {
              minDiff = diff;
              closestRecord = record;
            }
          });

          if (closestRecord) {
            solvedGrowth = Math.max(0, totalSolved - closestRecord.totalSolved);
          }
        }
      }

      return {
        name: s.name || s.studentName || '',
        handle: s.leetcodeHandle || s.leetcode_handle || '',
        rating: lc.contestRating || lc.rating || 0,
        totalSolved,
        submissionsPeriod,
        solvedGrowth,
        easy,
        medium,
        hard,
        activeDays,
        streak: lc.streak || 0,
        rank: 0,
      };
    });

    // Sort
    rows.sort((a, b) => {
      let key = sortCfg.key;
      // If filtering and sorting by totalSolved, sort by submissionsPeriod (or growth if preferred, but submissions is what we show as primary)
      if (filterDays > 0 && key === 'totalSolved') {
        key = 'submissionsPeriod';
      }

      let va = a[key];
      let vb = b[key];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortCfg.dir === 'asc' ? -1 : 1;
      if (va > vb) return sortCfg.dir === 'asc' ? 1 : -1;
      return 0;
    });

    // Assign ranks
    rows.forEach((r, i) => r.rank = i + 1);

    const isFiltered = filterDays > 0;

    // Build Table Header dynamically
    DOM.leetcodeTable.querySelector('thead').innerHTML = `
      <tr>
        <th class="col-rank" data-sort="rank">#</th>
        <th data-sort="name">Student Name <span class="sort-arrow">▲</span></th>
        <th data-sort="handle">Handle <span class="sort-arrow">▲</span></th>
        <th data-sort="rating">Rating <span class="sort-arrow">▲</span></th>
        <th data-sort="totalSolved">${isFiltered ? 'Submissions' : 'Total Solved'} <span class="sort-arrow">▲</span></th>
        ${isFiltered ? `<th data-sort="solvedGrowth">Growth <span class="sort-arrow">▲</span></th>` : ''}
        ${!isFiltered ? `<th data-sort="easy">Easy <span class="sort-arrow">▲</span></th>` : ''}
        ${!isFiltered ? `<th data-sort="medium">Medium <span class="sort-arrow">▲</span></th>` : ''}
        ${!isFiltered ? `<th data-sort="hard">Hard <span class="sort-arrow">▲</span></th>` : ''}
        <th data-sort="activeDays">Active Days <span class="sort-arrow">▲</span></th>
        <th data-sort="streak">Streak <span class="sort-arrow">▲</span></th>
      </tr>
    `;

    // Re-bind sort events to the new headers
    DOM.leetcodeTable.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => handleSort('leetcode', th.dataset.sort));
    });

    // Build HTML
    if (rows.length === 0) {
      DOM.leetcodeBody.innerHTML = `
        <tr><td colspan="11" class="table-empty">
          <div class="empty-icon">📋</div>
          <p>No student data available</p>
        </td></tr>`;
      return;
    }

    DOM.leetcodeBody.innerHTML = rows.map(r => `
      <tr>
        <td class="col-rank">${r.rank}</td>
        <td class="col-name">${escapeHtml(r.name)}</td>
        <td class="col-handle"><a href="https://leetcode.com/u/${escapeHtml(r.handle)}" target="_blank" class="profile-link" title="Open LeetCode Profile">${escapeHtml(r.handle)}</a></td>
        <td class="col-number">${formatNumber(r.rating)}</td>
        <td class="col-number">${isFiltered ? formatNumber(r.submissionsPeriod) : formatNumber(r.totalSolved)}</td>
        ${isFiltered ? `<td class="col-number" style="color: #4ade80; font-weight: bold;">+${formatNumber(r.solvedGrowth)}</td>` : ''}
        ${!isFiltered ? `<td class="col-number">${formatNumber(r.easy)}</td>` : ''}
        ${!isFiltered ? `<td class="col-number">${formatNumber(r.medium)}</td>` : ''}
        ${!isFiltered ? `<td class="col-number">${formatNumber(r.hard)}</td>` : ''}
        <td class="col-number">${formatNumber(r.activeDays)}</td>
        <td class="col-number">${formatNumber(r.streak)}</td>
      </tr>
    `).join('');

    updateSortIndicators(DOM.leetcodeTable, sortCfg);
  }

  // ==========================
  //  Rendering — GitHub Table
  // ==========================
  function renderGitHubTable() {
    const filterDays = state.currentFilter;
    const sortCfg = state.sort.github;

    let rows = state.students.map((s) => {
      const id = s._id || s.id;
      const gh = state.githubData[id] || {};

      let totalContributions = gh.totalContributions || 0;
      let activeDays = gh.totalActiveDays || 0;
      let contribGrowth = 0;
      
      const isFiltered = filterDays > 0;

      if (isFiltered) {
        if (gh.contributionCalendar) {
          const filtered = filterGitHubCalendarByDays(gh.contributionCalendar, filterDays);
          activeDays = filtered.activeDays;
          contribGrowth = filtered.totalContributions;
        }
      }

      return {
        name: s.name || s.studentName || '',
        username: s.githubUsername || s.github_username || '',
        totalContributions,
        contribGrowth,
        activeDays,
        currentStreak: gh.currentStreak || 0,
        publicRepos: gh.publicRepos || 0,
        rank: 0,
      };
    });

    // Sort
    rows.sort((a, b) => {
      let key = sortCfg.key;
      // If filtering and sorting by contributions, sort by contribGrowth
      if (filterDays > 0 && key === 'contributions') {
        key = 'contribGrowth';
      } else if (key === 'contributions') {
        key = 'totalContributions';
      }

      let va = a[key];
      let vb = b[key];
      
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      
      if (va === 'none' || va === '-') va = '';
      if (vb === 'none' || vb === '-') vb = '';

      if (va < vb) return sortCfg.dir === 'asc' ? -1 : 1;
      if (va > vb) return sortCfg.dir === 'asc' ? 1 : -1;
      return 0;
    });

    rows.forEach((r, i) => r.rank = i + 1);

    const isFiltered = filterDays > 0;

    // Build Table Header dynamically
    DOM.githubTable.querySelector('thead').innerHTML = `
      <tr>
        <th class="col-rank" data-sort="rank">#</th>
        <th data-sort="name">Student Name <span class="sort-arrow">▲</span></th>
        <th data-sort="handle">Username <span class="sort-arrow">▲</span></th>
        <th data-sort="contributions">${isFiltered ? 'Contributions' : 'Total Contributions'} <span class="sort-arrow">▲</span></th>
        <th data-sort="activeDays">Active Days <span class="sort-arrow">▲</span></th>
        <th data-sort="streak">Streak <span class="sort-arrow">▲</span></th>
        <th data-sort="repos">Repos <span class="sort-arrow">▲</span></th>
      </tr>
    `;

    // Re-bind sort events
    DOM.githubTable.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => handleSort('github', th.dataset.sort));
    });

    if (rows.length === 0) {
      DOM.githubBody.innerHTML = `
        <tr><td colspan="7" class="table-empty">
          <div class="empty-icon">📋</div>
          <p>No student data available</p>
        </td></tr>`;
      return;
    }

    DOM.githubBody.innerHTML = rows.map(r => {
      return `
      <tr>
        <td class="col-rank">${r.rank}</td>
        <td class="col-name">${escapeHtml(r.name)}</td>
        <td class="col-handle"><a href="https://github.com/${escapeHtml(r.username)}" target="_blank" class="profile-link" title="Open GitHub Profile">${escapeHtml(r.username)}</a></td>
        <td class="col-number">
          ${isFiltered ? formatNumber(r.contribGrowth) : formatNumber(r.totalContributions)}
          ${isFiltered ? `<span style="color: #4ade80; font-weight: bold; margin-left: 5px;">(+${formatNumber(r.contribGrowth)})</span>` : ''}
        </td>
        <td class="col-number">${formatNumber(r.activeDays)}</td>
        <td class="col-number">${formatNumber(r.currentStreak)}</td>
        <td class="col-number">${formatNumber(r.publicRepos)}</td>
      </tr>
      `;
    }).join('');

    updateSortIndicators(DOM.githubTable, sortCfg);
  }

  // ==========================
  //  Rendering — Stats
  // ==========================
  function updateStats() {
    const n = state.students.length;
    DOM.statStudents.textContent = formatNumber(n);

    if (n === 0) {
      DOM.statRating.textContent = '—';
      DOM.statContrib.textContent = '—';
      DOM.statActive.textContent = '—';
      return;
    }

    // Average LeetCode rating
    let totalRating = 0, ratingCount = 0;
    let totalContrib = 0, contribCount = 0;
    let activeCount = 0;

    state.students.forEach(s => {
      const id = s._id || s.id;
      const lc = state.leetcodeData[id];
      const gh = state.githubData[id];

      if (lc && (lc.contestRating || lc.rating)) {
        totalRating += (lc.contestRating || lc.rating);
        ratingCount++;
      }

      if (gh) {
        const c = gh.contributions || gh.totalContributions || 0;
        totalContrib += c;
        contribCount++;
      }

      // Consider "active" if they have any activity
      const hasActivity = (lc && (lc.totalSolved > 0 || lc.activeDays > 0)) ||
                          (gh && ((gh.contributions || gh.totalContributions || 0) > 0));
      if (hasActivity) activeCount++;
    });

    DOM.statRating.textContent = ratingCount > 0
      ? formatNumber(Math.round(totalRating / ratingCount))
      : '—';

    DOM.statContrib.textContent = contribCount > 0
      ? formatNumber(Math.round(totalContrib / contribCount))
      : '—';

    DOM.statActive.textContent = formatNumber(activeCount);
  }

  // ==========================
  //  View Switching
  // ==========================
  function renderCurrentView() {
    if (state.currentView === 'leetcode') {
      renderLeetCodeTable();
    } else {
      renderGitHubTable();
    }
  }

  function switchView(view) {
    state.currentView = view;

    // Toggle tab active
    DOM.viewTabs.forEach(t => {
      t.classList.toggle('active', t.dataset.view === view);
    });

    // Toggle table visibility
    if (view === 'leetcode') {
      DOM.leetcodeWrap.classList.remove('hidden');
      DOM.githubWrap.classList.add('hidden');
    } else {
      DOM.githubWrap.classList.remove('hidden');
      DOM.leetcodeWrap.classList.add('hidden');
    }

    renderCurrentView();
  }

  // ==========================
  //  Filtering
  // ==========================
  function setFilter(months) {
    state.currentFilter = months;

    DOM.timePills.forEach(p => {
      p.classList.toggle('active', parseInt(p.dataset.months) === months);
    });

    renderCurrentView();
  }

  // ==========================
  //  Sorting
  // ==========================
  function handleSort(tableType, key) {
    const cfg = state.sort[tableType];

    if (cfg.key === key) {
      cfg.dir = cfg.dir === 'asc' ? 'desc' : 'asc';
    } else {
      cfg.key = key;
      cfg.dir = 'desc';
    }

    renderCurrentView();
  }

  function updateSortIndicators(table, sortCfg) {
    table.querySelectorAll('th').forEach(th => {
      const key = th.dataset.sort;
      th.classList.toggle('sorted', key === sortCfg.key);
      const arrow = th.querySelector('.sort-arrow');
      if (arrow) {
        arrow.textContent = (key === sortCfg.key && sortCfg.dir === 'desc') ? '▼' : '▲';
      }
    });
  }

  // ==========================
  //  Upload Handlers
  // ==========================
  function setupUploadZone(zone, fileInput, uploadBtn) {
    // Click to browse
    zone.addEventListener('click', (e) => {
      if (e.target === uploadBtn || uploadBtn.contains(e.target)) return;
      fileInput.click();
    });

    // Drag & drop events
    zone.addEventListener('dragenter', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', ()  => { zone.classList.remove('drag-over'); });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file, uploadBtn);
    });

    // File input change
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) handleFileSelect(file, uploadBtn);
    });

    // Upload button
    uploadBtn.addEventListener('click', () => uploadFile());
  }

  function handleFileSelect(file, uploadBtn) {
    const validExts = ['.xlsx', '.xls'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExts.includes(ext)) {
      showToast('Please select an Excel file (.xlsx or .xls)', 'error');
      return;
    }

    state.selectedFile = file;
    uploadBtn.disabled = false;

    // Update zone text
    document.querySelectorAll('.upload-title').forEach(el => {
      el.textContent = file.name;
    });
    document.querySelectorAll('.upload-subtitle').forEach(el => {
      el.textContent = `${(file.size / 1024).toFixed(1)} KB — Ready to upload`;
    });

    showToast('File selected: ' + file.name, 'info');
  }

  async function uploadFile() {
    if (!state.selectedFile) return;

    const btn = DOM.uploadBtn.disabled ? DOM.uploadBtn2 : DOM.uploadBtn;
    setButtonLoading(btn, true);

    const formData = new FormData();
    formData.append('file', state.selectedFile);

    try {
      const res = await fetch(API + '/api/upload', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Upload failed');
      }

      showToast('Students uploaded successfully!', 'success');
      state.selectedFile = null;

      // Reload students
      await loadStudents();

      // Switch to dashboard page
      switchPage('dashboard');

    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setButtonLoading(btn, false);
    }
  }

  // ==========================
  //  Export
  // ==========================
  async function handleExport() {
    showToast('Preparing export…', 'info');

    try {
      const res = await fetch(API + '/api/export', {
        headers: { 'Authorization': 'Bearer ' + token },
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Try to get filename from Content-Disposition header
      const disposition = res.headers.get('Content-Disposition');
      let filename = 'mentortrack_export.xlsx';
      if (disposition) {
        const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match) filename = match[1].replace(/['"]/g, '');
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showToast('Export downloaded!', 'success');
    } catch (err) {
      showToast('Export failed — please try again', 'error');
    }
  }

  // ==========================
  //  Page Navigation (Sidebar)
  // ==========================
  function switchPage(page) {
    // Update nav items
    DOM.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Toggle page sections
    DOM.pageDashboard.classList.toggle('hidden', page !== 'dashboard');
    DOM.pageUpload.classList.toggle('hidden', page !== 'upload');
    DOM.pageSettings.classList.toggle('hidden', page !== 'settings');

    // Update title
    const titles = { dashboard: 'Dashboard', upload: 'Upload Students', settings: 'Settings' };
    DOM.pageTitle.textContent = titles[page] || 'Dashboard';

    // Show/hide export button
    DOM.exportBtn.classList.toggle('hidden', page !== 'dashboard');

    // Close mobile sidebar
    DOM.sidebar.classList.remove('open');
    DOM.sidebarOverlay.classList.remove('active');
  }

  // ==========================
  //  Event Binding
  // ==========================
  function bindEvents() {
    // Sidebar toggle (mobile)
    DOM.sidebarToggle.addEventListener('click', () => {
      DOM.sidebar.classList.toggle('open');
      DOM.sidebarOverlay.classList.toggle('active');
    });

    DOM.sidebarOverlay.addEventListener('click', () => {
      DOM.sidebar.classList.remove('open');
      DOM.sidebarOverlay.classList.remove('active');
    });

    // Sidebar navigation
    DOM.navItems.forEach(item => {
      item.addEventListener('click', () => switchPage(item.dataset.page));
    });

    // Logout
    DOM.logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('token');
      window.location.href = 'login.html';
    });

    // Time filter pills
    DOM.timePills.forEach(pill => {
      pill.addEventListener('click', () => setFilter(parseInt(pill.dataset.days)));
    });

    // View tabs
    DOM.viewTabs.forEach(tab => {
      tab.addEventListener('click', () => switchView(tab.dataset.view));
    });

    // Table sorting — LeetCode
    DOM.leetcodeTable.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => handleSort('leetcode', th.dataset.sort));
    });

    // Table sorting — GitHub
    DOM.githubTable.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => handleSort('github', th.dataset.sort));
    });

    // Upload zones
    setupUploadZone(DOM.uploadZone, DOM.fileInput, DOM.uploadBtn);
    setupUploadZone(DOM.uploadZone2, DOM.fileInput2, DOM.uploadBtn2);

    // Export
    DOM.exportBtn.addEventListener('click', handleExport);
  }

  // ==========================
  //  Helper Functions
  // ==========================

  /** Show a toast notification */
  function showToast(message, type) {
    type = type || 'info';
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ'}</span>
      <span>${escapeHtml(message)}</span>
    `;

    DOM.toastContainer.appendChild(toast);

    // Auto-remove after 4s
    setTimeout(() => {
      toast.classList.add('removing');
      toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
  }

  /** Show skeleton loading rows in a table body */
  function showLoadingSkeleton(tbody, rows, cols) {
    let html = '';
    for (let i = 0; i < rows; i++) {
      html += '<tr class="skeleton-row">';
      for (let j = 0; j < cols; j++) {
        const width = j === 0 ? 'w-sm' : (j === 1 ? 'w-lg' : 'w-md');
        html += `<td><div class="skeleton skeleton-cell ${width}"></div></td>`;
      }
      html += '</tr>';
    }
    tbody.innerHTML = html;
  }

  /** Format a number with commas */
  function formatNumber(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    return Number(n).toLocaleString();
  }

  /** Escape HTML entities */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Filter LeetCode submission calendar by days.
   * The calendar is an object with timestamps (seconds) as keys.
   */
  function filterCalendarByDays(calendar, days) {
    if (typeof calendar === 'string') {
      try { calendar = JSON.parse(calendar); } catch { calendar = {}; }
    }
    if (!calendar || typeof calendar !== 'object') {
      return { activeDays: 0, totalSubmissions: 0 };
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    const cutoffTs = cutoff.getTime();

    let totalSubmissions = 0;
    let activeDays = 0;

    Object.entries(calendar).forEach(([ts, count]) => {
      const timestamp = parseInt(ts, 10) * 1000; // LeetCode uses seconds
      if (timestamp >= cutoffTs) {
        if (count > 0) activeDays++;
        totalSubmissions += count;
      }
    });

    return { activeDays, totalSubmissions };
  }

  /**
   * Filter GitHub contribution calendar by days.
   * Calendar keys are 'YYYY-MM-DD'.
   */
  function filterGitHubCalendarByDays(calendar, days) {
    if (typeof calendar === 'string') {
      try { calendar = JSON.parse(calendar); } catch { calendar = {}; }
    }
    if (!calendar || typeof calendar !== 'object') {
      return { activeDays: 0, totalContributions: 0 };
    }

    const now = new Date();
    // Offset by days
    const cutoff = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    const cutoffTs = cutoff.getTime();

    let totalContributions = 0;
    let activeDays = 0;

    Object.entries(calendar).forEach(([dateStr, count]) => {
      // dateStr is like '2026-07-07'
      const timestamp = new Date(dateStr).getTime();
      if (timestamp >= cutoffTs) {
        if (count > 0) activeDays++;
        totalContributions += count;
      }
    });

    return { activeDays, totalContributions };
  }

  /** Set loading state on a button */
  function setButtonLoading(btn, loading) {
    if (loading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  // ==========================
  //  Launch
  // ==========================
  init();

})();
