import { lazy, Suspense, useEffect } from 'react';
import { useData } from './store/data';
import { useUI, routeFromHash } from './store/ui';
import { Sidebar, ShortcutsHelp } from './components/Shell';
import { CommandPalette, NAV } from './components/CommandPalette';
import { QuickAdd } from './components/QuickAdd';
import { TaskModal } from './components/TaskParts';
import { EventModal } from './components/EventModal';
import { Toasts } from './components/ui';
import { useTimerEngine } from './lib/timer';
import type { Route } from './types';
import { cx } from './lib/id';

const pages: Record<Route, React.LazyExoticComponent<() => JSX.Element>> = {
  dashboard: lazy(() => import('./pages/Dashboard')),
  tasks: lazy(() => import('./pages/Tasks')),
  notes: lazy(() => import('./pages/Notes')),
  calendar: lazy(() => import('./pages/Calendar')),
  habits: lazy(() => import('./pages/Habits')),
  focus: lazy(() => import('./pages/Focus')),
  goals: lazy(() => import('./pages/Goals')),
  journal: lazy(() => import('./pages/Journal')),
  finance: lazy(() => import('./pages/Finance')),
  analytics: lazy(() => import('./pages/Analytics')),
  settings: lazy(() => import('./pages/Settings')),
};

function useTheme() {
  const { theme, accent, density, reduceMotion } = useData((s) => s.settings);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0b0d12' : '#f7f7fb');
    };
    apply();
    root.style.setProperty('--accent', accent);
    root.dataset.density = density;
    root.dataset.motion = reduceMotion ? 'reduce' : 'full';
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, accent, density, reduceMotion]);
}

function useShortcuts() {
  useEffect(() => {
    let gPending = 0;
    const onKey = (e: KeyboardEvent) => {
      const ui = useUI.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        ui.set({ paletteOpen: !ui.paletteOpen });
        return;
      }
      const el = e.target as HTMLElement;
      if (el.matches('input, textarea, select, [contenteditable]') || mod || e.altKey) return;
      if (ui.paletteOpen || ui.quickAddOpen || ui.taskModal || ui.eventModal || ui.shortcutsOpen) return;
      if (Date.now() - gPending < 1200) {
        const n = NAV.find((x) => x.key === e.key.toLowerCase());
        gPending = 0;
        if (n) {
          e.preventDefault();
          ui.navigate(n.route);
        }
        return;
      }
      switch (e.key) {
        case 'g':
          gPending = Date.now();
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          ui.set({ quickAddOpen: true });
          break;
        case '/':
          e.preventDefault();
          ui.set({ paletteOpen: true });
          break;
        case '?':
          ui.set({ shortcutsOpen: true });
          break;
        case '[':
          ui.set({ sidebarCollapsed: !ui.sidebarCollapsed });
          break;
      }
    };
    const onHash = () => useUI.setState({ route: routeFromHash() });
    window.addEventListener('keydown', onKey);
    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);
}

export default function App() {
  useTheme();
  useShortcuts();
  useTimerEngine();
  const route = useUI((s) => s.route);
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const Page = pages[route];
  return (
    <div className={cx('app', collapsed && 'sidebar-collapsed')}>
      <Sidebar />
      <main className="main">
        <Suspense fallback={<div className="page-loading"><div className="spinner" /></div>}>
          <Page key={route} />
        </Suspense>
      </main>
      <CommandPalette />
      <QuickAdd />
      <TaskModal />
      <EventModal />
      <ShortcutsHelp />
      <Toasts />
    </div>
  );
}
