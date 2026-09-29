import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  Account,
  Activity,
  CalEvent,
  DataState,
  FocusSession,
  Goal,
  Habit,
  ID,
  ISODate,
  JournalEntry,
  Note,
  Project,
  Settings,
  Task,
  TaskStatus,
  Transaction,
} from '../types';
import { uid } from '../lib/id';
import { addDays, addMonths, today, weekdayOf } from '../lib/date';
import { createSeed } from '../lib/seed';

export const DATA_VERSION = 3;

export const defaultSettings: Settings = {
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
};

export const emptyData = (): DataState => ({
  version: DATA_VERSION,
  tasks: [],
  projects: [],
  notes: [],
  events: [],
  habits: [],
  sessions: [],
  accounts: [],
  transactions: [],
  budgets: {},
  journal: {},
  goals: [],
  activity: [],
  settings: { ...defaultSettings },
});

export interface Actions {
  // tasks
  addTask: (t: Partial<Task> & { title: string }) => Task;
  updateTask: (id: ID, patch: Partial<Task>) => void;
  deleteTask: (id: ID) => Task | undefined;
  restoreTask: (t: Task) => void;
  toggleTask: (id: ID) => void;
  moveTask: (id: ID, status: TaskStatus, beforeId?: ID | null) => void;
  toggleSubtask: (taskId: ID, subId: ID) => void;
  bulkUpdateTasks: (ids: ID[], patch: Partial<Task>) => void;
  bulkDeleteTasks: (ids: ID[]) => void;
  // projects
  addProject: (p: Partial<Project> & { name: string }) => Project;
  updateProject: (id: ID, patch: Partial<Project>) => void;
  deleteProject: (id: ID) => void;
  // notes
  addNote: (n?: Partial<Note>) => Note;
  updateNote: (id: ID, patch: Partial<Note>) => void;
  deleteNote: (id: ID) => Note | undefined;
  restoreNote: (n: Note) => void;
  // events
  addEvent: (e: Partial<CalEvent> & { title: string; date: ISODate }) => CalEvent;
  updateEvent: (id: ID, patch: Partial<CalEvent>) => void;
  deleteEvent: (id: ID) => CalEvent | undefined;
  restoreEvent: (e: CalEvent) => void;
  // habits
  addHabit: (h: Partial<Habit> & { name: string }) => Habit;
  updateHabit: (id: ID, patch: Partial<Habit>) => void;
  deleteHabit: (id: ID) => void;
  checkHabit: (id: ID, date: ISODate, delta?: number) => void;
  // focus
  logSession: (s: Omit<FocusSession, 'id'>) => void;
  // finance
  addAccount: (a: Partial<Account> & { name: string }) => Account;
  updateAccount: (id: ID, patch: Partial<Account>) => void;
  /** Deletes the account; its transactions are removed too. Returns what was removed for undo. */
  deleteAccount: (id: ID) => { account: Account; transactions: Transaction[] } | undefined;
  restoreAccount: (a: Account, tx: Transaction[]) => void;
  /** Records a balance adjustment so the account shows exactly `target` today. */
  setAccountBalance: (id: ID, target: number, currentBalance: number) => void;
  addTransaction: (t: Omit<Transaction, 'id' | 'createdAt'> & { createdAt?: number }) => Transaction;
  restoreTransaction: (t: Transaction) => void;
  updateTransaction: (id: ID, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: ID) => void;
  setBudget: (category: string, amount: number | null) => void;
  // journal
  saveJournal: (e: JournalEntry) => void;
  // goals
  addGoal: (g: Partial<Goal> & { title: string }) => Goal;
  updateGoal: (id: ID, patch: Partial<Goal>) => void;
  deleteGoal: (id: ID) => void;
  // system
  updateSettings: (patch: Partial<Settings>) => void;
  importData: (d: DataState) => void;
  resetDemo: () => void;
  clearAll: () => void;
  log: (kind: Activity['kind'], text: string) => void;
}

