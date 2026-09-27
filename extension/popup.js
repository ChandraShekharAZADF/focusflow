// ─── FocusFlow Extension Popup Script ─────────────────────

const DEFAULT_BASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.BASE_URL) || 'http://localhost:3001';

// DOM elements
const statusDot = document.getElementById('status-dot');
const loginView = document.getElementById('login-view');
const loginForm = document.getElementById('login-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');

const mainView = document.getElementById('main-view');
const userAvatar = document.getElementById('user-avatar');
const userEmail = document.getElementById('user-email');
const eventsContainer = document.getElementById('events-container');
const remindersContainer = document.getElementById('reminders-container');
const logoutBtn = document.getElementById('logout-btn');

async function getBaseUrl() {
  const data = await chrome.storage.local.get(['focusflow_base_url']);
  return data.focusflow_base_url || DEFAULT_BASE_URL;
}

// Format time utility
function formatTime(isoString) {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// Show error in login form
function showError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

function clearError() {
  loginError.textContent = '';
  loginError.classList.add('hidden');
}

// Set connected status
function setStatus(connected) {
  if (connected) {
    statusDot.className = 'status connected';
    statusDot.title = 'Connected to FocusFlow';
  } else {
    statusDot.className = 'status disconnected';
    statusDot.title = 'Disconnected';
  }
}

// Fetch and render today's events and tasks
async function loadDashboardData(token) {
  const baseUrl = await getBaseUrl();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();

    const [eventsRes, tasksRes] = await Promise.all([
      fetch(`${baseUrl}/api/events?from=${encodeURIComponent(startOfDay)}&to=${encodeURIComponent(endOfDay)}`, { headers }),
      fetch(`${baseUrl}/api/tasks?status=TODO`, { headers })
    ]);

    if (eventsRes.status === 401 || tasksRes.status === 401) {
      handleLogout();
      return;
    }

    if (eventsRes.ok) {
      const data = await eventsRes.json();
      renderEvents(data.events || []);
    } else {
      eventsContainer.innerHTML = '<div class="empty">Failed to load events</div>';
    }

    if (tasksRes.ok) {
      const data = await tasksRes.json();
      renderReminders(data.tasks || []);
    } else {
      remindersContainer.innerHTML = '<div class="empty">Failed to load reminders</div>';
    }

    setStatus(true);
  } catch (err) {
    eventsContainer.innerHTML = '<div class="empty">Unable to reach server</div>';
    remindersContainer.innerHTML = '<div class="empty">Unable to reach server</div>';
    setStatus(false);
  }
}

function renderEvents(events) {
  if (!events || events.length === 0) {
    eventsContainer.innerHTML = '<div class="empty">No events scheduled for today</div>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'item-list';

  events.slice(0, 5).forEach(ev => {
    const item = document.createElement('div');
    item.className = 'item';
    const timeStr = `${formatTime(ev.startTime)} - ${formatTime(ev.endTime)}`;
    const sourceBadge = ev.source !== 'MANUAL' ? ` • ${ev.source}` : '';

    item.innerHTML = `
      <div class="dot event" style="background: ${ev.color || '#6366f1'}"></div>
      <div class="content">
        <div class="title">${escapeHtml(ev.title)}</div>
        <div class="meta">${timeStr}${sourceBadge}</div>
      </div>
    `;
    list.appendChild(item);
  });

  eventsContainer.innerHTML = '';
  eventsContainer.appendChild(list);
}

function renderReminders(tasks) {
  if (!tasks || tasks.length === 0) {
    remindersContainer.innerHTML = '<div class="empty">All caught up! No pending tasks</div>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'item-list';

  tasks.slice(0, 5).forEach(task => {
    const item = document.createElement('div');
    item.className = 'item';
    const dueStr = task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date';

    item.innerHTML = `
      <div class="dot reminder"></div>
      <div class="content">
        <div class="title">${escapeHtml(task.title)}</div>
        <div class="meta">${task.priority} Priority • ${dueStr}</div>
      </div>
    `;
    list.appendChild(item);
  });

  remindersContainer.innerHTML = '';
  remindersContainer.appendChild(list);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Show login state
function showLoginView() {
  loginView.classList.remove('hidden');
  mainView.classList.add('hidden');
  setStatus(false);
}

// Show main dashboard state
function showMainView(user, token) {
  loginView.classList.add('hidden');
  mainView.classList.remove('hidden');

  userEmail.textContent = user.email || 'FocusFlow User';
  userAvatar.textContent = (user.email ? user.email[0] : 'F').toUpperCase();

  loadDashboardData(token);
}

// Login form handler
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) return;

  loginBtn.disabled = true;
  loginBtn.textContent = 'Signing in...';

  try {
    const baseUrl = await getBaseUrl();
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Authentication failed');
      return;
    }

    // Save token & user in chrome storage
    await chrome.storage.local.set({
      focusflow_token: data.token,
      focusflow_user: data.user
    });

    showMainView(data.user, data.token);
  } catch (err) {
    showError('Could not connect to FocusFlow backend. Is the server running?');
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Sign In';
  }
});

// Logout handler
async function handleLogout() {
  await chrome.storage.local.remove(['focusflow_token', 'focusflow_user']);
  loginEmail.value = '';
  loginPassword.value = '';
  showLoginView();
}

logoutBtn.addEventListener('click', handleLogout);

// Initialize popup
async function init() {
  const data = await chrome.storage.local.get(['focusflow_token', 'focusflow_user']);
  if (data.focusflow_token && data.focusflow_user) {
    showMainView(data.focusflow_user, data.focusflow_token);
  } else {
    showLoginView();
  }
}

document.addEventListener('DOMContentLoaded', init);
