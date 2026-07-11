/* =========================================================
   MentorTrack — Auth Page Logic
   ========================================================= */

(function () {
  'use strict';

  // ---- Redirect if already authenticated ----
  const token = localStorage.getItem('token');
  if (token) {
    window.location.href = 'dashboard.html';
    return;
  }

  // ---- DOM Elements ----
  const tabs       = document.querySelectorAll('.auth-tab');
  const signinForm = document.getElementById('signinForm');
  const signupForm = document.getElementById('signupForm');

  // Sign-in fields
  const siEmail      = document.getElementById('si-email');
  const siPassword   = document.getElementById('si-password');
  const siEmailErr   = document.getElementById('si-email-error');
  const siPassErr    = document.getElementById('si-password-error');
  const siFormErr    = document.getElementById('si-form-error');

  // Sign-up fields
  const suName       = document.getElementById('su-name');
  const suEmail      = document.getElementById('su-email');
  const suPassword   = document.getElementById('su-password');
  const suConfirm    = document.getElementById('su-confirm');
  const suNameErr    = document.getElementById('su-name-error');
  const suEmailErr   = document.getElementById('su-email-error');
  const suPassErr    = document.getElementById('su-password-error');
  const suConfirmErr = document.getElementById('su-confirm-error');
  const suFormErr    = document.getElementById('su-form-error');

  // ---- Helpers ----
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function clearErrors(...els) {
    els.forEach(el => {
      el.textContent = '';
      // Also remove error class from the sibling input
      const input = el.previousElementSibling;
      if (input && input.classList) input.classList.remove('error');
    });
  }

  function setError(errEl, msg) {
    errEl.textContent = msg;
    const input = errEl.previousElementSibling;
    if (input && input.classList) input.classList.add('error');
  }

  function setLoading(btn, loading) {
    if (loading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  // ---- Tab Switching ----
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;

      // Update tab highlight
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Show corresponding form
      if (target === 'signin') {
        signinForm.classList.add('active');
        signupForm.classList.remove('active');
      } else {
        signupForm.classList.add('active');
        signinForm.classList.remove('active');
      }

      // Clear all errors on switch
      clearErrors(siEmailErr, siPassErr, siFormErr, suNameErr, suEmailErr, suPassErr, suConfirmErr, suFormErr);
    });
  });

  // ---- Sign In ----
  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(siEmailErr, siPassErr, siFormErr);

    const email    = siEmail.value.trim();
    const password = siPassword.value;
    let valid = true;

    if (!email) {
      setError(siEmailErr, 'Email is required');
      valid = false;
    } else if (!EMAIL_RE.test(email)) {
      setError(siEmailErr, 'Enter a valid email address');
      valid = false;
    }

    if (!password) {
      setError(siPassErr, 'Password is required');
      valid = false;
    } else if (password.length < 6) {
      setError(siPassErr, 'Password must be at least 6 characters');
      valid = false;
    }

    if (!valid) return;

    const btn = signinForm.querySelector('.btn-primary');
    setLoading(btn, true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        siFormErr.textContent = data.error || data.message || 'Invalid credentials';
        return;
      }

      localStorage.setItem('token', data.token);
      window.location.href = 'dashboard.html';
    } catch (err) {
      siFormErr.textContent = 'Network error — please try again';
    } finally {
      setLoading(btn, false);
    }
  });

  // ---- Sign Up ----
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(suNameErr, suEmailErr, suPassErr, suConfirmErr, suFormErr);

    const name     = suName.value.trim();
    const email    = suEmail.value.trim();
    const password = suPassword.value;
    const confirm  = suConfirm.value;
    let valid = true;

    if (!name) {
      setError(suNameErr, 'Name is required');
      valid = false;
    }

    if (!email) {
      setError(suEmailErr, 'Email is required');
      valid = false;
    } else if (!EMAIL_RE.test(email)) {
      setError(suEmailErr, 'Enter a valid email address');
      valid = false;
    }

    if (!password) {
      setError(suPassErr, 'Password is required');
      valid = false;
    } else if (password.length < 6) {
      setError(suPassErr, 'Password must be at least 6 characters');
      valid = false;
    }

    if (!confirm) {
      setError(suConfirmErr, 'Please confirm your password');
      valid = false;
    } else if (password !== confirm) {
      setError(suConfirmErr, 'Passwords do not match');
      valid = false;
    }

    if (!valid) return;

    const btn = signupForm.querySelector('.btn-primary');
    setLoading(btn, true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        suFormErr.textContent = data.error || data.message || 'Signup failed';
        return;
      }

      localStorage.setItem('token', data.token);
      window.location.href = 'dashboard.html';
    } catch (err) {
      suFormErr.textContent = 'Network error — please try again';
    } finally {
      setLoading(btn, false);
    }
  });

  // ---- Clear field errors on input ----
  [siEmail, siPassword].forEach(el => {
    el.addEventListener('input', () => {
      el.classList.remove('error');
      const err = el.nextElementSibling;
      if (err) err.textContent = '';
      siFormErr.textContent = '';
    });
  });

  [suName, suEmail, suPassword, suConfirm].forEach(el => {
    el.addEventListener('input', () => {
      el.classList.remove('error');
      const err = el.nextElementSibling;
      if (err) err.textContent = '';
      suFormErr.textContent = '';
    });
  });
})();
