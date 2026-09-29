import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../store/data';
import { useUI, toast } from '../store/ui';
import { Topbar } from '../components/Shell';
import { Icon } from '../components/Icon';
import { Segmented, Empty } from '../components/ui';
import { Check, useToggleTask } from '../components/TaskParts';
import { addDays, addMonths, DAY_SHORT, fmtDate, fmtMonth, fmtTime, minToTime, parseISO, range, startOfMonth, startOfWeek, timeToMin, today, weekdayOf } from '../lib/date';
import { cx } from '../lib/id';
import type { CalEvent, ISODate, Task } from '../types';
import { PRIORITY_COLOR } from '../components/ui';

type View = 'month' | 'week' | 'agenda';
const HOUR_H = 48;
const START_H = 6;
const END_H = 24;

export default function Calendar() {
  const events = useData((s) => s.events);
  const tasks = useData((s) => s.tasks);
  const weekStart = useData((s) => s.settings.weekStart);
  const { updateEvent, updateTask } = useData.getState();
  const setUI = useUI((s) => s.set);
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<ISODate>(today());
  const t = today();

  const byDay = useMemo(() => {
    const m: Record<string, { events: CalEvent[]; tasks: Task[] }> = {};
    const get = (d: string) => (m[d] ||= { events: [], tasks: [] });
    events.forEach((e) => get(e.date).events.push(e));
    tasks.forEach((x) => x.due && get(x.due).tasks.push(x));
    Object.values(m).forEach((v) => v.events.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start)));
    return m;
  }, [events, tasks]);

  const step = (n: number) => setCursor((c) => (view === 'month' ? addMonths(startOfMonth(c), n) : addDays(c, n * 7)));

  const onDrop = (e: React.DragEvent, date: ISODate, hour?: number) => {
    e.preventDefault();
    const tid = e.dataTransfer.getData('text/task');
    const eid = e.dataTransfer.getData('text/event');
    if (tid) {
      updateTask(tid, { due: date, ...(hour !== undefined ? { dueTime: minToTime(hour * 60) } : {}) });
      toast(`Task moved to ${fmtDate(date)}`, { kind: 'success' });
    } else if (eid) {
      const ev = events.find((x) => x.id === eid);
      if (!ev) return;
      const patch: Partial<CalEvent> = { date };
      if (hour !== undefined && !ev.allDay) {
        const dur = timeToMin(ev.end) - timeToMin(ev.start);
        patch.start = minToTime(hour * 60);
        patch.end = minToTime(Math.min(hour * 60 + dur, 23 * 60 + 59));
      }
      updateEvent(eid, patch);
      toast(`Event moved to ${fmtDate(date)}`, { kind: 'success' });
    }
  };

  const title = view === 'month' ? fmtMonth(cursor) : view === 'week' ? `${fmtDate(startOfWeek(cursor, weekStart))} – ${fmtDate(addDays(startOfWeek(cursor, weekStart), 6), { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Next 30 days';

  return (
    <div className="page">
      <Topbar
        title="Calendar"
        subtitle={title}
        actions={
          <>
            <Segmented<View>
              value={view}
              onChange={setView}
              options={[
                { value: 'month', label: 'Month' },
                { value: 'week', label: 'Week' },
                { value: 'agenda', label: 'Agenda' },
              ]}
            />
          </>
        }
      />
      {view !== 'agenda' && (
        <div className="toolbar">
          <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous">
            <Icon name="chevronLeft" />
          </button>
          <button className="btn sm" onClick={() => setCursor(t)}>
            Today
          </button>
          <button className="icon-btn" onClick={() => step(1)} aria-label="Next">
            <Icon name="chevronRight" />
          </button>
          <h2 className="cal-title">{title}</h2>
          <div style={{ flex: 1 }} />
          <span className="small muted hide-sm">Drag tasks & events to reschedule · click a day to add</span>
          <button className="btn primary sm" onClick={() => setUI({ eventModal: { id: 'new', defaults: { date: cursor } } })}>
            <Icon name="plus" size={15} /> Event
          </button>
        </div>
      )}
      {view === 'month' && <MonthView cursor={cursor} weekStart={weekStart} byDay={byDay} onDrop={onDrop} onPickWeek={(d) => { setCursor(d); setView('week'); }} />}
      {view === 'week' && <WeekView cursor={cursor} weekStart={weekStart} byDay={byDay} onDrop={onDrop} />}
      {view === 'agenda' && <AgendaView byDay={byDay} />}
    </div>
  );
}

function MonthView({ cursor, weekStart, byDay, onDrop, onPickWeek }: { cursor: ISODate; weekStart: 0 | 1; byDay: Record<string, { events: CalEvent[]; tasks: Task[] }>; onDrop: (e: React.DragEvent, d: ISODate) => void; onPickWeek: (d: ISODate) => void }) {
  const setUI = useUI((s) => s.set);
  const [over, setOver] = useState<string | null>(null);
  const first = startOfMonth(cursor);
  const gridStart = startOfWeek(first, weekStart);
  const days = range(gridStart, 42);
  const month = first.slice(0, 7);
  const t = today();
  return (
    <div className="month">
      <div className="month-head">
        {range(gridStart, 7).map((d) => (
          <div key={d}>{DAY_SHORT[weekdayOf(d)]}</div>
        ))}
      </div>
      <div className="month-grid">
        {days.map((d) => {
          const info = byDay[d];
          const items = [
            ...(info?.events || []).map((e) => ({ k: 'e' as const, e })),
            ...(info?.tasks || []).filter((x) => x.status !== 'done').map((x) => ({ k: 't' as const, x })),
          ];
          const doneCount = (info?.tasks || []).filter((x) => x.status === 'done').length;
          return (
            <div
              key={d}
              className={cx('month-cell', d.slice(0, 7) !== month && 'other', d === t && 'today', over === d && 'drag-over', [0, 6].includes(weekdayOf(d)) && 'weekend')}
              onClick={(e) => e.target === e.currentTarget && setUI({ eventModal: { id: 'new', defaults: { date: d } } })}
              onDragOver={(e) => { e.preventDefault(); setOver(d); }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => { setOver(null); onDrop(e, d); }}
            >
              <button className="day-num" onClick={() => onPickWeek(d)} title="Open week">
                {parseISO(d).getDate()}
              </button>
              <div className="cell-items">
                {items.slice(0, 3).map((it) =>
                  it.k === 'e' ? (
                    <div key={it.e.id} className="cal-chip" style={{ ['--c' as string]: it.e.color }} draggable onDragStart={(ev) => ev.dataTransfer.setData('text/event', it.e.id)} onClick={() => setUI({ eventModal: { id: it.e.id } })}>
                      {!it.e.allDay && <span className="chip-time">{fmtTime(it.e.start)}</span>}
                      {it.e.title}
                    </div>
                  ) : (
                    <div key={it.x.id} className="cal-chip task" style={{ ['--c' as string]: PRIORITY_COLOR[it.x.priority] }} draggable onDragStart={(ev) => ev.dataTransfer.setData('text/task', it.x.id)} onClick={() => setUI({ taskModal: { id: it.x.id } })}>
                      ☐ {it.x.title}
                    </div>
                  )
                )}
                {items.length > 3 && (
                  <button className="more-link" onClick={() => onPickWeek(d)}>
                    +{items.length - 3} more
                  </button>
                )}
                {doneCount > 0 && <div className="done-count">✓ {doneCount}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ cursor, weekStart, byDay, onDrop }: { cursor: ISODate; weekStart: 0 | 1; byDay: Record<string, { events: CalEvent[]; tasks: Task[] }>; onDrop: (e: React.DragEvent, d: ISODate, hour?: number) => void }) {
  const setUI = useUI((s) => s.set);
  const toggle = useToggleTask();
  const days = range(startOfWeek(cursor, weekStart), 7);
  const t = today();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 60000);
    scrollRef.current?.scrollTo({ top: Math.max(0, (new Date().getHours() - START_H - 2) * HOUR_H) });
    return () => clearInterval(i);
  }, []);
  const hours = range('2000-01-01', END_H - START_H).map((_, i) => START_H + i);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // overlap layout: assign columns
  const layout = (evs: CalEvent[]) => {
    const timed = evs.filter((e) => !e.allDay).sort((a, b) => a.start.localeCompare(b.start));
    const cols: CalEvent[][] = [];
    const pos = new Map<string, { col: number; cols: number }>();
    timed.forEach((e) => {
      let c = cols.findIndex((col) => col[col.length - 1].end <= e.start);
      if (c < 0) {
        c = cols.length;
        cols.push([]);
      }
      cols[c].push(e);
      pos.set(e.id, { col: c, cols: 0 });
    });
    pos.forEach((v) => (v.cols = cols.length));
    return { timed, pos };
  };

  return (
    <div className="week">
      <div className="week-head">
        <div className="gutter" />
        {days.map((d) => (
          <div key={d} className={cx('week-day-head', d === t && 'today')}>
            <span className="small muted">{DAY_SHORT[weekdayOf(d)]}</span>
            <span className="week-date">{parseISO(d).getDate()}</span>
          </div>
        ))}
      </div>
      <div className="week-allday">
        <div className="gutter small muted">all-day</div>
        {days.map((d) => (
          <div key={d} className="allday-cell" onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(e, d)}>
            {(byDay[d]?.events || []).filter((e) => e.allDay).map((e) => (
              <div key={e.id} className="cal-chip" style={{ ['--c' as string]: e.color }} onClick={() => setUI({ eventModal: { id: e.id } })}>
                {e.title}
              </div>
            ))}
            {(byDay[d]?.tasks || []).map((x) => (
              <div key={x.id} className={cx('cal-task', x.status === 'done' && 'done')} draggable onDragStart={(ev) => ev.dataTransfer.setData('text/task', x.id)} onClick={() => setUI({ taskModal: { id: x.id } })}>
                <Check done={x.status === 'done'} onClick={() => toggle(x)} color={PRIORITY_COLOR[x.priority]} />
                <span className="ellipsis">{x.title}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="week-scroll" ref={scrollRef}>
        <div className="week-body" style={{ height: hours.length * HOUR_H }}>
          <div className="gutter">
            {hours.map((h) => (
              <div key={h} className="hour-label" style={{ height: HOUR_H }}>
                {fmtTime(minToTime(h * 60))}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const { timed, pos } = layout(byDay[d]?.events || []);
            return (
              <div key={d} className={cx('week-col', d === t && 'today')}>
                {hours.map((h) => (
                  <div
                    key={h}
                    className="hour-slot"
                    style={{ height: HOUR_H }}
                    onClick={() => setUI({ eventModal: { id: 'new', defaults: { date: d, start: minToTime(h * 60), end: minToTime(h * 60 + 60) } } })}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop(e, d, h)}
                  />
                ))}
                {timed.map((e) => {
                  const top = ((timeToMin(e.start) - START_H * 60) / 60) * HOUR_H;
                  const h = Math.max(20, ((timeToMin(e.end) - timeToMin(e.start)) / 60) * HOUR_H - 2);
                  const p = pos.get(e.id)!;
                  return (
                    <div
                      key={e.id}
                      className="week-event"
                      draggable
                      onDragStart={(ev) => ev.dataTransfer.setData('text/event', e.id)}
                      style={{ top, height: h, ['--c' as string]: e.color, left: `calc(${(p.col / p.cols) * 100}% + 2px)`, width: `calc(${100 / p.cols}% - 4px)` }}
                      onClick={() => setUI({ eventModal: { id: e.id } })}
                    >
                      <strong>{e.title}</strong>
                      <span>
                        {fmtTime(e.start)} – {fmtTime(e.end)}
                      </span>
                      {e.location && h > 50 && <span>📍 {e.location}</span>}
                    </div>
                  );
                })}
                {d === t && nowMin >= START_H * 60 && <div className="now-line" style={{ top: ((nowMin - START_H * 60) / 60) * HOUR_H }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AgendaView({ byDay }: { byDay: Record<string, { events: CalEvent[]; tasks: Task[] }> }) {
  const setUI = useUI((s) => s.set);
  const toggle = useToggleTask();
  const days = range(today(), 30).filter((d) => byDay[d] && (byDay[d].events.length || byDay[d].tasks.some((x) => x.status !== 'done')));
  if (!days.length) return <Empty icon="calendar" title="Nothing scheduled" hint="Your next 30 days are wide open." />;
  return (
    <div className="agenda-view">
      {days.map((d) => (
        <div key={d} className="agenda-day">
          <div className={cx('agenda-date', d === today() && 'today')}>
            <span className="big">{parseISO(d).getDate()}</span>
            <span className="small muted">{fmtDate(d, { weekday: 'short', month: 'short' })}</span>
          </div>
          <div className="agenda-items">
            {byDay[d].events.map((e) => (
              <button key={e.id} className="agenda-item" onClick={() => setUI({ eventModal: { id: e.id } })}>
                <span className="agenda-time">{e.allDay ? 'All day' : fmtTime(e.start)}</span>
                <span className="agenda-bar" style={{ background: e.color }} />
                <span className="agenda-text">
                  <strong>{e.title}</strong>
                  <span className="small muted">{e.location}</span>
                </span>
              </button>
            ))}
            {byDay[d].tasks.filter((x) => x.status !== 'done').map((x) => (
              <div key={x.id} className="agenda-item" onClick={() => setUI({ taskModal: { id: x.id } })}>
                <span className="agenda-time">{x.dueTime ? fmtTime(x.dueTime) : 'Task'}</span>
                <Check done={false} onClick={() => toggle(x)} color={PRIORITY_COLOR[x.priority]} />
                <span className="agenda-text">
                  <strong>{x.title}</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
