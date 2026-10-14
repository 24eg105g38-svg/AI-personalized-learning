/* ═══════════════════════════════════════════════════════════════════════════
   StudyAI — Frontend Application
   ══════════════════════════════════════════════════════════════════════════ */

const API = 'http://localhost:3000/api';

// ─── State ─────────────────────────────────────────────────────────────────
let appState = {
  profile: null,
  sessions: [],
  tasks: [],
  stats: null,
  plan: null,
  currentPage: 'dashboard',
  timer: {
    mode: 'focus',
    running: false,
    interval: null,
    secondsLeft: 25 * 60,
    totalSeconds: 25 * 60,
    pomodoroCount: 0,
    sessionStart: null,
    sessionSubject: 'General',
  },
  taskFilter: 'all',
  selectedRating: 3,
  selectedStyle: 'visual',
};

// ─── API Helpers ────────────────────────────────────────────────────────────
async function apiGet(path) {
  try {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  } catch (e) {
    console.error('GET', path, e.message);
    return null;
  }
}

async function apiPost(path, body) {
  try {
    const res = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  } catch (e) {
    console.error('POST', path, e.message);
    showToast('❌ Server error. Is the server running?');
    return null;
  }
}

async function apiPatch(path, body) {
  try {
    const res = await fetch(API + path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  } catch (e) {
    console.error('PATCH', path, e.message);
    return null;
  }
}

async function apiDelete(path) {
  try {
    const res = await fetch(API + path, { method: 'DELETE' });
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  } catch (e) {
    console.error('DELETE', path, e.message);
    return null;
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  const tm = document.getElementById('toast-msg');
  tm.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), duration);
}

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

function subjectColor(index) {
  const colors = [
    'linear-gradient(135deg,#7c3aed,#a78bfa)',
    'linear-gradient(135deg,#06b6d4,#67e8f9)',
    'linear-gradient(135deg,#f59e0b,#fde68a)',
    'linear-gradient(135deg,#10b981,#6ee7b7)',
    'linear-gradient(135deg,#ef4444,#fca5a5)',
    'linear-gradient(135deg,#ec4899,#f9a8d4)',
    'linear-gradient(135deg,#8b5cf6,#ddd6fe)',
  ];
  return colors[index % colors.length];
}

// ─── Init ────────────────────────────────────────────────────────────────────
async function init() {
  // Check if profile exists
  const profile = await apiGet('/profile');
  if (profile) {
    appState.profile = profile;
    showApp();
    await loadAllData();
    refreshSubjectSelects();
  } else {
    showOnboarding();
  }
}

function showApp() {
  document.getElementById('onboarding-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}

function showOnboarding() {
  document.getElementById('onboarding-overlay').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  addSubjectRow();
}

async function loadAllData() {
  const [sessions, tasks, stats, plan, insights] = await Promise.all([
    apiGet('/sessions'),
    apiGet('/tasks'),
    apiGet('/stats'),
    apiGet('/plan'),
    apiGet('/insights'),
  ]);

  if (sessions) appState.sessions = sessions;
  if (tasks) appState.tasks = tasks;
  if (stats) appState.stats = stats;
  if (plan) appState.plan = plan.plan;

  updateTopbar(stats);
  updateDashboardGreeting();
  renderDashboard(stats, sessions, plan?.plan, insights);
  renderTasks();
  renderSubjectProgress(stats, plan?.plan);
  renderRecentSessions(sessions);
}

// ═══════════════════════════════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════
let currentStep = 1;
let subjectCount = 0;

function goToStep(n) {
  if (n === 2 && !validateStep1()) return;
  if (n === 3 && !validateStep2()) return;

  document.getElementById(`step-${currentStep}`).classList.remove('active');
  document.getElementById(`dot-${currentStep}`).classList.remove('active');
  currentStep = n;
  document.getElementById(`step-${currentStep}`).classList.add('active');
  document.getElementById(`dot-${currentStep}`).classList.add('active');
}

function validateStep1() {
  const name = document.getElementById('ob-name').value.trim();
  if (!name) { showToast('Please enter your name!'); return false; }
  return true;
}

function validateStep2() {
  const rows = document.querySelectorAll('.subject-row');
  if (rows.length === 0) { showToast('Add at least one subject!'); return false; }
  for (const row of rows) {
    if (!row.querySelector('.sub-name').value.trim()) {
      showToast('Please fill in all subject names!'); return false;
    }
  }
  return true;
}

function addSubjectRow() {
  const list = document.getElementById('subjects-list');
  const id = ++subjectCount;
  const row = document.createElement('div');
  row.className = 'subject-row';
  row.id = `sub-row-${id}`;
  row.innerHTML = `
    <input class="sub-name" type="text" placeholder="Subject name (e.g. Maths)" />
    <select class="sub-difficulty" title="Difficulty (1=Easy, 10=Hard)">
      ${[1,2,3,4,5,6,7,8,9,10].map(i => `<option value="${i}" ${i===5?'selected':''}>${i}</option>`).join('')}
    </select>
    <input class="sub-exam" type="date" title="Exam date" />
    <button class="remove-subject-btn" onclick="removeSubjectRow(${id})" title="Remove">✕</button>
  `;
  list.appendChild(row);
}

function removeSubjectRow(id) {
  const el = document.getElementById(`sub-row-${id}`);
  if (el) el.remove();
}

// Learning style toggle
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('style-btn')) {
    document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    appState.selectedStyle = e.target.dataset.style;
  }
});