export type Store = DataState & Actions;

const nextDue = (due: ISODate, rec: Task['recurrence']): ISODate => {
  switch (rec) {
    case 'daily':
      return addDays(due, 1);
    case 'weekdays': {
      let d = addDays(due, 1);
      while ([0, 6].includes(weekdayOf(d))) d = addDays(d, 1);
      return d;
    }
    case 'weekly':
      return addDays(due, 7);
    case 'monthly':
      return addMonths(due, 1);
    default:
      return due;
  }
};

export const useData = create<Store>()(
  persist(
    (set, get) => {
      const log = (kind: Activity['kind'], text: string) =>
        set((s) => ({ activity: [{ id: uid(), ts: Date.now(), kind, text }, ...s.activity].slice(0, 300) }));

      return {
        ...createSeed(),
        log,

        addTask: (t) => {
          const tasks = get().tasks;
          const task: Task = {
            id: uid(),
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
            createdAt: Date.now(),
            completedAt: null,
            order: tasks.length ? Math.min(...tasks.map((x) => x.order)) - 1 : 0,
            ...t,
          };
          set({ tasks: [task, ...tasks] });
          log('task', `Created task “${task.title}”`);
          return task;
        },
        updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
        deleteTask: (id) => {
          const t = get().tasks.find((x) => x.id === id);
          set((s) => ({ tasks: s.tasks.filter((x) => x.id !== id) }));
          if (t) log('task', `Deleted task “${t.title}”`);
          return t;
        },
        restoreTask: (t) => set((s) => ({ tasks: [t, ...s.tasks] })),
        toggleTask: (id) => {
          const t = get().tasks.find((x) => x.id === id);
          if (!t) return;
          const done = t.status !== 'done';
          set((s) => ({
            tasks: s.tasks.map((x) => (x.id === id ? { ...x, status: done ? 'done' : 'todo', completedAt: done ? Date.now() : null } : x)),
          }));
          if (done) {
            log('task', `Completed “${t.title}”`);
            if (t.recurrence) {
              const base = t.due || today();
              get().addTask({
                ...t,
                id: uid(),
                status: 'todo',
                completedAt: null,
                timeSpent: 0,
                createdAt: Date.now(),
                due: nextDue(base < today() ? today() : base, t.recurrence),
                subtasks: t.subtasks.map((st) => ({ ...st, id: uid(), done: false })),
              });
            }
          }
        },
        moveTask: (id, status, beforeId) =>
          set((s) => {
            const moving = s.tasks.find((t) => t.id === id);
            if (!moving) return s;
            const column = s.tasks.filter((t) => t.status === status && t.id !== id).sort((a, b) => a.order - b.order);
            let order: number;
            if (!beforeId) order = column.length ? column[column.length - 1].order + 1 : 0;
            else {
              const idx = column.findIndex((t) => t.id === beforeId);
              const prev = column[idx - 1];
              const next = column[idx];
              order = prev ? (prev.order + next.order) / 2 : next.order - 1;
            }
            const wasDone = moving.status === 'done';
            const isDone = status === 'done';
            return {
              tasks: s.tasks.map((t) =>
                t.id === id ? { ...t, status, order, completedAt: isDone ? (wasDone ? t.completedAt : Date.now()) : null } : t
              ),
            };
          }),
        toggleSubtask: (taskId, subId) =>
          set((s) => ({
            tasks: s.tasks.map((t) =>
              t.id === taskId ? { ...t, subtasks: t.subtasks.map((st) => (st.id === subId ? { ...st, done: !st.done } : st)) } : t
            ),
          })),
        bulkUpdateTasks: (ids, patch) => {
          const set_ = new Set(ids);
          set((s) => ({
            tasks: s.tasks.map((t) =>
              set_.has(t.id)
                ? { ...t, ...patch, completedAt: patch.status === 'done' ? Date.now() : patch.status ? null : t.completedAt }
                : t
            ),
          }));
          log('task', `Bulk-updated ${ids.length} tasks`);
        },
        bulkDeleteTasks: (ids) => {
          const set_ = new Set(ids);
          set((s) => ({ tasks: s.tasks.filter((t) => !set_.has(t.id)) }));
          log('task', `Deleted ${ids.length} tasks`);
        },

        addProject: (p) => {
          const project: Project = { id: uid(), color: '#7c5cff', icon: '', archived: false, ...p };
          set((s) => ({ projects: [...s.projects, project] }));
          log('task', `Created project “${project.name}”`);
          return project;
        },
        updateProject: (id, patch) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
        deleteProject: (id) =>
          set((s) => ({
            projects: s.projects.filter((p) => p.id !== id),
            tasks: s.tasks.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)),
          })),

        addNote: (n = {}) => {
          const note: Note = {
            id: uid(),
            title: 'Untitled',
            content: '',
            tags: [],
            pinned: false,
            folder: 'Inbox',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            ...n,
          };
          set((s) => ({ notes: [note, ...s.notes] }));
          log('note', `Created note “${note.title}”`);
          return note;
        },
        updateNote: (id, patch) =>
          set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)) })),
        deleteNote: (id) => {
          const n = get().notes.find((x) => x.id === id);
          set((s) => ({ notes: s.notes.filter((x) => x.id !== id) }));
          if (n) log('note', `Deleted note “${n.title}”`);
          return n;
        },
        restoreNote: (n) => set((s) => ({ notes: [n, ...s.notes] })),

        addEvent: (e) => {
          const ev: CalEvent = { id: uid(), start: '09:00', end: '10:00', allDay: false, color: '#0071e3', location: '', notes: '', ...e };
          set((s) => ({ events: [...s.events, ev] }));
          log('event', `Scheduled “${ev.title}”`);
          return ev;
        },
        updateEvent: (id, patch) => set((s) => ({ events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),
        deleteEvent: (id) => {
          const e = get().events.find((x) => x.id === id);
          set((s) => ({ events: s.events.filter((x) => x.id !== id) }));
          return e;
        },
        restoreEvent: (e) => set((s) => ({ events: [...s.events, e] })),

        addHabit: (h) => {
          const habit: Habit = {
            id: uid(),
            icon: 'check',
            color: '#0071e3',
            targetPerDay: 1,
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            log: {},
            createdAt: Date.now(),
            archived: false,
            ...h,
          };
          set((s) => ({ habits: [...s.habits, habit] }));
          log('habit', `Started habit “${habit.name}”`);
          return habit;
        },
        updateHabit: (id, patch) => set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
        deleteHabit: (id) => set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),
        checkHabit: (id, date, delta) =>
          set((s) => ({
            habits: s.habits.map((h) => {
              if (h.id !== id) return h;
              const cur = h.log[date] || 0;
              let next: number;
              if (delta === undefined) next = cur >= h.targetPerDay ? 0 : h.targetPerDay;
              else next = Math.max(0, cur + delta);
              const log_ = { ...h.log };
              if (next) log_[date] = next;
              else delete log_[date];
              return { ...h, log: log_ };
            }),
          })),

        logSession: (sess) => {
          set((s) => ({
            sessions: [...s.sessions, { ...sess, id: uid() }],
            tasks: sess.taskId && sess.kind === 'focus' ? s.tasks.map((t) => (t.id === sess.taskId ? { ...t, timeSpent: t.timeSpent + sess.minutes } : t)) : s.tasks,
          }));
          if (sess.kind === 'focus') log('focus', `Focused for ${sess.minutes} min`);
        },

        addAccount: (a) => {
          const acc: Account = {
            id: uid(),
            type: 'bank',
            institution: '',
            last4: '',
            openingBalance: 0,
            color: '#0071e3',
            archived: false,
            createdAt: Date.now(),
            ...a,
          };
          set((s) => ({ accounts: [...s.accounts, acc] }));
          log('finance', `Added account “${acc.name}”`);
          return acc;
        },
        updateAccount: (id, patch) => set((s) => ({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
        deleteAccount: (id) => {
          const account = get().accounts.find((a) => a.id === id);
          if (!account) return undefined;
          const transactions = get().transactions.filter((t) => t.accountId === id || t.toAccountId === id);
          set((s) => ({
            accounts: s.accounts.filter((a) => a.id !== id),
            transactions: s.transactions.filter((t) => t.accountId !== id && t.toAccountId !== id),
          }));
          log('finance', `Deleted account “${account.name}”`);
          return { account, transactions };
        },
        restoreAccount: (a, tx) => set((s) => ({ accounts: [...s.accounts, a], transactions: [...tx, ...s.transactions] })),
        setAccountBalance: (id, target, currentBalance) => {
          const diff = Math.round((target - currentBalance) * 100) / 100;
          if (!diff) return;
          const acc = get().accounts.find((a) => a.id === id);
          get().addTransaction({
            date: today(),
            kind: 'adjustment',
            amount: diff,
            category: 'Balance adjustment',
            note: `Balance set to ${target.toLocaleString('en-LK')}`,
            accountId: id,
            toAccountId: null,
          });
          if (acc) log('finance', `Balance of “${acc.name}” set by hand`);
        },
        addTransaction: (t) => {
          const tx: Transaction = { createdAt: Date.now(), ...t, id: uid() };
          set((s) => ({ transactions: [tx, ...s.transactions] }));
          const verb = tx.kind === 'transfer' ? 'Transfer' : tx.kind === 'adjustment' ? 'Adjustment' : tx.amount < 0 ? 'Expense' : 'Income';
          if (tx.kind !== 'adjustment') log('finance', `${verb}: ${Math.abs(tx.amount).toLocaleString('en-LK')} · ${tx.category}`);
          return tx;
        },
        restoreTransaction: (t) => set((s) => ({ transactions: [t, ...s.transactions] })),
        updateTransaction: (id, patch) =>
          set((s) => ({ transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
        deleteTransaction: (id) => set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) })),
        setBudget: (category, amount) =>
          set((s) => {
            const b = { ...s.budgets };
            if (amount === null || amount <= 0) delete b[category];
            else b[category] = amount;
            return { budgets: b };
          }),

        saveJournal: (e) => {
          const existed = !!get().journal[e.date];
          set((s) => ({ journal: { ...s.journal, [e.date]: e } }));
          if (!existed) log('journal', `Journaled for ${e.date}`);
        },

        addGoal: (g) => {
          const goal: Goal = {
            id: uid(),
            description: '',
            deadline: null,
            metric: 'manual',
            target: 100,
            manualProgress: 0,
            projectId: null,
            color: '#0071e3',
            createdAt: Date.now(),
            ...g,
          };
          set((s) => ({ goals: [...s.goals, goal] }));
          log('system', `New goal “${goal.title}”`);
          return goal;
        },
        updateGoal: (id, patch) => set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),
        deleteGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        importData: (d) => {
          if (!d.version || d.version < 3 || !Array.isArray(d.accounts)) migrateFinanceV3(d);
          set({ ...emptyData(), ...d, settings: { ...defaultSettings, ...d.settings } });
          log('system', 'Imported workspace data');
        },
        resetDemo: () => set({ ...createSeed(), settings: get().settings }),
        clearAll: () => set({ ...emptyData(), settings: get().settings }),
      };
    },
    {
      name: 'nexus-data',
      version: DATA_VERSION,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted, from) => migrate(persisted as DataState, from),
      partialize: (s) => {
        // strip functions
        const { tasks, projects, notes, events, habits, sessions, accounts, transactions, budgets, journal, goals, activity, settings, version } = s;
        return { tasks, projects, notes, events, habits, sessions, accounts, transactions, budgets, journal, goals, activity, settings, version };
      },
    }
  )
);

