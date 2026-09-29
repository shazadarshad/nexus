import type { ISODate } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

export const toISO = (d: Date): ISODate => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseISO = (s: ISODate): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const today = (): ISODate => toISO(new Date());

export const addDays = (s: ISODate, n: number): ISODate => {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const addMonths = (s: ISODate, n: number): ISODate => {
  const d = parseISO(s);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return toISO(d);
};

export const diffDays = (a: ISODate, b: ISODate): number =>
  Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000);

export const startOfWeek = (s: ISODate, weekStart: 0 | 1 = 1): ISODate => {
  const d = parseISO(s);
  const diff = (d.getDay() - weekStart + 7) % 7;
  return addDays(s, -diff);
};

export const startOfMonth = (s: ISODate): ISODate => s.slice(0, 8) + '01';

export const daysInMonth = (s: ISODate): number => {
  const d = parseISO(s);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

export const range = (start: ISODate, n: number): ISODate[] => Array.from({ length: n }, (_, i) => addDays(start, i));

export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const weekdayOf = (s: ISODate) => parseISO(s).getDay();

export const fmtDate = (s: ISODate, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) =>
  parseISO(s).toLocaleDateString(undefined, opts);

export const fmtMonth = (s: ISODate) => `${MONTHS[parseISO(s).getMonth()]} ${parseISO(s).getFullYear()}`;

export const relativeDay = (s: ISODate | null): string => {
  if (!s) return '';
  const d = diffDays(s, today());
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d > 1 && d < 7) return DAY_LONG[weekdayOf(s)];
  if (d < 0) return `${-d}d overdue`;
  return fmtDate(s);
};

export const timeAgo = (ts: number): string => {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
};

export const fmtMinutes = (min: number): string => {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
};

export const timeToMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

export const minToTime = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

export const fmtTime = (t: string | null) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  const hh = h % 12 || 12;
  return m ? `${hh}:${pad(m)}${ap}` : `${hh}${ap}`;
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};
