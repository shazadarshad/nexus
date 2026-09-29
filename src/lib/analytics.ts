import type { DataState, Goal, Habit, ISODate, Task, FocusSession, Transaction } from '../types';
import { addDays, DAY_LONG, range, today, toISO, weekdayOf } from './date';
import { sum } from './id';

export const dayOfTs = (ts: number) => toISO(new Date(ts));

export const isHabitDue = (h: Habit, d: ISODate) => h.daysOfWeek.includes(weekdayOf(d));
export const isHabitDone = (h: Habit, d: ISODate) => (h.log[d] || 0) >= h.targetPerDay;

export function habitStreak(h: Habit): { current: number; best: number } {
  let current = 0;
  let d = today();
  // today not done yet doesn't break the streak
  if (!isHabitDone(h, d)) d = addDays(d, -1);
  for (let i = 0; i < 1000; i++) {
    if (!isHabitDue(h, d)) {
      d = addDays(d, -1);
      continue;
    }
    if (isHabitDone(h, d)) current++;
    else break;
    d = addDays(d, -1);
  }
  const dates = Object.keys(h.log).sort();
  let best = 0;
  let run = 0;
  if (dates.length) {
    let cur = dates[0];
    const end = today();
    while (cur <= end) {
      if (isHabitDue(h, cur)) {
        if (isHabitDone(h, cur)) {
          run++;
          best = Math.max(best, run);
        } else if (cur !== end) run = 0;
      }
      cur = addDays(cur, 1);
    }
  }
  return { current, best: Math.max(best, current) };
}

export function habitRate(h: Habit, days = 30): number {
  const ds = range(addDays(today(), -days + 1), days).filter((d) => isHabitDue(h, d));
  if (!ds.length) return 0;
  return ds.filter((d) => isHabitDone(h, d)).length / ds.length;
}

export const completedOn = (tasks: Task[], d: ISODate) => tasks.filter((t) => t.completedAt && dayOfTs(t.completedAt) === d);

export function seriesTasksDone(tasks: Task[], days: number): { date: ISODate; value: number }[] {
  const counts: Record<string, number> = {};
  tasks.forEach((t) => {
    if (t.completedAt) {
      const d = dayOfTs(t.completedAt);
      counts[d] = (counts[d] || 0) + 1;
    }
  });
  return range(addDays(today(), -days + 1), days).map((date) => ({ date, value: counts[date] || 0 }));
}

export function seriesFocus(sessions: FocusSession[], days: number): { date: ISODate; value: number }[] {
  const m: Record<string, number> = {};
  sessions.forEach((s) => {
    if (s.kind !== 'focus') return;
    const d = dayOfTs(s.start);
    m[d] = (m[d] || 0) + s.minutes;
  });
  return range(addDays(today(), -days + 1), days).map((date) => ({ date, value: m[date] || 0 }));
}

export const focusOn = (sessions: FocusSession[], d: ISODate) =>
  sum(sessions.filter((s) => s.kind === 'focus' && dayOfTs(s.start) === d).map((s) => s.minutes));

export function activityHeatmap(data: DataState, weeks = 26): Record<ISODate, number> {
  const out: Record<string, number> = {};
  const start = addDays(today(), -weeks * 7);
  const bump = (d: string, n = 1) => {
    if (d >= start) out[d] = (out[d] || 0) + n;
  };
  data.tasks.forEach((t) => t.completedAt && bump(dayOfTs(t.completedAt)));
  data.sessions.forEach((s) => s.kind === 'focus' && bump(dayOfTs(s.start), s.minutes / 25));
  data.habits.forEach((h) => Object.keys(h.log).forEach((d) => isHabitDone(h, d) && bump(d, 0.5)));
  Object.keys(data.journal).forEach((d) => bump(d, 0.5));
  return out;
}

/** 0-100 composite score for a given day. */
export function productivityScore(data: DataState, d: ISODate = today()): { score: number; parts: { label: string; value: number }[] } {
  const done = completedOn(data.tasks, d).length;
  const dueToday = data.tasks.filter((t) => t.due === d).length;
  const taskPart = Math.min(1, dueToday ? done / Math.max(dueToday, 1) : done / 3);
  const focusPart = Math.min(1, focusOn(data.sessions, d) / Math.max(1, data.settings.dailyFocusGoal));
  const hs = data.habits.filter((h) => !h.archived && isHabitDue(h, d));
  const habitPart = hs.length ? hs.filter((h) => isHabitDone(h, d)).length / hs.length : 0;
  const journalPart = data.journal[d] ? 1 : 0;
  const score = Math.round(taskPart * 40 + focusPart * 30 + habitPart * 20 + journalPart * 10);
  return {
    score,
    parts: [
      { label: 'Tasks', value: taskPart },
      { label: 'Focus', value: focusPart },
      { label: 'Habits', value: habitPart },
      { label: 'Journal', value: journalPart },
    ],
  };
}

