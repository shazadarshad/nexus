export type ID = string;
export type ISODate = string; // yyyy-mm-dd

export type TaskStatus = 'backlog' | 'todo' | 'doing' | 'done';
export type Priority = 0 | 1 | 2 | 3 | 4; // none, low, medium, high, urgent
export type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly' | null;

export interface Subtask {
  id: ID;
  title: string;
  done: boolean;
}

export interface Task {
  id: ID;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  due: ISODate | null;
  dueTime: string | null; // HH:MM
  tags: string[];
  projectId: ID | null;
  subtasks: Subtask[];
  estimate: number | null; // minutes
  timeSpent: number; // minutes (from focus sessions)
  recurrence: Recurrence;
  createdAt: number;
  completedAt: number | null;
  order: number;
}

export interface Project {
  id: ID;
  name: string;
  color: string;
  icon: string;
  archived: boolean;
}

export interface Note {
  id: ID;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  folder: string;
  createdAt: number;
  updatedAt: number;
}

export interface CalEvent {
  id: ID;
  title: string;
  date: ISODate;
  start: string; // HH:MM
  end: string; // HH:MM
  allDay: boolean;
  color: string;
  location: string;
  notes: string;
}

export interface Habit {
  id: ID;
  name: string;
  icon: string;
  color: string;
  targetPerDay: number;
  daysOfWeek: number[]; // 0=Sun..6
  log: Record<ISODate, number>;
  createdAt: number;
  archived: boolean;
}

export interface FocusSession {
  id: ID;
  start: number;
  minutes: number;
  taskId: ID | null;
  kind: 'focus' | 'break';
}

export interface Transaction {
  id: ID;
  date: ISODate;
  amount: number; // + income, - expense
  category: string;
  note: string;
  account: string;
}

export interface JournalEntry {
  date: ISODate;
  mood: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  text: string;
  gratitude: string;
}

export interface Activity {
  id: ID;
  ts: number;
  kind: 'task' | 'note' | 'event' | 'habit' | 'focus' | 'finance' | 'journal' | 'system';
  text: string;
}

export interface Goal {
  id: ID;
  title: string;
  description: string;
  deadline: ISODate | null;
  metric: 'tasks' | 'focus' | 'manual';
  target: number;
  manualProgress: number;
  projectId: ID | null;
  color: string;
  createdAt: number;
}

export interface Settings {
  name: string;
  theme: 'dark' | 'light' | 'system';
  accent: string;
  weekStart: 0 | 1;
  focusMinutes: number;
  shortBreak: number;
  longBreak: number;
  sessionsBeforeLong: number;
  currency: string;
  sounds: boolean;
  notifications: boolean;
  density: 'comfortable' | 'compact';
  dailyFocusGoal: number; // minutes
  reduceMotion: boolean;
}

export interface DataState {
  version: number;
  tasks: Task[];
  projects: Project[];
  notes: Note[];
  events: CalEvent[];
  habits: Habit[];
  sessions: FocusSession[];
  transactions: Transaction[];
  budgets: Record<string, number>;
  journal: Record<ISODate, JournalEntry>;
  goals: Goal[];
  activity: Activity[];
  settings: Settings;
}

export type Route =
  | 'home'
  | 'dashboard'
  | 'tasks'
  | 'notes'
  | 'calendar'
  | 'habits'
  | 'focus'
  | 'goals'
  | 'journal'
  | 'finance'
  | 'analytics'
  | 'settings';
