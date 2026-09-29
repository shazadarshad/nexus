import { useState } from 'react';
import { useData } from '../store/data';
import { toast } from '../store/ui';
import { Topbar } from '../components/Shell';
import { Icon } from '../components/Icon';
import { Empty, Modal, Confirm } from '../components/ui';
import { Field } from '../components/TaskParts';
import { Heatmap, Ring, AreaChart } from '../components/Charts';
import { addDays, DAY_SHORT, fmtDate, parseISO, range, today, weekdayOf } from '../lib/date';
import { habitRate, habitStreak, isHabitDone, isHabitDue } from '../lib/analytics';
import { cx } from '../lib/id';
import type { Habit } from '../types';

const COLORS = ['#22c55e', '#00d4ff', '#7c5cff', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];
const ICONS = ['✨', '💧', '🧘', '📖', '🏃', '💪', '🥗', '😴', '✍️', '🎸', '🧠', '📵', '🌅', '🚭', '💊', '🧹'];

export default function Habits() {
  const habits = useData((s) => s.habits);
  const { checkHabit } = useData.getState();
  const [edit, setEdit] = useState<Habit | 'new' | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const t = today();
  const days = range(addDays(t, -6), 7);
  const active = habits.filter((h) => !h.archived);
  const dueToday = active.filter((h) => isHabitDue(h, t));
  const doneToday = dueToday.filter((h) => isHabitDone(h, t)).length;

  const trend = range(addDays(t, -29), 30).map((d) => {
    const due = active.filter((h) => isHabitDue(h, d));
    return { date: d, value: due.length ? (due.filter((h) => isHabitDone(h, d)).length / due.length) * 100 : 0 };
  });

  return (
    <div className="page">
      <Topbar
        title="Habits"
        subtitle={`${doneToday}/${dueToday.length} done today`}
        actions={
          <button className="btn sm" onClick={() => setEdit('new')}>
            <Icon name="plus" size={15} /> New habit
          </button>
        }
      />
      <div className="habit-top">
        <div className="card row gap-l center-v">
          <Ring value={dueToday.length ? doneToday / dueToday.length : 0} size={110} color="var(--success)">
            <div className="ring-value">{dueToday.length ? Math.round((doneToday / dueToday.length) * 100) : 0}%</div>
            <div className="small muted">today</div>
          </Ring>
          <div>
            <div className="big-num">{Math.max(0, ...active.map((h) => habitStreak(h).current))}🔥</div>
            <div className="muted small">longest active streak</div>
            <div className="big-num" style={{ marginTop: 8 }}>
              {active.length ? Math.round((active.reduce((a, h) => a + habitRate(h), 0) / active.length) * 100) : 0}%
            </div>
            <div className="muted small">30-day consistency</div>
          </div>
        </div>
        <div className="card flex-1">
          <div className="card-head">
            <h3>Completion rate · 30 days</h3>
          </div>
          <AreaChart data={trend} height={130} color="var(--success)" format={(v) => `${Math.round(v)}%`} />
        </div>
      </div>

      {active.length === 0 ? (
        <Empty icon="habits" title="Build your first habit" hint="Small daily actions compound into big results." action={<button className="btn primary" onClick={() => setEdit('new')}>Create habit</button>} />
      ) : (
        <div className="card habit-table">
          <div className="habit-row head">
            <div />
            {days.map((d) => (
              <div key={d} className={cx('habit-day-head', d === t && 'today')}>
                <span className="small muted">{DAY_SHORT[weekdayOf(d)]}</span>
                <span>{parseISO(d).getDate()}</span>
              </div>
            ))}
            <div className="small muted center">Streak</div>
            <div className="small muted center">30d</div>
            <div />
          </div>
          {active.map((h) => {
            const s = habitStreak(h);
            const rate = habitRate(h);
            const log: Record<string, number> = {};
            Object.entries(h.log).forEach(([d, v]) => (log[d] = v >= h.targetPerDay ? 2 : 1));
            return (
              <div key={h.id}>
                <div className="habit-row">
                  <button className="habit-label" onClick={() => setExpanded(expanded === h.id ? null : h.id)}>
                    <span className="habit-emoji" style={{ background: `color-mix(in srgb, ${h.color} 18%, transparent)` }}>
                      {h.icon}
                    </span>
                    <span>
                      <strong>{h.name}</strong>
                      <span className="small muted block">
                        {h.targetPerDay > 1 ? `${h.targetPerDay}× per day` : 'daily'}
                        {h.daysOfWeek.length < 7 && ` · ${h.daysOfWeek.map((d) => DAY_SHORT[d][0]).join('')}`}
                      </span>
                    </span>
                  </button>
                  {days.map((d) => {
                    const due = isHabitDue(h, d);
                    const v = h.log[d] || 0;
                    const done = v >= h.targetPerDay;
                    return (
                      <button
                        key={d}
                        className={cx('habit-cell', done && 'done', !due && 'off', v > 0 && !done && 'partial')}
                        style={{ ['--c' as string]: h.color }}
                        onClick={() => checkHabit(h.id, d, h.targetPerDay > 1 ? 1 : undefined)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          checkHabit(h.id, d, -1);
                        }}
                        title={`${fmtDate(d)} — ${v}/${h.targetPerDay}${h.targetPerDay > 1 ? ' (right-click to decrease)' : ''}`}
                      >
                        {done ? <Icon name="check" size={14} strokeWidth={3} /> : h.targetPerDay > 1 && v > 0 ? v : ''}
                      </button>
                    );
                  })}
                  <div className="center strong">
                    {s.current}
                    <span className="small muted"> / {s.best}</span>
                  </div>
                  <div className="center">
                    <span className="small">{Math.round(rate * 100)}%</span>
                  </div>
                  <button className="icon-btn" onClick={() => setEdit(h)} aria-label="Edit">
                    <Icon name="edit" size={15} />
                  </button>
                </div>
                {expanded === h.id && (
                  <div className="habit-expanded">
                    <Heatmap values={log} weeks={20} color={h.color} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <HabitModal habit={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function HabitModal({ habit, onClose }: { habit: Habit | 'new' | null; onClose: () => void }) {
  const isNew = habit === 'new';
  const h = habit && habit !== 'new' ? habit : null;
  const [key, setKey] = useState('');
  const [d, setD] = useState({ name: '', icon: '✨', color: COLORS[0], targetPerDay: 1, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  const [confirm, setConfirm] = useState(false);
  const cur = habit === 'new' ? 'new' : habit?.id || '';
  if (cur !== key) {
    setKey(cur);
    if (h) setD({ name: h.name, icon: h.icon, color: h.color, targetPerDay: h.targetPerDay, daysOfWeek: h.daysOfWeek });
    else setD({ name: '', icon: '✨', color: COLORS[0], targetPerDay: 1, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  }
  const s = useData.getState();
  const save = () => {
    if (!d.name.trim()) return toast('Name your habit', { kind: 'error' });
    if (!d.daysOfWeek.length) return toast('Pick at least one day', { kind: 'error' });
    if (h) s.updateHabit(h.id, d);
    else s.addHabit(d);
    toast(isNew ? 'Habit created' : 'Habit updated', { kind: 'success' });
    onClose();
  };
  return (
    <>
      <Modal
        open={!!habit}
        onClose={onClose}
        title={isNew ? 'New habit' : 'Edit habit'}
        width={480}
        footer={
          <>
            {h && (
              <>
                <button className="btn ghost danger-text" onClick={() => setConfirm(true)}>
                  <Icon name="trash" size={15} /> Delete
                </button>
                <button className="btn ghost" onClick={() => { s.updateHabit(h.id, { archived: true }); onClose(); toast('Habit archived'); }}>
                  Archive
                </button>
              </>
            )}
            <div style={{ flex: 1 }} />
            <button className="btn primary" onClick={save}>
              Save
            </button>
          </>
        }
      >
        <input className="title-input" autoFocus placeholder="e.g. Meditate 10 minutes" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
        <Field label="Icon">
          <div className="emoji-grid">
            {ICONS.map((i) => (
              <button key={i} className={cx('emoji-btn', d.icon === i && 'active')} onClick={() => setD({ ...d, icon: i })}>
                {i}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Color">
          <div className="row gap-s">
            {COLORS.map((c) => (
              <button key={c} className={cx('swatch', d.color === c && 'active')} style={{ background: c }} onClick={() => setD({ ...d, color: c })} aria-label={c} />
            ))}
          </div>
        </Field>
        <div className="grid-2">
          <Field label="Times per day">
            <input type="number" min={1} max={50} className="input" value={d.targetPerDay} onChange={(e) => setD({ ...d, targetPerDay: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
          <Field label="Repeat on">
            <div className="dow-picker">
              {[1, 2, 3, 4, 5, 6, 0].map((i) => (
                <button key={i} className={cx(d.daysOfWeek.includes(i) && 'active')} onClick={() => setD({ ...d, daysOfWeek: d.daysOfWeek.includes(i) ? d.daysOfWeek.filter((x) => x !== i) : [...d.daysOfWeek, i] })}>
                  {DAY_SHORT[i][0]}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Modal>
      <Confirm open={confirm} onClose={() => setConfirm(false)} title="Delete habit?" body="This permanently removes the habit and its entire history." onConfirm={() => { if (h) s.deleteHabit(h.id); onClose(); }} />
    </>
  );
}
