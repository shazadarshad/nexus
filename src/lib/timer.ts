import { useEffect } from 'react';
import { useUI, toast, type TimerMode } from '../store/ui';
import { useData } from '../store/data';
import { chime, notify } from './audio';

const minutesFor = (m: TimerMode) => {
  const s = useData.getState().settings;
  return m === 'focus' ? s.focusMinutes : m === 'short' ? s.shortBreak : s.longBreak;
};

export const timer = {
  start() {
    const { timer: t, setTimer } = useUI.getState();
    if (t.running) return;
    setTimer({ running: true, endsAt: Date.now() + t.remaining * 1000, startedAt: t.startedAt ?? Date.now() });
  },
  pause() {
    const { timer: t, setTimer } = useUI.getState();
    if (!t.running || !t.endsAt) return;
    setTimer({ running: false, endsAt: null, remaining: Math.max(0, (t.endsAt - Date.now()) / 1000) });
  },
  toggle() {
    useUI.getState().timer.running ? timer.pause() : timer.start();
  },
  reset() {
    const { timer: t, setTimer } = useUI.getState();
    setTimer({ running: false, endsAt: null, remaining: t.total, startedAt: null });
  },
  setMode(mode: TimerMode) {
    const total = minutesFor(mode) * 60;
    useUI.getState().setTimer({ mode, total, remaining: total, running: false, endsAt: null, startedAt: null });
  },
  skip() {
    const { timer: t } = useUI.getState();
    const elapsed = (t.total - t.remaining) / 60;
    if (t.mode === 'focus' && elapsed >= 1) useData.getState().logSession({ start: t.startedAt || Date.now(), minutes: Math.round(elapsed), taskId: t.taskId, kind: 'focus' });
    timer.advance(false);
  },
  /** Move to the next block. `completed` = block ran to zero. */
  advance(completed: boolean) {
    const { timer: t, setTimer } = useUI.getState();
    const s = useData.getState().settings;
    let completedFocus = t.completedFocus;
    let next: TimerMode = 'focus';
    if (t.mode === 'focus') {
      if (completed) {
        completedFocus++;
        useData.getState().logSession({ start: t.startedAt || Date.now() - t.total * 1000, minutes: Math.round(t.total / 60), taskId: t.taskId, kind: 'focus' });
      }
      next = completedFocus > 0 && completedFocus % s.sessionsBeforeLong === 0 ? 'long' : 'short';
    } else if (completed) {
      useData.getState().logSession({ start: t.startedAt || Date.now(), minutes: Math.round(t.total / 60), taskId: null, kind: 'break' });
    }
    const total = minutesFor(next) * 60;
    setTimer({ mode: next, total, remaining: total, running: false, endsAt: null, startedAt: null, completedFocus });
    if (completed) {
      if (s.sounds) chime();
      const msg = t.mode === 'focus' ? `Focus block complete! Time for a ${next === 'long' ? 'long' : 'short'} break.` : 'Break over — ready to focus?';
      toast(msg, { kind: 'success' });
      if (s.notifications) notify('Nexus', msg);
    }
  },
};

/** Mount once at the app root. Keeps the timer ticking across pages. */
export function useTimerEngine() {
  useEffect(() => {
    const id = setInterval(() => {
      const { timer: t, setTimer } = useUI.getState();
      if (!t.running || !t.endsAt) return;
      const rem = (t.endsAt - Date.now()) / 1000;
      if (rem <= 0) timer.advance(true);
      else setTimer({ remaining: rem });
    }, 250);
    const toggle = () => timer.toggle();
    window.addEventListener('nexus:timer-toggle', toggle);
    return () => {
      clearInterval(id);
      window.removeEventListener('nexus:timer-toggle', toggle);
    };
  }, []);

  // keep total in sync with settings when idle
  const fm = useData((s) => s.settings.focusMinutes);
  const sb = useData((s) => s.settings.shortBreak);
  const lb = useData((s) => s.settings.longBreak);
  useEffect(() => {
    const t = useUI.getState().timer;
    if (!t.running && t.remaining === t.total) timer.setMode(t.mode);
  }, [fm, sb, lb]);

  // title bar countdown
  const tState = useUI((s) => s.timer);
  useEffect(() => {
    if (tState.running) {
      const r = Math.ceil(tState.remaining);
      document.title = `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')} · ${tState.mode === 'focus' ? 'Focus' : 'Break'} — Nexus`;
    } else document.title = 'Nexus — Personal Operating System';
  }, [tState.running, Math.ceil(tState.remaining), tState.mode]); // eslint-disable-line
}
