import type { ISODate, Priority, Recurrence } from '../types';
import { addDays, today, toISO, weekdayOf } from './date';

export interface ParsedInput {
  title: string;
  due: ISODate | null;
  dueTime: string | null;
  priority: Priority;
  tags: string[];
  project: string | null;
  estimate: number | null;
  recurrence: Recurrence;
  chips: { kind: string; label: string }[];
}

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?)';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MON_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

const dayIndex = (s: string) => DAYS.findIndex((d) => d.startsWith(s.toLowerCase().slice(0, 3)));

/** Next occurrence of weekday (never today). `nextWeek` pushes to the following week's instance. */
function nextWeekday(target: number, nextWeek = false): ISODate {
  const t = today();
  const diff = (target - weekdayOf(t) + 7) % 7 || 7;
  const cur = weekdayOf(t);
  // "next friday" said on Monday → Friday of next week
  const push = nextWeek && target > cur && cur !== 0 ? 7 : 0;
  return addDays(t, diff + push);
}

function to24(h: number, m: number, ap?: string): string {
  let hh = h;
  if (ap) {
    const a = ap.toLowerCase();
    if (a.startsWith('p') && hh < 12) hh += 12;
    if (a.startsWith('a') && hh === 12) hh = 0;
  }
  return `${String(hh).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function parseInput(raw: string, projectNames: string[] = []): ParsedInput {
  let s = ` ${raw} `;
  const out: ParsedInput = {
    title: '',
    due: null,
    dueTime: null,
    priority: 0,
    tags: [],
    project: null,
    estimate: null,
    recurrence: null,
    chips: [],
  };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(re);
    if (m) {
      fn(m);
      s = s.replace(m[0], ' ');
      return true;
    }
    return false;
  };

  // Priority
  take(/\s(?:!(urgent|high|med(?:ium)?|low|[1-4])|p([1-4]))(?=\s)/i, (m) => {
    const v = (m[1] || m[2]).toLowerCase();
    const map: Record<string, Priority> = { urgent: 4, high: 3, med: 2, medium: 2, low: 1 };
    if (m[2]) out.priority = (5 - Number(m[2])) as Priority; // p1 = urgent
    else out.priority = map[v] ?? (Number(v) as Priority);
    out.chips.push({ kind: 'priority', label: ['None', 'Low', 'Medium', 'High', 'Urgent'][out.priority] });
  });

  // Tags
  let guard = 0;
  while (guard++ < 20 && take(/\s#([\w-]+)(?=\s)/, (m) => out.tags.push(m[1].toLowerCase())));
  out.tags.forEach((t) => out.chips.push({ kind: 'tag', label: `#${t}` }));

  // Project: +Name or @Name
  take(/\s[+@]([\w-]+)(?=\s)/, (m) => {
    const name = m[1];
    const match = projectNames.find((p) => p.toLowerCase().replace(/\s+/g, '') === name.toLowerCase() || p.toLowerCase().startsWith(name.toLowerCase()));
    out.project = match || name;
    out.chips.push({ kind: 'project', label: out.project });
  });

  // Estimate ~30m ~1.5h
  take(/\s~(\d+(?:\.\d+)?)\s?(m|min|h|hr|hours?)?(?=\s)/i, (m) => {
    const n = parseFloat(m[1]);
    const unit = (m[2] || 'm').toLowerCase();
    out.estimate = Math.round(unit.startsWith('h') ? n * 60 : n);
    out.chips.push({ kind: 'estimate', label: `~${out.estimate}m` });
  });

  // Recurrence
  take(/\s(every\s?day|daily|every\s?weekday|weekdays|every\s?week|weekly|every\s?month|monthly)(?=\s)/i, (m) => {
    const v = m[1].toLowerCase().replace(/\s/g, '');
    out.recurrence = v.includes('weekday') ? 'weekdays' : v.includes('day') || v === 'daily' ? 'daily' : v.includes('week') ? 'weekly' : 'monthly';
    out.chips.push({ kind: 'recurrence', label: `↻ ${out.recurrence}` });
    if (!out.due) out.due = today();
  });

  // Time
  take(/\s(?:at\s)?(\d{1,2}):(\d{2})\s?(am|pm)?(?=\s)/i, (m) => (out.dueTime = to24(+m[1], +m[2], m[3]))) ||
    take(/\s(?:at\s)?(\d{1,2})\s?(am|pm)(?=\s)/i, (m) => (out.dueTime = to24(+m[1], 0, m[2]))) ||
    take(/\s(?:at\s)?(noon|midnight)(?=\s)/i, (m) => (out.dueTime = m[1].toLowerCase() === 'noon' ? '12:00' : '00:00'));

  // Dates
  const t = today();
  const dateFound =
    take(/\s(today|tod)(?=\s)/i, () => (out.due = t)) ||
    take(/\s(tonight)(?=\s)/i, () => {
      out.due = t;
      out.dueTime ||= '20:00';
    }) ||
    take(/\s(tomorrow|tmrw?|tmr)(?=\s)/i, () => (out.due = addDays(t, 1))) ||
    take(/\s(day after tomorrow)(?=\s)/i, () => (out.due = addDays(t, 2))) ||
    take(/\snext\s(week)(?=\s)/i, () => (out.due = nextWeekday(1))) ||
    take(/\snext\s(month)(?=\s)/i, () => {
      const d = new Date();
      out.due = toISO(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    }) ||
    take(/\s(this\s)?weekend(?=\s)/i, () => (out.due = nextWeekday(6))) ||
    take(/\sin\s(\d+)\s(days?|weeks?|months?)(?=\s)/i, (m) => {
      const n = +m[1];
      const u = m[2].toLowerCase();
      if (u.startsWith('d')) out.due = addDays(t, n);
      else if (u.startsWith('w')) out.due = addDays(t, n * 7);
      else {
        const d = new Date();
        d.setMonth(d.getMonth() + n);
        out.due = toISO(d);
      }
    }) ||
    take(new RegExp(`\\s(next\\s)?(?:on\\s)?${DAY_RE}(?=\\s)`, 'i'), (m) => (out.due = nextWeekday(dayIndex(m[2]), !!m[1]))) ||
    take(/\s(\d{4})-(\d{2})-(\d{2})(?=\s)/, (m) => (out.due = `${m[1]}-${m[2]}-${m[3]}`)) ||
    take(new RegExp(`\\s(?:on\\s)?${MON_RE}\\s(\\d{1,2})(?:st|nd|rd|th)?(?=\\s)`, 'i'), (m) => (out.due = monthDay(m[1], +m[2]))) ||
    take(new RegExp(`\\s(?:on\\s)?(\\d{1,2})(?:st|nd|rd|th)?\\s${MON_RE}(?=\\s)`, 'i'), (m) => (out.due = monthDay(m[2], +m[1]))) ||
    take(/\s(\d{1,2})\/(\d{1,2})(?=\s)/, (m) => {
      const d = new Date();
      let c = new Date(d.getFullYear(), +m[1] - 1, +m[2]);
      if (toISO(c) < t) c = new Date(d.getFullYear() + 1, +m[1] - 1, +m[2]);
      out.due = toISO(c);
    });

  if (out.dueTime && !out.due) out.due = t;
  if (out.due || dateFound) out.chips.push({ kind: 'date', label: out.due! + (out.dueTime ? ` ${out.dueTime}` : '') });
  else if (out.dueTime) out.chips.push({ kind: 'date', label: out.dueTime });

  out.title = s.replace(/\s+/g, ' ').replace(/\s(at|on|by)$/i, '').trim();
  return out;
}

function monthDay(mon: string, day: number): ISODate {
  const mi = MONTHS.indexOf(mon.toLowerCase().slice(0, 3));
  const now = new Date();
  let d = new Date(now.getFullYear(), mi, day);
  if (toISO(d) < today()) d = new Date(now.getFullYear() + 1, mi, day);
  return toISO(d);
}
