import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
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

export const DATA_VERSION = 1;

export const defaultSettings: Settings = {
  name: 'Alex',
  theme: 'dark',
  accent: '#7c5cff',
  weekStart: 1,
  focusMinutes: 25,
  shortBreak: 5,
  longBreak: 15,
  sessionsBeforeLong: 4,
  currency: 'USD',
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
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
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
          const project: Project = { id: uid(), color: '#7c5cff', icon: '📁', archived: false, ...p };
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
          const ev: CalEvent = { id: uid(), start: '09:00', end: '10:00', allDay: false, color: '#00d4ff', location: '', notes: '', ...e };
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
            icon: '✨',
            color: '#22c55e',
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

        addTransaction: (t) => {
          set((s) => ({ transactions: [{ ...t, id: uid() }, ...s.transactions] }));
          log('finance', `${t.amount < 0 ? 'Expense' : 'Income'}: ${Math.abs(t.amount).toFixed(2)} · ${t.category}`);
        },
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
            color: '#7c5cff',
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
      partialize: (s) => {
        // strip functions
        const { tasks, projects, notes, events, habits, sessions, transactions, budgets, journal, goals, activity, settings, version } = s;
        return { tasks, projects, notes, events, habits, sessions, transactions, budgets, journal, goals, activity, settings, version };
      },
    }
  )
);

export const getData = (): DataState => {
  const { tasks, projects, notes, events, habits, sessions, transactions, budgets, journal, goals, activity, settings, version } = useData.getState();
  return { tasks, projects, notes, events, habits, sessions, transactions, budgets, journal, goals, activity, settings, version };
};