// Star rating
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('star')) {
    const val = parseInt(e.target.dataset.val);
    appState.selectedRating = val;
    document.querySelectorAll('.star').forEach((s, i) => {
      s.classList.toggle('active', i < val);
    });
  }
});

async function finishSetup() {
  const name = document.getElementById('ob-name').value.trim();
  const hours = parseFloat(document.getElementById('ob-hours').value) || 4;
  const goal = document.getElementById('ob-goal').value;
  const pomodoroWork = parseInt(document.getElementById('ob-pomodoroWork').value) || 25;
  const pomodoroBreak = parseInt(document.getElementById('ob-pomodoroBreak').value) || 5;

  const subjects = [];
  const examDates = {};
  document.querySelectorAll('.subject-row').forEach(row => {
    const name = row.querySelector('.sub-name').value.trim();
    const diff = parseInt(row.querySelector('.sub-difficulty').value);
    const exam = row.querySelector('.sub-exam').value;
    if (name) {
      subjects.push({ name, difficulty: diff });
      if (exam) examDates[name] = exam;
    }
  });

  if (!subjects.length) { showToast('Add at least one subject!'); return; }

  const profile = { name, dailyHours: hours, goal, pomodoroWork, pomodoroBreak, learningStyle: appState.selectedStyle, subjects, examDates };
  const result = await apiPost('/profile', profile);

  if (result) {
    appState.profile = result.profile;
    appState.plan = result.plan;

    // Init timer settings
    appState.timer.totalSeconds = pomodoroWork * 60;
    appState.timer.secondsLeft = pomodoroWork * 60;
    updateTimerDisplay();

    showApp();
    await loadAllData();
    refreshSubjectSelects();
    showToast('🎉 Profile created! Welcome aboard!');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════
function switchPage(page) {
  appState.currentPage = page;

  document.querySelectorAll('.page').forEach(p => {
    p.classList.add('hidden');
    p.classList.remove('active');
  });
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) { pageEl.classList.remove('hidden'); pageEl.classList.add('active'); }

  const navBtn = document.querySelector(`[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  const titles = { dashboard: 'Dashboard', plan: 'Study Plan', timer: 'Focus Timer', tasks: 'Smart Tasks', chat: 'AI Coach' };
  document.getElementById('topbar-title').textContent = titles[page] || page;

  // Page-specific actions
  if (page === 'plan') renderStudyPlan();
  if (page === 'chat') initChat();
  if (page === 'timer') renderPomoDots();

  // Close sidebar on mobile
  if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════
function updateDashboardGreeting() {
  const name = appState.profile?.name || 'Student';
  document.getElementById('dashboard-greeting').textContent = `${getGreeting()}, ${name}! 👋`;
  document.getElementById('dashboard-date').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function updateTopbar(stats) {
  if (!stats) return;
  document.getElementById('topbar-xp').textContent = `${stats.xp} XP`;
  document.getElementById('topbar-streak').textContent = `🔥 ${stats.streak}`;

  const pct = Math.min(100, ((stats.xp % 500) / 500) * 100);
  document.getElementById('topbar-xp-fill').style.width = pct + '%';

  const name = appState.profile?.name || 'Student';
  document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
  document.getElementById('user-name-sidebar').textContent = name;
  document.getElementById('user-level-sidebar').textContent = `Level ${stats.level}`;
}

function renderDashboard(stats, sessions, plan, insights) {
  if (!stats) return;

  // Stats cards
  document.getElementById('stat-total-sessions').textContent = stats.totalSessions;
  document.getElementById('stat-total-hours').textContent = (stats.totalMinutes / 60).toFixed(1) + 'h';
  document.getElementById('stat-streak-val').textContent = stats.streak;
  document.getElementById('stat-tasks-done').textContent = stats.completedTasks;

  // Level / XP
  const xpInLevel = stats.xp % 500;
  const pct = Math.min(100, (xpInLevel / 500) * 100);
  document.getElementById('dash-level').textContent = `Lvl ${stats.level}`;
  document.getElementById('dash-xp-text').textContent = `${xpInLevel} / 500 XP`;
  setTimeout(() => {
    document.getElementById('dash-xp-bar').style.width = pct + '%';
  }, 300);

  // Insights
  if (insights) {
    const list = document.getElementById('insights-list');
    list.innerHTML = insights.insights.map(i => `<div class="insight-item">${i}</div>`).join('');
    document.getElementById('tip-text').textContent = insights.tip;
  }

  // Chart
  if (stats.last7Days) drawActivityChart(stats.last7Days);
}

function renderSubjectProgress(stats, plan) {
  if (!appState.profile?.subjects) return;
  const container = document.getElementById('subject-progress-list');
  const subjectTotals = stats?.subjectTotals || {};
  const maxMins = Math.max(...Object.values(subjectTotals), 1);

  container.innerHTML = appState.profile.subjects.map((sub, i) => {
    const mins = Math.round((subjectTotals[sub.name] || 0) / 60);
    const target = plan?.[sub.name]?.dailyMinutes * 7 || 120;
    const pct = Math.min(100, Math.round((mins / target) * 100));
    return `
      <div class="subject-progress-item">
        <div class="spi-header">
          <span class="spi-name">${sub.name}</span>
          <span class="spi-stats">
            <span>${mins}m studied</span>
            <span>•</span>
            <span>Target: ${target}m/week</span>
            <span>•</span>
            <span>${pct}%</span>
          </span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:0%;background:${subjectColor(i)}" data-target="${pct}"></div>
        </div>
      </div>
    `;
  }).join('');

  // Animate bars
  setTimeout(() => {
    document.querySelectorAll('.progress-fill').forEach(bar => {
      bar.style.width = bar.dataset.target + '%';
    });
  }, 300);
}

function renderRecentSessions(sessions) {
  const container = document.getElementById('recent-sessions');
  if (!sessions || sessions.length === 0) {
    container.innerHTML = '<p class="empty-state">No sessions yet. Start studying! 🚀</p>';
    return;
  }
  const recent = [...sessions].reverse().slice(0, 5);
  container.innerHTML = recent.map(s => `
    <div class="session-item">
      <span class="session-subject">${s.subject}</span>
      <span class="session-meta">${formatDate(s.startTime)}</span>
      <span class="session-duration">${formatDuration(s.duration)}</span>
      ${s.notes ? `<span class="session-meta" title="${s.notes}" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.notes}</span>` : ''}
    </div>
  `).join('');
}

// ─── Activity Chart ─────────────────────────────────────────────────────────
function drawActivityChart(data) {
  const canvas = document.getElementById('activity-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = 200 * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = '200px';
  ctx.scale(dpr, dpr);

  const W = rect.width;
  const H = 200;
  const pad = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const maxVal = Math.max(...data.map(d => d.minutes), 60);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const barW = (chartW / data.length) * 0.5;
  const barSpacing = chartW / data.length;

  ctx.clearRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal * (1 - i / 4)) + 'm', pad.left - 6, y + 4);
  }

  // Bars
  data.forEach((d, i) => {
    const x = pad.left + i * barSpacing + (barSpacing - barW) / 2;
    const barH = d.minutes > 0 ? (d.minutes / maxVal) * chartH : 2;
    const y = pad.top + chartH - barH;

    // Gradient
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, '#7c3aed');
    grad.addColorStop(1, '#06b6d4');

    ctx.fillStyle = grad;
    ctx.beginPath();
    const r = Math.min(6, barW / 2);
    ctx.roundRect(x, y, barW, barH, [r, r, 2, 2]);
    ctx.fill();

    // Glow on active bars
    if (d.minutes > 0) {
      ctx.shadowColor = '#7c3aed';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Day label
    const dateObj = new Date(d.date + 'T00:00:00');
    const dayLabel = days[dateObj.getDay()];
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(dayLabel, x + barW / 2, H - 10);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDY PLAN
// ═══════════════════════════════════════════════════════════════════════════
async function regeneratePlan() {
  showToast('🔄 Regenerating plan...');
  const result = await apiGet('/plan');
  if (result) {
    appState.plan = result.plan;
    renderStudyPlan();
    showToast('✅ Plan updated!');
  }
}

function renderStudyPlan() {
  const plan = appState.plan;
  const container = document.getElementById('plan-container');

  if (!plan || Object.keys(plan).length === 0) {
    container.innerHTML = '<p class="empty-state">No plan yet. Complete your profile first! 📚</p>';
    renderWeeklyCalendar(null);
    return;
  }

  const sorted = Object.entries(plan).sort((a, b) => b[1].priority - a[1].priority);

  container.innerHTML = sorted.map(([name, data]) => {
    const priorityPct = Math.round(data.priority * 100);
    const priorityClass = priorityPct >= 70 ? 'high' : priorityPct >= 40 ? 'medium' : 'low';
    const priorityLabel = priorityPct >= 70 ? '🔴 High Priority' : priorityPct >= 40 ? '🟡 Medium Priority' : '🟢 Low Priority';
    return `
      <div class="plan-card">
        <div class="plan-subject">${name}</div>
        <div class="plan-stat">
          <span class="plan-stat-label">Daily Target</span>
          <span class="plan-stat-value">${data.dailyMinutes} min</span>
        </div>
        <div class="plan-stat">
          <span class="plan-stat-label">Days to Exam</span>
          <span class="plan-stat-value">${data.daysLeft} days</span>
        </div>
        <div class="plan-stat">
          <span class="plan-stat-label">Sessions/Week</span>
          <span class="plan-stat-value">${data.sessionsPerWeek}x</span>
        </div>
        <div class="plan-stat">
          <span class="plan-stat-label">Difficulty</span>
          <span class="plan-stat-value">${'⭐'.repeat(Math.round(data.difficultyScore / 2))}</span>
        </div>
        ${data.reviewDays.length ? `
        <div class="plan-stat">
          <span class="plan-stat-label">Review in</span>
          <span class="plan-stat-value">${data.reviewDays[0]} day(s)</span>
        </div>` : ''}
        <div class="priority-badge priority-${priorityClass}">${priorityLabel}</div>
      </div>
    `;
  }).join('');

  renderWeeklyCalendar(plan);
}

function renderWeeklyCalendar(plan) {
  const container = document.getElementById('weekly-calendar');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const today = new Date();

  const html = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - today.getDay() + i);
    const isToday = d.toDateString() === today.toDateString();

    let subjects = [];
    if (plan) {
      subjects = Object.entries(plan)
        .filter(([, data]) => data.sessionsPerWeek > i && i % Math.max(1, Math.floor(7 / data.sessionsPerWeek)) === 0)
        .slice(0, 3)
        .map(([name]) => name);
    }

    return `
      <div class="week-day ${isToday ? 'today' : ''}">
        <div class="week-day-name">${days[i]}</div>
        <div class="week-day-date">${d.getDate()}</div>
        <div class="week-day-subjects">
          ${subjects.map(s => `<div class="week-subject-pill">${s}</div>`).join('')}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMER
// ═══════════════════════════════════════════════════════════════════════════
const COACH_MESSAGES = {
  start: [
    "Let's crush this session! You've got this 💪",
    "Focus mode: ON. Distractions: OFF 🎯",
    "One step at a time. You're building greatness! 🚀",
    "Deep work begins now. Make it count! ⚡",
  ],
  end: [
    "Amazing session! Take a well-deserved break 🌟",
    "You did it! Every minute counts toward your goals 🏆",
    "Session complete! Your brain is thanking you 🧠",
    "Fantastic work! Rest up for the next round 💎",
  ],
  break: [
    "Breathe, stretch, hydrate — you've earned it! 💧",
    "Break time! Step away from the screen for a bit 🌿",
    "Great work! Rest helps memory consolidation 😴",
  ],
};

function setMode(mode) {
  if (appState.timer.running) return;
  appState.timer.mode = mode;

  document.querySelectorAll('.pomo-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`tab-${mode}`).classList.add('active');

  const profile = appState.profile;
  const workMins = profile?.pomodoroWork || 25;
  const breakMins = profile?.pomodoroBreak || 5;
  const longMins = Math.round(breakMins * 3);

  const secs = mode === 'focus' ? workMins * 60 : mode === 'break' ? breakMins * 60 : longMins * 60;
  appState.timer.totalSeconds = secs;
  appState.timer.secondsLeft = secs;
  updateTimerDisplay();

  const labels = { focus: 'FOCUS', break: 'SHORT BREAK', long: 'LONG BREAK' };
  document.getElementById('timer-mode-label').textContent = labels[mode];
}

function toggleTimer() {
  if (appState.timer.running) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  appState.timer.running = true;
  appState.timer.sessionStart = new Date();
  document.getElementById('timer-start-btn').textContent = '⏸ Pause';
  document.getElementById('timer-start-btn').style.background = 'linear-gradient(135deg,#f59e0b,#fbbf24)';

  const msgs = COACH_MESSAGES.start;
  document.getElementById('coach-text').textContent = msgs[Math.floor(Math.random() * msgs.length)];

  appState.timer.interval = setInterval(() => {
    appState.timer.secondsLeft--;
    updateTimerDisplay();

    if (appState.timer.secondsLeft <= 0) {
      clearInterval(appState.timer.interval);
      appState.timer.running = false;
      onTimerComplete();
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(appState.timer.interval);
  appState.timer.running = false;
  document.getElementById('timer-start-btn').textContent = '▶ Resume';
  document.getElementById('timer-start-btn').style.background = '';
}

function resetTimer() {
  clearInterval(appState.timer.interval);
  appState.timer.running = false;
  const profile = appState.profile;
  const workMins = profile?.pomodoroWork || 25;
  appState.timer.secondsLeft = workMins * 60;
  appState.timer.totalSeconds = workMins * 60;
  updateTimerDisplay();
  document.getElementById('timer-start-btn').textContent = '▶ Start';
  document.getElementById('timer-start-btn').style.background = '';
  document.getElementById('coach-text').textContent = "Ready to focus? Let's crush it! 💪";
}

async function onTimerComplete() {
  document.getElementById('timer-start-btn').textContent = '▶ Start';
  document.getElementById('timer-start-btn').style.background = '';

  if (appState.timer.mode === 'focus') {
    appState.timer.pomodoroCount++;
    renderPomoDots();

    // Auto-log session
    const duration = appState.timer.totalSeconds;
    const subject = document.getElementById('timer-subject').value;
    await autoLogSession(subject, duration);

    const msgs = COACH_MESSAGES.end;
    document.getElementById('coach-text').textContent = msgs[Math.floor(Math.random() * msgs.length)];
    showToast('🍅 Pomodoro complete! Time for a break.');

    // Auto-switch to break
    setTimeout(() => setMode(appState.timer.pomodoroCount % 4 === 0 ? 'long' : 'break'), 800);
  } else {
    const msgs = COACH_MESSAGES.break;
    document.getElementById('coach-text').textContent = msgs[Math.floor(Math.random() * msgs.length)];
    showToast('✨ Break over! Back to focus?');
    setMode('focus');
  }
}

function updateTimerDisplay() {
  const s = appState.timer.secondsLeft;
  const mins = String(Math.floor(s / 60)).padStart(2, '0');
  const secs = String(s % 60).padStart(2, '0');
  document.getElementById('timer-time').textContent = `${mins}:${secs}`;

  // Ring progress
  const total = appState.timer.totalSeconds;
  const progress = s / total;
  const circumference = 2 * Math.PI * 100;
  const offset = circumference * (1 - progress);
  const ring = document.getElementById('ring-progress');
  if (ring) ring.style.strokeDashoffset = offset;
}

function renderPomoDots() {
  const container = document.getElementById('pomo-dots');
  if (!container) return;
  const total = 4;
  container.innerHTML = Array.from({ length: total }, (_, i) => `
    <div class="pomo-dot ${i < appState.timer.pomodoroCount % 4 ? 'filled' : ''}"></div>
  `).join('');
}

// ─── Log Session ────────────────────────────────────────────────────────────
async function autoLogSession(subject, duration) {
  const session = {
    subject,
    duration,
    startTime: appState.timer.sessionStart?.toISOString() || new Date().toISOString(),
    notes: 'Pomodoro session',
    rating: 4,
    type: 'pomodoro',
  };
  const saved = await apiPost('/sessions', session);
  if (saved) {
    appState.sessions.push(saved);
    await refreshStats();
    renderRecentSessions(appState.sessions);
  }
}

async function logSession() {
  const subject = document.getElementById('log-subject').value;
  const duration = parseInt(document.getElementById('log-duration').value) || 25;
  const notes = document.getElementById('log-notes').value.trim();
  const rating = appState.selectedRating;

  if (duration < 1) { showToast('Duration must be at least 1 minute'); return; }

  const session = {
    subject,
    duration: duration * 60,
    startTime: new Date().toISOString(),
    notes,
    rating,
    type: 'manual',
  };

  const saved = await apiPost('/sessions', session);
  if (saved) {
    appState.sessions.push(saved);
    await refreshStats();
    renderRecentSessions(appState.sessions);
    document.getElementById('log-notes').value = '';
    document.getElementById('log-duration').value = '25';
    showToast('✅ Session saved! Great work!');

    // Award XP
    const xpGained = Math.floor(duration);
    showToast(`+${xpGained} XP earned! 🌟`);
  }
}

async function refreshStats() {
  const stats = await apiGet('/stats');
  if (stats) {
    appState.stats = stats;
    updateTopbar(stats);
    renderDashboard(stats, appState.sessions, appState.plan, null);
    renderSubjectProgress(stats, appState.plan);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TASKS
// ═══════════════════════════════════════════════════════════════════════════
async function addTask() {
  const title = document.getElementById('task-title').value.trim();
  if (!title) { showToast('Enter a task title!'); return; }

  const task = {
    title,
    subject: document.getElementById('task-subject').value,
    priority: document.getElementById('task-priority').value,
    dueDate: document.getElementById('task-due').value || null,
  };

  const saved = await apiPost('/tasks', task);
  if (saved) {
    appState.tasks.push(saved);
    renderTasks();
    document.getElementById('task-title').value = '';
    document.getElementById('task-due').value = '';
    showToast('✅ Task added!');
  }
}

function filterTasks(filter) {
  appState.taskFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
  renderTasks();
}

function renderTasks() {
  const tasks = appState.tasks;
  const filter = appState.taskFilter;
  const container = document.getElementById('tasks-list');

  let filtered = tasks;
  if (filter === 'pending') filtered = tasks.filter(t => !t.completed);
  else if (filter === 'completed') filtered = tasks.filter(t => t.completed);
  else if (filter === 'high') filtered = tasks.filter(t => t.priority === 'high' && !t.completed);

  // AI sort: high priority → due date → created
  filtered = [...filtered].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const pOrder = { high: 0, medium: 1, low: 2 };
    if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  if (!filtered.length) {
    container.innerHTML = '<p class="empty-state">No tasks found. Add one above! ✨</p>';
    return;
  }

  container.innerHTML = filtered.map(task => `
    <div class="task-item ${task.completed ? 'completed' : ''}" id="task-${task.id}">
      <div class="task-priority-dot ${task.priority}"></div>
      <div class="task-check ${task.completed ? 'checked' : ''}" onclick="toggleTask('${task.id}', ${!task.completed})"></div>
      <div class="task-body">
        <div class="task-title-text">${escapeHtml(task.title)}</div>
        <div class="task-meta-row">
          <span class="task-subject-tag">${task.subject}</span>
          ${task.dueDate ? `<span class="task-due-tag">📅 ${formatDate(task.dueDate + 'T00:00:00')}</span>` : ''}
        </div>
      </div>
      <button class="task-delete-btn" onclick="deleteTask('${task.id}')" title="Delete">🗑️</button>
    </div>
  `).join('');
}

async function toggleTask(id, completed) {
  const saved = await apiPatch(`/tasks/${id}`, { completed });
  if (saved) {
    appState.tasks = appState.tasks.map(t => t.id === id ? { ...t, completed } : t);
    renderTasks();
    if (completed) {
      showToast('✅ Task completed! +50 XP 🌟');
      await refreshStats();
    }
  }
}

async function deleteTask(id) {
  await apiDelete(`/tasks/${id}`);
  appState.tasks = appState.tasks.filter(t => t.id !== id);
  renderTasks();
  showToast('🗑️ Task removed');
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ═══════════════════════════════════════════════════════════════════════════
// AI CHAT
// ═══════════════════════════════════════════════════════════════════════════
let chatInitialized = false;

async function initChat() {
  if (chatInitialized) return;
  chatInitialized = true;

  const history = await apiGet('/chat/history');
  const container = document.getElementById('chat-messages');

  if (!history || history.length === 0) {
    const name = appState.profile?.name || 'there';
    appendChatMsg('assistant', `Hey ${name}! 👋 I'm your AI study coach. I'm here to help you study smarter, stay motivated, and ace your exams. What's on your mind?`);
  } else {
    history.forEach(msg => appendChatMsg(msg.role, msg.content, false));
    container.scrollTop = container.scrollHeight;
  }
}

function appendChatMsg(role, content, scroll = true) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `chat-msg ${role}`;

  const avatarText = role === 'user'
    ? (appState.profile?.name?.charAt(0).toUpperCase() || 'U')
    : '🤖';

  div.innerHTML = `
    <div class="chat-avatar">${avatarText}</div>
    <div class="chat-bubble">${escapeHtml(content).replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
  `;

  container.appendChild(div);
  if (scroll) container.scrollTop = container.scrollHeight;
}

function showTypingIndicator() {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'chat-msg assistant typing-indicator';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="chat-avatar">🤖</div>
    <div class="chat-bubble">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  appendChatMsg('user', msg);
  showTypingIndicator();

  const btn = document.getElementById('chat-send-btn');
  btn.disabled = true;

  // Simulate thinking delay
  await new Promise(r => setTimeout(r, 700 + Math.random() * 600));

  const result = await apiPost('/chat', { message: msg });

  removeTypingIndicator();
  btn.disabled = false;

  if (result?.message) {
    appendChatMsg('assistant', result.message.content);
  }
}

function sendQuickMsg(msg) {
  document.getElementById('chat-input').value = msg;
  sendChatMessage();
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════
function openSettings() {
  const p = appState.profile;
  if (!p) return;
  document.getElementById('set-name').value = p.name || '';
  document.getElementById('set-hours').value = p.dailyHours || 4;
  document.getElementById('set-pomo-work').value = p.pomodoroWork || 25;
  document.getElementById('set-pomo-break').value = p.pomodoroBreak || 5;
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

async function saveSettings() {
  const updated = {
    ...appState.profile,
    name: document.getElementById('set-name').value.trim() || appState.profile.name,
    dailyHours: parseFloat(document.getElementById('set-hours').value) || 4,
    pomodoroWork: parseInt(document.getElementById('set-pomo-work').value) || 25,
    pomodoroBreak: parseInt(document.getElementById('set-pomo-break').value) || 5,
  };

  const result = await apiPost('/profile', updated);
  if (result) {
    appState.profile = result.profile;
    appState.plan = result.plan;
    closeSettings();
    await loadAllData();
    refreshSubjectSelects();
    showToast('✅ Settings saved!');
  }
}

function resetProfile() {
  if (!confirm('Are you sure? This will delete ALL your data and reset the app.')) return;
  fetch(API + '/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
  localStorage.clear();
  location.reload();
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════
function refreshSubjectSelects() {
  const subjects = appState.profile?.subjects || [];
  const selects = ['timer-subject', 'log-subject', 'task-subject'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const current = el.value;
    el.innerHTML = `<option value="General">General</option>` +
      subjects.map(s => `<option value="${s.name}" ${s.name === current ? 'selected' : ''}>${s.name}</option>`).join('');
  });
}

// SVG gradient for timer (inject into DOM)
function injectSVGDefs() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = `
    <defs>
      <linearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#7c3aed"/>
        <stop offset="100%" stop-color="#06b6d4"/>
      </linearGradient>
    </defs>
  `;
  document.body.prepend(svg);
}

// Window resize → redraw chart
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (appState.stats?.last7Days) drawActivityChart(appState.stats.last7Days);
  }, 200);
});

// ─── Start ───────────────────────────────────────────────────────────────────
injectSVGDefs();
init();
