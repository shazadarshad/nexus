import { create } from 'zustand';
import type { ID, ISODate, Route, Task, CalEvent } from '../types';
import { uid } from '../lib/id';

export interface Toast {
  id: string;
  text: string;
  kind: 'info' | 'success' | 'error';
  action?: { label: string; run: () => void };
}

export type TimerMode = 'focus' | 'short' | 'long';

export interface TimerState {
  mode: TimerMode;
  running: boolean;
  endsAt: number | null;
  remaining: number; // seconds when paused
  total: number; // seconds of current block
  taskId: ID | null;
  completedFocus: number;
  startedAt: number | null;
}

interface UIState {
  route: Route;
  paletteOpen: boolean;
  quickAddOpen: boolean;
  shortcutsOpen: boolean;
  sidebarCollapsed: boolean;
  mobileNav: boolean;
  taskModal: { id: ID | 'new'; defaults?: Partial<Task> } | null;
  eventModal: { id: ID | 'new'; defaults?: Partial<CalEvent> } | null;
  selectedNoteId: ID | null;
  calendarDate: ISODate | null;
  toasts: Toast[];
  timer: TimerState;
  navigate: (r: Route) => void;
  set: (p: Partial<UIState>) => void;
  toast: (text: string, opts?: Partial<Omit<Toast, 'id' | 'text'>>) => void;
  dismissToast: (id: string) => void;
  setTimer: (p: Partial<TimerState>) => void;
}

const ROUTES: Route[] = ['home', 'dashboard', 'tasks', 'notes', 'calendar', 'habits', 'focus', 'goals', 'journal', 'finance', 'analytics', 'settings'];

export const routeFromHash = (): Route => {
  const h = window.location.hash.replace(/^#\/?/, '').split('/')[0] as Route;
  if (!h) return 'home';
  return ROUTES.includes(h) ? h : 'dashboard';
};

export const useUI = create<UIState>()((set, get) => ({
  route: routeFromHash(),
  paletteOpen: false,
  quickAddOpen: false,
  shortcutsOpen: false,
  sidebarCollapsed: localStorage.getItem('nexus-sidebar') === '1',
  mobileNav: false,
  taskModal: null,
  eventModal: null,
  selectedNoteId: null,
  calendarDate: null,
  toasts: [],
  timer: {
    mode: 'focus',
    running: false,
    endsAt: null,
    remaining: 25 * 60,
    total: 25 * 60,
    taskId: null,
    completedFocus: 0,
    startedAt: null,
  },
  navigate: (r) => {
    if (window.location.hash !== `#/${r}`) window.location.hash = `/${r}`;
    set({ route: r, mobileNav: false });
  },
  set: (p) => set(p),
  toast: (text, opts = {}) => {
    const id = uid();
    const t: Toast = { id, text, kind: 'info', ...opts };
    set({ toasts: [...get().toasts, t].slice(-4) });
    setTimeout(() => get().dismissToast(id), opts.action ? 6000 : 3200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setTimer: (p) => set({ timer: { ...get().timer, ...p } }),
}));

export const toast = (text: string, opts?: Partial<Omit<Toast, 'id' | 'text'>>) => useUI.getState().toast(text, opts);