const LEGACY_COLORS: Record<string, string> = { '#7c5cff': '#0071e3', '#00d4ff': '#5ac8fa', '#22c55e': '#34a853', '#f59e0b': '#f5a623', '#ec4899': '#af52de', '#ef4444': '#ff3b30' };
const LEGACY_HABIT_ICONS: Record<string, string> = { '💧': 'droplet', '🧘': 'wind', '📖': 'book', '🏃': 'activity', '📵': 'phoneOff', '✨': 'check', '💪': 'dumbbell' };
const recolor = (c: string) => LEGACY_COLORS[c] || c;

/** v1 → v2: move from the old purple/emoji look to the neutral design language. */
function migrate(d: DataState, from: number): DataState {
  if (from < 2 && d) {
    d.projects = (d.projects || []).map((p) => ({ ...p, icon: '', color: recolor(p.color) }));
    d.habits = (d.habits || []).map((h) => ({ ...h, icon: LEGACY_HABIT_ICONS[h.icon] || (/^[a-z]/i.test(h.icon) ? h.icon : 'check'), color: recolor(h.color) }));
    d.events = (d.events || []).map((e) => ({ ...e, color: recolor(e.color), title: e.title.replace(/\s*\p{Extended_Pictographic}/gu, '') }));
    d.goals = (d.goals || []).map((g) => ({ ...g, color: recolor(g.color) }));
    d.notes = (d.notes || []).map((n) => ({ ...n, content: n.content.replace(/ ?\p{Extended_Pictographic}\uFE0F?/gu, '') }));
    if (d.settings) {
      if (d.settings.accent === '#7c5cff') d.settings.accent = '#0071e3';
      if (d.settings.theme === 'dark') d.settings.theme = 'light';
    }
    d.version = 2;
  }
  if (from < 3 && d) migrateFinanceV3(d);
  return d;
}

