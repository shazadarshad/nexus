import type { Account, CalEvent, DataState, FocusSession, Goal, Habit, JournalEntry, Note, Project, Task, Transaction } from '../types';
import { addDays, today, weekdayOf, parseISO } from './date';
import { uid } from './id';

// deterministic PRNG so demo data looks the same each reset
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeed(): DataState {
  const rnd = mulberry32(42);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const t0 = today();
  const dayTs = (d: string, h = 12) => parseISO(d).getTime() + h * 3600000;

  const projects: Project[] = [
    { id: 'p-web', name: 'Website Relaunch', color: '#0071e3', icon: '', archived: false },
    { id: 'p-health', name: 'Health', color: '#34a853', icon: '', archived: false },
    { id: 'p-learn', name: 'Learning', color: '#f5a623', icon: '', archived: false },
    { id: 'p-home', name: 'Home', color: '#af52de', icon: '', archived: false },
    { id: 'p-side', name: 'Side Project', color: '#5ac8fa', icon: '', archived: false },
  ];

  const mk = (title: string, o: Partial<Task> = {}): Task => ({
    id: uid(),
    title,
    description: '',
    status: 'todo',
    priority: 0,
    due: null,
    dueTime: null,
    tags: [],
    projectId: null,
    subtasks: [],
    estimate: null,
    timeSpent: 0,
    recurrence: null,
    createdAt: dayTs(addDays(t0, -10)),
    completedAt: null,
    order: 0,
    ...o,
  });

  const st = (...titles: string[]) => titles.map((title, i) => ({ id: uid(), title, done: i === 0 }));

  const tasks: Task[] = [
    mk('Finalize landing page copy', { projectId: 'p-web', priority: 3, due: t0, dueTime: '15:00', status: 'doing', tags: ['writing'], estimate: 90, timeSpent: 50, subtasks: st('Hero headline', 'Feature section', 'Pricing FAQ'), description: 'Tone: confident, concise. Reference [[Brand Voice]] note.' }),
    mk('Review pull request #214', { projectId: 'p-web', priority: 2, due: t0, tags: ['code-review'], estimate: 30 }),
    mk('Morning run 5k', { projectId: 'p-health', priority: 1, due: t0, dueTime: '07:00', recurrence: 'weekdays', tags: ['fitness'] }),
    mk('Pay electricity bill', { projectId: 'p-home', priority: 4, due: addDays(t0, -1), tags: ['bills'] }),
    mk('Set up analytics dashboard', { projectId: 'p-web', priority: 2, due: addDays(t0, 2), status: 'todo', estimate: 120, subtasks: st('Pick tool', 'Add tracking snippet', 'Define KPIs') }),
    mk('Read chapter 7 — Designing Data-Intensive Apps', { projectId: 'p-learn', priority: 1, due: addDays(t0, 1), tags: ['reading'], estimate: 45 }),
    mk('Weekly review', { priority: 2, due: addDays(t0, (7 - weekdayOf(t0)) % 7), recurrence: 'weekly', tags: ['planning'], estimate: 30 }),
    mk('Book dentist appointment', { projectId: 'p-health', priority: 1, due: addDays(t0, 4) }),
    mk('Prototype AI search feature', { projectId: 'p-side', priority: 3, status: 'backlog', estimate: 240, tags: ['ai', 'prototype'] }),
    mk('Write blog post: local-first software', { projectId: 'p-side', priority: 2, status: 'backlog', tags: ['writing'] }),
    mk('Fix leaking kitchen faucet', { projectId: 'p-home', priority: 2, due: addDays(t0, 3), status: 'todo' }),
    mk('Design system tokens audit', { projectId: 'p-web', priority: 2, status: 'doing', due: addDays(t0, 1), estimate: 60, timeSpent: 25 }),
    mk('Plan weekend hike', { priority: 0, status: 'backlog', tags: ['fun'] }),
    mk('Migrate DB to Postgres 17', { projectId: 'p-side', priority: 3, due: addDays(t0, 6), estimate: 180 }),
    mk('Grocery shopping', { projectId: 'p-home', priority: 1, due: addDays(t0, 1), dueTime: '18:00', subtasks: st('Vegetables', 'Coffee', 'Oat milk', 'Rice') }),
  ];
  tasks.forEach((t, i) => (t.order = i));

  // completed history for analytics (past 60 days)
  const doneTitles = ['Reply to client emails', 'Update dependencies', 'Refactor auth module', 'Meal prep', 'Yoga session', 'Call parents', 'Sprint planning', 'Clean inbox', 'Write unit tests', 'Research competitors', 'Update resume', 'Clean desk', 'Fix navbar bug', 'Deploy staging', 'Water plants', 'Read 30 pages'];
  for (let d = 60; d >= 1; d--) {
    const day = addDays(t0, -d);
    const n = Math.floor(rnd() * (weekdayOf(day) % 6 === 0 ? 2 : 5)) + (d < 20 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      tasks.push(
        mk(pick(doneTitles), {
          status: 'done',
          projectId: pick([...projects.map((p) => p.id), null]),
          priority: Math.floor(rnd() * 4) as Task['priority'],
          due: day,
          createdAt: dayTs(addDays(day, -2)),
          completedAt: dayTs(day, 9 + Math.floor(rnd() * 10)),
          order: 1000 + d * 10 + k,
        })
      );
    }
  }

  const notes: Note[] = [
    {
      id: uid(),
      title: 'Welcome to Nexus',
      folder: 'Inbox',
      pinned: true,
      tags: ['guide'],
      createdAt: dayTs(t0, 8),
      updatedAt: Date.now(),
      content: `# Welcome to Nexus

Nexus is your **personal operating system** — tasks, notes, calendar, habits, focus, goals, journal and finances in one fast, private, local-first app.

> [!tip] Pro tip
> Press **Ctrl/⌘ + K** anywhere to open the command palette.

## Quick capture
Press **N** (or the + button) and type naturally:
\`Pay rent tomorrow 9am !high #bills +Home ~15m\`

Nexus understands dates, times, priorities (\`!urgent\` / \`p1\`), tags, projects, estimates and recurrence (\`every week\`).

## Linked notes
Link notes with double brackets like [[Brand Voice]] or [[Reading List]]. Backlinks appear automatically at the bottom of each note. Clicking a link to a note that doesn't exist creates it: [[Ideas Inbox]].

## Checklists
- [x] Open Nexus
- [ ] Create your first task
- [ ] Start a focus session
- [ ] Log a habit

## Keyboard shortcuts
| Keys | Action |
| --- | --- |
| Ctrl/⌘ K | Command palette |
| N | Quick add task |
| G then D/T/N/C/H/F | Go to page |
| ? | Show all shortcuts |

---
Everything is stored **locally in your browser**. Export a backup anytime from *Settings*. #guide`,
    },
    {
      id: uid(),
      title: 'Brand Voice',
      folder: 'Work',
      pinned: false,
      tags: ['work', 'writing'],
      createdAt: dayTs(addDays(t0, -12)),
      updatedAt: dayTs(addDays(t0, -2)),
      content: `# Brand Voice

Our voice is **clear**, *warm*, and ==confident==.

## Principles
1. Say less, mean more
2. Lead with the benefit
3. Never use jargon without explaining it

## Words we love
- Effortless
- Crafted
- Focused

## Words we avoid
- ~~Synergy~~
- ~~Disruptive~~

Related: [[Welcome to Nexus]] #work`,
    },
    {
      id: uid(),
      title: 'Reading List',
      folder: 'Personal',
      pinned: false,
      tags: ['books'],
      createdAt: dayTs(addDays(t0, -30)),
      updatedAt: dayTs(addDays(t0, -5)),
      content: `# Reading List

- [x] Deep Work — Cal Newport
- [x] Atomic Habits — James Clear
- [ ] Designing Data-Intensive Applications — Martin Kleppmann
- [ ] The Pragmatic Programmer
- [ ] Thinking in Systems — Donella Meadows

> Reading is to the mind what exercise is to the body.

#books #learning`,
    },
    {
      id: uid(),
      title: 'Side Project Architecture',
      folder: 'Work',
      pinned: false,
      tags: ['engineering'],
      createdAt: dayTs(addDays(t0, -8)),
      updatedAt: dayTs(addDays(t0, -1)),
      content: `# Side Project Architecture

## Stack
- Frontend: React + TypeScript
- Backend: \`Go\` services behind an API gateway
- Storage: Postgres 17 + Redis cache

\`\`\`ts
export async function search(q: string) {
  const res = await fetch('/api/search?q=' + encodeURIComponent(q));
  return res.json();
}
\`\`\`

## Open questions
- [ ] Vector DB or pgvector?
- [ ] Self-host or managed?

See also [[Reading List]] #engineering`,
    },
  ];

  const ev = (dOff: number, title: string, start: string, end: string, color: string, location = ''): CalEvent => ({
    id: uid(),
    title,
    date: addDays(t0, dOff),
    start,
    end,
    allDay: false,
    color,
    location,
    notes: '',
  });
  const events: CalEvent[] = [
    ev(0, 'Team standup', '09:30', '09:45', '#5ac8fa', 'Zoom'),
    ev(0, 'Design review', '13:00', '14:00', '#0071e3', 'Room 4B'),
    ev(0, 'Gym', '18:30', '19:30', '#34a853'),
    ev(1, 'Team standup', '09:30', '09:45', '#5ac8fa', 'Zoom'),
    ev(1, '1:1 with manager', '11:00', '11:30', '#f5a623'),
    ev(2, 'Client call — Acme', '15:00', '16:00', '#af52de', 'Google Meet'),
    ev(3, 'Dinner with Sam', '19:30', '21:30', '#ff3b30', 'Luigi’s'),
    ev(5, 'Hackathon', '10:00', '17:00', '#0071e3'),
    ev(-1, 'Sprint retro', '16:00', '17:00', '#5ac8fa'),
    ev(-3, 'Doctor', '08:30', '09:15', '#34a853'),
    { ...ev(8, 'Mom’s birthday', '00:00', '23:59', '#af52de'), allDay: true },
  ];

  const habitDefs: [string, string, string, number, number][] = [
    ['Drink water', 'droplet', '#5ac8fa', 8, 0.85],
    ['Meditate', 'wind', '#0071e3', 1, 0.7],
    ['Read 20 min', 'book', '#f5a623', 1, 0.6],
    ['Exercise', 'activity', '#34a853', 1, 0.55],
    ['No phone after 10pm', 'phoneOff', '#ff3b30', 1, 0.45],
  ];
  const habits: Habit[] = habitDefs.map(([name, icon, color, target, p]) => {
    const log: Record<string, number> = {};
    for (let d = 90; d >= 1; d--) {
      const day = addDays(t0, -d);
      const bias = d < 14 ? 0.1 : 0;
      if (rnd() < p + bias) log[day] = target > 1 ? Math.min(target, Math.ceil(rnd() * target + 2)) : 1;
    }
    if (rnd() < 0.5) log[t0] = target > 1 ? 3 : 1;
    return { id: uid(), name, icon, color, targetPerDay: target, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], log, createdAt: dayTs(addDays(t0, -90)), archived: false };
  });

  const sessions: FocusSession[] = [];
  for (let d = 45; d >= 0; d--) {
    const day = addDays(t0, -d);
    const n = d === 0 ? 2 : Math.floor(rnd() * 6);
    for (let k = 0; k < n; k++)
      sessions.push({ id: uid(), start: dayTs(day, 9 + k * 1.2), minutes: pick([25, 25, 25, 50, 45, 30]), taskId: k === 0 && d < 5 ? tasks[0].id : null, kind: 'focus' });
  }

  // ── Finance (LKR) ──
  const acc = (id: string, name: string, type: Account['type'], institution: string, last4: string, openingBalance: number, color: string): Account => ({
    id, name, type, institution, last4, openingBalance, color, archived: false, createdAt: dayTs(addDays(t0, -95)),
  });
  const accounts: Account[] = [
    acc('a-salary', 'Salary account', 'bank', 'Commercial Bank', '4821', 312500, '#0071e3'),
    acc('a-savings', 'Savings', 'savings', 'Sampath Bank', '1107', 1180000, '#34a853'),
    acc('a-cash', 'Cash', 'cash', '', '', 18500, '#8e8e93'),
    acc('a-card', 'Credit card', 'card', 'HNB', '9034', -24600, '#1d1d1f'),
    acc('a-frimi', 'FriMi', 'wallet', 'Nations Trust', '', 6200, '#af52de'),
  ];
  const expenseCats: [string, number, number, string[]][] = [
    ['Groceries', 2800, 16500, ['a-card', 'a-salary', 'a-cash']],
    ['Dining', 1400, 7800, ['a-card', 'a-cash', 'a-frimi']],
    ['Transport', 380, 2600, ['a-frimi', 'a-cash']],
    ['Fuel', 5000, 12000, ['a-card', 'a-salary']],
    ['Entertainment', 1500, 6500, ['a-card']],
    ['Shopping', 3500, 24000, ['a-card', 'a-salary']],
    ['Health', 1800, 9500, ['a-salary', 'a-cash']],
  ];
  const transactions: Transaction[] = [];
  let seq = 0;
  const tx = (date: string, kind: Transaction['kind'], amount: number, category: string, note: string, accountId: string, toAccountId: string | null = null) =>
    transactions.push({ id: uid(), date, kind, amount, category, note, accountId, toAccountId, createdAt: dayTs(date, 8) + seq++ });
  for (let d = 90; d >= 0; d--) {
    const day = addDays(t0, -d);
    const dom = parseISO(day).getDate();
    if (dom === 1) {
      tx(day, 'income', 285000, 'Salary', 'Monthly salary', 'a-salary');
      tx(day, 'expense', -85000, 'Rent', 'Apartment rent', 'a-salary');
      tx(day, 'transfer', 50000, 'Transfer', 'Monthly savings', 'a-salary', 'a-savings');
    }
    if (dom === 3) tx(day, 'expense', -2890, 'Mobile & Internet', 'Dialog Fibre + mobile', 'a-salary');
    if (dom === 5) tx(day, 'expense', -3950, 'Subscriptions', 'Netflix · Spotify · iCloud', 'a-card');
    if (dom === 8) {
      tx(day, 'expense', -9840, 'Utilities', 'CEB electricity', 'a-salary');
      tx(day, 'expense', -1760, 'Utilities', 'Water board', 'a-salary');
    }
    if (dom === 10) tx(day, 'transfer', 12000, 'Transfer', 'FriMi top-up', 'a-salary', 'a-frimi');
    if (dom === 12 || dom === 25) tx(day, 'transfer', 25000, 'Transfer', 'ATM withdrawal', 'a-salary', 'a-cash');
    if (dom === 15) tx(day, 'income', 45000, 'Freelance', 'Logo design project', 'a-salary');
    if (dom === 20) tx(day, 'transfer', 60000, 'Transfer', 'Credit card payment', 'a-salary', 'a-card');
    if (dom === 28) tx(day, 'income', 3120, 'Interest', 'Savings interest', 'a-savings');
    if (rnd() < 0.72) {
      const [cat, lo, hi, accs] = pick(expenseCats);
      tx(day, 'expense', -Math.round((lo + rnd() * (hi - lo)) / 10) * 10, cat, '', pick(accs));
    }
  }
  transactions.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));

  const journal: Record<string, JournalEntry> = {};
  const lines = ['Productive day, shipped the new feature.', 'Felt tired but managed a workout.', 'Great conversation with a friend.', 'Struggled to focus in the afternoon.', 'Learned something new about systems design.', 'Relaxed evening, read a book.'];
  for (let d = 30; d >= 1; d--) {
    if (rnd() < 0.75) {
      const day = addDays(t0, -d);
      journal[day] = {
        date: day,
        mood: (Math.floor(rnd() * 3) + 3) as JournalEntry['mood'],
        energy: (Math.floor(rnd() * 4) + 2) as JournalEntry['energy'],
        text: pick(lines),
        gratitude: pick(['Coffee', 'Sunshine', 'Family', 'Good health', 'My team']),
      };
    }
  }

  const goals: Goal[] = [
    { id: uid(), title: 'Launch the new website', description: 'Ship v2 of the marketing site.', deadline: addDays(t0, 21), metric: 'tasks', target: 0, manualProgress: 0, projectId: 'p-web', color: '#0071e3', createdAt: dayTs(addDays(t0, -20)) },
    { id: uid(), title: 'Deep work: 40 hours this month', description: 'Protect focus time.', deadline: addDays(t0, 30), metric: 'focus', target: 2400, manualProgress: 0, projectId: null, color: '#5ac8fa', createdAt: dayTs(addDays(t0, -15)) },
    { id: uid(), title: 'Read 12 books this year', description: '', deadline: null, metric: 'manual', target: 12, manualProgress: 7, projectId: null, color: '#f5a623', createdAt: dayTs(addDays(t0, -100)) },
  ];

  return {
    version: 3,
    tasks,
    projects,
    notes,
    events,
    habits,
    sessions,
    transactions,
    accounts,
    budgets: { Groceries: 55000, Dining: 22000, Transport: 9000, Fuel: 25000, Entertainment: 12000, Shopping: 40000, Utilities: 15000, Health: 15000 },
    journal,
    goals,
    activity: [
      { id: uid(), ts: Date.now() - 60000, kind: 'system', text: 'Workspace created with demo data' },
    ],
    settings: {
      name: 'Alex',
      theme: 'light',
      accent: '#0071e3',
      weekStart: 1,
      focusMinutes: 25,
      shortBreak: 5,
      longBreak: 15,
      sessionsBeforeLong: 4,
      currency: 'LKR',
      sounds: true,
      notifications: false,
      density: 'comfortable',
      dailyFocusGoal: 120,
      reduceMotion: false,
    },
  };
}