export function goalProgress(g: Goal, data: DataState): { value: number; target: number; pct: number } {
  if (g.metric === 'tasks') {
    const ts = data.tasks.filter((t) => t.projectId === g.projectId);
    const done = ts.filter((t) => t.status === 'done').length;
    const target = g.target || ts.length;
    return { value: done, target, pct: target ? Math.min(1, done / target) : 0 };
  }
  if (g.metric === 'focus') {
    const since = g.createdAt;
    const v = sum(data.sessions.filter((s) => s.kind === 'focus' && s.start >= since).map((s) => s.minutes));
    return { value: v, target: g.target, pct: g.target ? Math.min(1, v / g.target) : 0 };
  }
  return { value: g.manualProgress, target: g.target, pct: g.target ? Math.min(1, g.manualProgress / g.target) : 0 };
}

export function monthTotals(tx: Transaction[], month: string) {
  const inMonth = tx.filter((t) => t.date.startsWith(month));
  const income = sum(inMonth.filter((t) => t.amount > 0).map((t) => t.amount));
  const expense = -sum(inMonth.filter((t) => t.amount < 0).map((t) => t.amount));
  const byCat: Record<string, number> = {};
  inMonth.filter((t) => t.amount < 0).forEach((t) => (byCat[t.category] = (byCat[t.category] || 0) - t.amount));
  return { income, expense, net: income - expense, byCat, count: inMonth.length };
}

export function insights(data: DataState): string[] {
  const out: string[] = [];
  const byWd = Array(7).fill(0);
  const byHour = Array(24).fill(0);
  data.tasks.forEach((t) => {
    if (!t.completedAt) return;
    const d = new Date(t.completedAt);
    byWd[d.getDay()]++;
    byHour[d.getHours()]++;
  });
  const bestWd = byWd.indexOf(Math.max(...byWd));
  if (byWd[bestWd]) out.push(`You complete the most tasks on **${DAY_LONG[bestWd]}s**.`);
  const bestH = byHour.indexOf(Math.max(...byHour));
  if (byHour[bestH]) out.push(`Your peak productivity hour is around **${bestH % 12 || 12}${bestH < 12 ? 'am' : 'pm'}**.`);

  const f7 = sum(seriesFocus(data.sessions, 7).map((x) => x.value));
  const fPrev = sum(seriesFocus(data.sessions, 14).slice(0, 7).map((x) => x.value));
  if (fPrev) {
    const delta = Math.round(((f7 - fPrev) / fPrev) * 100);
    out.push(`Focus time is **${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta)}%** vs. the previous week.`);
  }
  const hs = data.habits.filter((h) => !h.archived);
  if (hs.length) {
    const best = [...hs].sort((a, b) => habitRate(b) - habitRate(a))[0];
    out.push(`**${best.name}** is your most consistent habit (${Math.round(habitRate(best) * 100)}% in 30 days).`);
    const worst = [...hs].sort((a, b) => habitRate(a) - habitRate(b))[0];
    if (worst !== best) out.push(`**${worst.name}** needs attention — only ${Math.round(habitRate(worst) * 100)}% consistency.`);
  }
  const overdue = data.tasks.filter((t) => t.status !== 'done' && t.due && t.due < today()).length;
  if (overdue) out.push(`You have **${overdue} overdue** task${overdue > 1 ? 's' : ''}. Consider rescheduling.`);
  const moods = Object.values(data.journal);
  if (moods.length > 5) {
    const withFocus = moods.map((j) => ({ m: j.mood, f: focusOn(data.sessions, j.date) }));
    const hi = withFocus.filter((x) => x.f >= 60);
    const lo = withFocus.filter((x) => x.f < 60);
    if (hi.length && lo.length) {
      const a = sum(hi.map((x) => x.m)) / hi.length;
      const b = sum(lo.map((x) => x.m)) / lo.length;
      if (Math.abs(a - b) > 0.15) out.push(`Your mood averages **${a.toFixed(1)}** on days with 1h+ focus vs **${b.toFixed(1)}** otherwise.`);
    }
  }
  return out;
}
