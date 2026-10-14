const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Data Helpers ─────────────────────────────────────────────────────────────
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadDB() {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const initial = { users: {}, sessions: [], tasks: [], messages: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function saveDB(db) {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ─── AI Engine ────────────────────────────────────────────────────────────────
const AI_TIPS = [
  "🧠 Use active recall — test yourself instead of just re-reading.",
  "⏰ Study in 25-min Pomodoro blocks with 5-min breaks for best retention.",
  "🗂️ Break large topics into smaller chunks and tackle them one at a time.",
  "💤 Sleep is crucial — memories consolidate during deep sleep.",
  "📝 Teach what you learn to someone else to reinforce it.",
  "🔄 Space out your revision: review after 1 day, 3 days, 1 week, 2 weeks.",
  "🎯 Set a specific goal before each session, e.g. 'Complete chapter 3 problems'.",
  "🚫 Eliminate distractions — put your phone in another room.",
  "🌊 Start with the hardest subject when your mind is freshest.",
  "✅ Reward yourself after completing study goals — dopamine helps motivation!",
];

const AI_MOTIVATIONS = [
  "You're doing amazing! Every minute you study is an investment in your future. 🚀",
  "Consistency beats intensity. Keep showing up every day! 💪",
  "The struggle you feel today is building the strength you need tomorrow. ⚡",
  "Small progress is still progress. You've got this! 🌟",
  "Every expert was once a beginner. Keep going! 🎯",
  "Your future self will thank you for studying today. 📚",
  "Focus is a skill. The more you practice it, the better you get. 🧘",
  "One page at a time, one problem at a time. You'll get there! 🏆",
];

function generateStudyPlan(profile) {
  const { subjects, dailyHours, examDates, learningStyle } = profile;
  const plan = {};
  const today = new Date();

  subjects.forEach((subject) => {
    const examDate = examDates[subject.name]
      ? new Date(examDates[subject.name])
      : new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const daysLeft = Math.max(1, Math.ceil((examDate - today) / (1000 * 60 * 60 * 24)));
    const urgencyScore = Math.max(1, 10 - Math.floor(daysLeft / 3));
    const difficultyScore = subject.difficulty || 5;
    const priority = (urgencyScore * 0.6 + difficultyScore * 0.4) / 10;
    plan[subject.name] = {
      priority,
      dailyMinutes: Math.round(priority * dailyHours * 60),
      daysLeft,
      urgencyScore,
      difficultyScore,
      sessionsPerWeek: Math.min(7, Math.ceil(priority * 7)),
      reviewDays: [1, 3, 7, 14].filter((d) => d < daysLeft),
    };
  });

  // Normalize so total daily minutes ≤ dailyHours * 60
  const totalMinutes = Object.values(plan).reduce((s, v) => s + v.dailyMinutes, 0);
  const maxMinutes = dailyHours * 60;
  if (totalMinutes > maxMinutes) {
    const scale = maxMinutes / totalMinutes;
    Object.keys(plan).forEach((k) => {
      plan[k].dailyMinutes = Math.round(plan[k].dailyMinutes * scale);
    });
  }

  return plan;
}

function getAIInsights(sessions, profile) {
  const insights = [];
  if (!sessions || sessions.length === 0) {
    return ["Start your first study session to get personalized insights! 🌱"];
  }

  // Day-of-week analysis
  const dayCount = {};
  const dayMinutes = {};
  sessions.forEach((s) => {
    const d = new Date(s.startTime).getDay();
    dayCount[d] = (dayCount[d] || 0) + 1;
    dayMinutes[d] = (dayMinutes[d] || 0) + s.duration;
  });
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const bestDay = Object.entries(dayMinutes).sort((a, b) => b[1] - a[1])[0];
  if (bestDay) insights.push(`📅 You're most productive on ${days[bestDay[0]]}s!`);

  // Subject balance
  const subjectTime = {};
  sessions.forEach((s) => { subjectTime[s.subject] = (subjectTime[s.subject] || 0) + s.duration; });
  const leastStudied = Object.entries(subjectTime).sort((a, b) => a[1] - b[1])[0];
  if (leastStudied) insights.push(`⚠️ "${leastStudied[0]}" needs more attention — only ${Math.round(leastStudied[1] / 60)} mins logged.`);

  // Streak
  const totalHours = sessions.reduce((s, v) => s + v.duration, 0) / 3600;
  insights.push(`🔥 You've studied ${totalHours.toFixed(1)} hours total. Keep it up!`);

  // Time of day
  const hourBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  sessions.forEach((s) => {
    const h = new Date(s.startTime).getHours();
    if (h < 12) hourBuckets.morning++;
    else if (h < 17) hourBuckets.afternoon++;
    else if (h < 21) hourBuckets.evening++;
    else hourBuckets.night++;
  });
  const bestTime = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
  if (bestTime && bestTime[1] > 0) insights.push(`🌤️ You prefer studying in the ${bestTime[0]}.`);

  return insights.slice(0, 4);
}

function generateAIResponse(message, profile, sessions) {
  const msg = message.toLowerCase();

  if (msg.includes('tip') || msg.includes('advice') || msg.includes('help')) {
    return AI_TIPS[Math.floor(Math.random() * AI_TIPS.length)];
  }
  if (msg.includes('motivat') || msg.includes('tired') || msg.includes('give up') || msg.includes('hard')) {
    return AI_MOTIVATIONS[Math.floor(Math.random() * AI_MOTIVATIONS.length)];
  }
  if (msg.includes('schedule') || msg.includes('plan') || msg.includes('today')) {
    if (profile && profile.subjects) {
      const sub = profile.subjects[0];
      return `📋 Based on your profile, focus on **${sub.name}** first today — it has the highest priority score. Aim for ${Math.round(profile.dailyHours * 0.4 * 60)} minutes on it!`;
    }
    return "Set up your profile first so I can generate your personalized schedule! 🗓️";
  }
  if (msg.includes('pomodoro') || msg.includes('timer') || msg.includes('break')) {
    return "⏱️ Use the Pomodoro Technique: 25 mins focus, 5 min break. After 4 rounds, take a 15-30 min break. It's scientifically proven to boost focus!";
  }
  if (msg.includes('subject') || msg.includes('worst') || msg.includes('weak')) {
    const insights = getAIInsights(sessions, profile);
    return insights[1] || "Log more sessions and I'll analyze your weakest subject! 📊";
  }
  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    const name = profile?.name || 'there';
    return `Hey ${name}! 👋 I'm your AI study coach. Ask me for tips, motivation, schedule advice, or anything about your studies!`;
  }
  if (msg.includes('progress') || msg.includes('how am i') || msg.includes('performance')) {
    const insights = getAIInsights(sessions, profile);
    return insights.join('\n');
  }
  if (msg.includes('exam') || msg.includes('test') || msg.includes('preparation')) {
    return "🎯 For exam prep: 1) Review past papers, 2) Focus on weak areas, 3) Practice under timed conditions, 4) Get 8 hours sleep before the exam. You've got this!";
  }
  if (msg.includes('memory') || msg.includes('remember') || msg.includes('forget')) {
    return "🧠 Boost memory with: spaced repetition, mind maps, teaching others, and sleep. The Feynman Technique (explain simply) is incredibly powerful!";
  }

  // Default intelligent response
  const responses = [
    "Great question! Focus on consistent daily practice rather than cramming. 📚",
    "I'd suggest reviewing your notes within 24 hours of learning something new — the forgetting curve is real! 🔄",
    `Keep going! Based on your study pattern, you're building great habits. 💪`,
    "Try the 'Two-Minute Rule': if a task takes less than 2 minutes, do it now! ⚡",
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

// ─── API Routes ───────────────────────────────────────────────────────────────

// Profile
app.get('/api/profile', (req, res) => {
  const db = loadDB();
  res.json(db.users['default'] || null);
});

app.post('/api/profile', (req, res) => {
  const db = loadDB();
  const profile = { ...req.body, updatedAt: new Date().toISOString() };
  db.users['default'] = profile;
  saveDB(db);
  const plan = generateStudyPlan(profile);
  res.json({ profile, plan });
});

// Study Plan
app.get('/api/plan', (req, res) => {
  const db = loadDB();
  const profile = db.users['default'];
  if (!profile) return res.status(404).json({ error: 'No profile found' });
  const plan = generateStudyPlan(profile);
  res.json({ plan, profile });
});

// Sessions
app.get('/api/sessions', (req, res) => {
  const db = loadDB();
  res.json(db.sessions || []);
});

app.post('/api/sessions', (req, res) => {
  const db = loadDB();
  const session = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString(),
  };
  db.sessions = db.sessions || [];
  db.sessions.push(session);
  saveDB(db);
  res.json(session);
});

app.delete('/api/sessions/:id', (req, res) => {
  const db = loadDB();
  db.sessions = (db.sessions || []).filter((s) => s.id !== req.params.id);
  saveDB(db);
  res.json({ success: true });
});

// Tasks
app.get('/api/tasks', (req, res) => {
  const db = loadDB();
  res.json(db.tasks || []);
});

app.post('/api/tasks', (req, res) => {
  const db = loadDB();
  const task = {
    id: uuidv4(),
    ...req.body,
    completed: false,
    createdAt: new Date().toISOString(),
  };
  db.tasks = db.tasks || [];
  db.tasks.push(task);
  saveDB(db);
  res.json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const db = loadDB();
  db.tasks = (db.tasks || []).map((t) =>
    t.id === req.params.id ? { ...t, ...req.body } : t
  );
  saveDB(db);
  res.json(db.tasks.find((t) => t.id === req.params.id));
});

app.delete('/api/tasks/:id', (req, res) => {
  const db = loadDB();
  db.tasks = (db.tasks || []).filter((t) => t.id !== req.params.id);
  saveDB(db);
  res.json({ success: true });
});

// AI Chat
app.post('/api/chat', (req, res) => {
  const db = loadDB();
  const { message } = req.body;
  const profile = db.users['default'];
  const sessions = db.sessions || [];

  const userMsg = {
    id: uuidv4(),
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
  };

  const aiResponse = generateAIResponse(message, profile, sessions);
  const aiMsg = {
    id: uuidv4(),
    role: 'assistant',
    content: aiResponse,
    timestamp: new Date().toISOString(),
  };

  db.messages = db.messages || [];
  db.messages.push(userMsg, aiMsg);
  saveDB(db);

  res.json({ message: aiMsg });
});

app.get('/api/chat/history', (req, res) => {
  const db = loadDB();
  res.json(db.messages || []);
});

// AI Insights
app.get('/api/insights', (req, res) => {
  const db = loadDB();
  const profile = db.users['default'];
  const sessions = db.sessions || [];
  const insights = getAIInsights(sessions, profile);
  const tip = AI_TIPS[Math.floor(Math.random() * AI_TIPS.length)];
  res.json({ insights, tip });
});

// Stats
app.get('/api/stats', (req, res) => {
  const db = loadDB();
  const sessions = db.sessions || [];
  const tasks = db.tasks || [];
  const now = new Date();

  // Last 7 days chart data
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayMins = sessions
      .filter((s) => s.startTime && s.startTime.startsWith(dateStr))
      .reduce((sum, s) => sum + (s.duration || 0), 0) / 60;
    last7.push({ date: dateStr, minutes: Math.round(dayMins) });
  }

  // Per-subject totals
  const subjectTotals = {};
  sessions.forEach((s) => {
    subjectTotals[s.subject] = (subjectTotals[s.subject] || 0) + (s.duration || 0);
  });

  // Streak
  let streak = 0;
  const checkDate = new Date(now);
  for (let i = 0; i < 30; i++) {
    const dateStr = checkDate.toISOString().split('T')[0];
    const hasSession = sessions.some((s) => s.startTime && s.startTime.startsWith(dateStr));
    if (hasSession) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (i === 0) {
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // XP calculation
  const xp = sessions.reduce((sum, s) => sum + Math.floor((s.duration || 0) / 60), 0)
    + tasks.filter((t) => t.completed).length * 50;
  const level = Math.floor(xp / 500) + 1;

  res.json({
    totalSessions: sessions.length,
    totalMinutes: Math.round(sessions.reduce((s, v) => s + (v.duration || 0), 0) / 60),
    completedTasks: tasks.filter((t) => t.completed).length,
    pendingTasks: tasks.filter((t) => !t.completed).length,
    streak,
    xp,
    level,
    xpToNext: level * 500,
    last7Days: last7,
    subjectTotals,
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 AI Study Planner running at http://localhost:${PORT}\n`);
});