type LegacyTx = { id: string; date: string; amount: number; category: string; note: string; account?: string; kind?: string };

/** v2 → v3: free-text account names become real accounts with balances; currency defaults to LKR. */
export function migrateFinanceV3(d: DataState) {
  const legacy = (d.transactions || []) as unknown as LegacyTx[];
  const accounts: Account[] = Array.isArray(d.accounts) ? d.accounts : [];
  const byName = new Map(accounts.map((a) => [a.name.toLowerCase(), a]));
  const ensure = (name: string) => {
    const key = (name || 'Main account').trim() || 'Main account';
    const hit = byName.get(key.toLowerCase());
    if (hit) return hit;
    const lower = key.toLowerCase();
    const type: Account['type'] = /card|credit/.test(lower) ? 'card' : /cash/.test(lower) ? 'cash' : /sav/.test(lower) ? 'savings' : 'bank';
    const acc: Account = {
      id: uid(),
      name: key,
      type,
      institution: '',
      last4: '',
      openingBalance: 0,
      color: ['#0071e3', '#1d1d1f', '#34a853', '#f5a623'][accounts.length % 4],
      archived: false,
      createdAt: Date.now(),
    };
    accounts.push(acc);
    byName.set(lower, acc);
    return acc;
  };
  d.transactions = legacy.map((t, i) => {
    if ((t as unknown as Transaction).accountId) return t as unknown as Transaction;
    const kind: Transaction['kind'] = t.amount >= 0 ? 'income' : 'expense';
    return {
      id: t.id,
      date: t.date,
      kind,
      amount: t.amount,
      category: t.category,
      note: t.note || '',
      accountId: ensure(t.account || 'Main account').id,
      toAccountId: null,
      createdAt: Date.now() - i,
    };
  });
  d.accounts = accounts;
  if (d.settings && (!d.settings.currency || d.settings.currency === 'USD')) d.settings.currency = 'LKR';
  d.version = 3;
}

export const getData = (): DataState => {
  const { tasks, projects, notes, events, habits, sessions, accounts, transactions, budgets, journal, goals, activity, settings, version } = useData.getState();
  return { tasks, projects, notes, events, habits, sessions, accounts, transactions, budgets, journal, goals, activity, settings, version };
};
