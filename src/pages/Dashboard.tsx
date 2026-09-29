import { useMemo } from 'react';
import { useData, getData } from '../store/data';
import { useUI } from '../store/ui';
import { Topbar } from '../components/Shell';
import { Icon } from '../components/Icon';
import { TaskRow } from '../components/TaskParts';
import { Ring, BarChart, Sparkline } from '../components/Charts';
import { Empty, Progress, RichText } from '../components/ui';
import { addDays, fmtDate, fmtMinutes, fmtTime, greeting, timeAgo, today, timeToMin } from '../lib/date';
import { focusOn, goalProgress, habitStreak, insights, isHabitDone, monthTotals, productivityScore, seriesFocus, seriesTasksDone } from '../lib/analytics';
import { cx, fmtMoney } from '../lib/id';
import type { JournalEntry } from '../types';

const MOODS = ['😞', '😕', '😐', '🙂', '😄'];

export default function Dashboard() {
  const state = useData();
  const ui = useUI();
  const t = today();
  const data = getData();
  const score = useMemo(() => productivityScore(data, t), [state.tasks, state.sessions, state.habits, state.journal]); // eslint-disable-line
  const tips = useMemo(() => insights(data), [state.tasks, state.sessions, state.habits]); // eslint-disable-line

  const open = state.tasks.filter((x) => x.status !== 'done');
  const overdue = open.filter((x) => x.due && x.due < t).sort((a, b) => b.priority - a.priority);
  const dueToday = open.filter((x) => x.due === t).sort((a, b) => (a.dueTime || '99').localeCompare(b.dueTime || '99') || b.priority - a.priority);
  const doneToday = state.tasks.filter((x) => x.completedAt && new Date(x.completedAt).toDateString() === new Date().toDateString());
  const upcoming = open.filter((x) => x.due && x.due > t && x.due <= addDays(t, 7)).sort((a, b) => a.due!.localeCompare(b.due!)).slice(0, 5);
  const events = state.events.filter((e) => e.date === t).sort((a, b) => a.start.localeCompare(b.start));
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const focusToday = focusOn(state.sessions, t);
  const weekTasks = seriesTasksDone(state.tasks, 7);
  const weekFocus = seriesFocus(state.sessions, 14).map((x) => x.value);
  const habits = state.habits.filter((h) => !h.archived && h.daysOfWeek.includes(new Date().getDay()));
  const month = monthTotals(state.transactions, t.slice(0, 7));
  const journal = state.journal[t];

  const setMood = (mood: JournalEntry['mood']) =>
    state.saveJournal({ date: t, mood, energy: journal?.energy || 3, text: journal?.text || '', gratitude: journal?.gratitude || '' });

  return (
    <div className="page">
      <Topbar title={`${greeting()}, ${state.settings.name}`} subtitle={fmtDate(t, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} />
      <div className="dash-grid">
        {/* Score */}
        <section className="card score-card">
          <div className="card-head">
            <h3>Daily score</h3>
            <span className="muted small">live</span>
          </div>
          <div className="score-body">
            <Ring value={score.score / 100} size={132} thickness={12}>
              <div className="ring-value">{score.score}</div>
              <div className="small muted">/ 100</div>
            </Ring>
            <div className="score-parts">
              {score.parts.map((p) => (
                <div key={p.label}>
                  <div className="row between small">
                    <span>{p.label}</span>
                    <span className="muted">{Math.round(p.value * 100)}%</span>
                  </div>
                  <Progress value={p.value} height={5} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="card stats-card">
          <Stat icon="check" label="Done today" value={doneToday.length} color="#22c55e" sub={`${dueToday.length} remaining`} />
          <Stat icon="focus" label="Focus" value={fmtMinutes(focusToday)} color="#7c5cff" sub={`goal ${fmtMinutes(state.settings.dailyFocusGoal)}`} extra={<Sparkline values={weekFocus} />} />
          <Stat icon="fire" label="Best streak" value={Math.max(0, ...state.habits.map((h) => habitStreak(h).current))} color="#f97316" sub="days in a row" />
          <Stat icon="flag" label="Overdue" value={overdue.length} color={overdue.length ? '#ef4444' : '#64748b'} sub={overdue.length ? 'needs attention' : 'all clear'} />
        </section>

        {/* Today tasks */}
        <section className="card span-2 tall">
          <div className="card-head">
            <h3>
              <Icon name="tasks" size={16} /> Today
            </h3>
            <button className="link-btn small" onClick={() => ui.navigate('tasks')}>
              All tasks →
            </button>
          </div>
          {overdue.length > 0 && (
            <>
              <div className="sub-head danger">
                Overdue · {overdue.length}
                <button
                  className="link-btn small"
                  onClick={() => {
                    state.bulkUpdateTasks(overdue.map((x) => x.id), { due: t });
                    ui.toast(`Rescheduled ${overdue.length} tasks to today`, { kind: 'success' });
                  }}
                >
                  Reschedule to today
                </button>
              </div>
              {overdue.slice(0, 4).map((x) => (
                <TaskRow key={x.id} task={x} />
              ))}
            </>
          )}
          <div className="sub-head">Due today · {dueToday.length}</div>
          {dueToday.length === 0 && overdue.length === 0 ? (
            <Empty icon="sparkles" title="Nothing due today" hint="Enjoy the calm, or plan ahead." action={<button className="btn" onClick={() => ui.set({ quickAddOpen: true })}>Add a task</button>} />
          ) : (
            dueToday.map((x) => <TaskRow key={x.id} task={x} />)
          )}
          {doneToday.length > 0 && (
            <details className="done-details">
              <summary className="sub-head">Completed · {doneToday.length}</summary>
              {doneToday.map((x) => (
                <TaskRow key={x.id} task={x} />
              ))}
            </details>
          )}
        </section>

        {/* Schedule */}
        <section className="card tall">
          <div className="card-head">
            <h3>
              <Icon name="calendar" size={16} /> Schedule
            </h3>
            <button className="icon-btn" onClick={() => ui.set({ eventModal: { id: 'new', defaults: { date: t } } })} aria-label="Add event">
              <Icon name="plus" size={16} />
            </button>
          </div>
          {events.length === 0 ? (
            <Empty icon="calendar" title="No events today" />
          ) : (
            <div className="agenda">
              {events.map((e) => {
                const past = !e.allDay && timeToMin(e.end) < nowMin;
                const now = !e.allDay && timeToMin(e.start) <= nowMin && timeToMin(e.end) >= nowMin;
                return (
                  <button key={e.id} className={cx('agenda-item', past && 'past', now && 'now')} onClick={() => ui.set({ eventModal: { id: e.id } })}>
                    <span className="agenda-time">{e.allDay ? 'All day' : fmtTime(e.start)}</span>
                    <span className="agenda-bar" style={{ background: e.color }} />
                    <span className="agenda-text">
                      <strong>{e.title}</strong>
                      <span className="small muted">
                        {e.allDay ? '' : `${fmtTime(e.start)} – ${fmtTime(e.end)}`}
                        {e.location && ` · ${e.location}`}
                      </span>
                    </span>
                    {now && <span className="live-dot">NOW</span>}
                  </button>
                );
              })}
            </div>
          )}
          {upcoming.length > 0 && (
            <>
              <div className="sub-head">Coming up this week</div>
              {upcoming.map((x) => (
                <TaskRow key={x.id} task={x} compact showProject={false} />
              ))}
            </>
          )}
        </section>

        {/* Habits */}
        <section className="card">
          <div className="card-head">
            <h3>
              <Icon name="habits" size={16} /> Habits
            </h3>
            <span className="small muted">
              {habits.filter((h) => isHabitDone(h, t)).length}/{habits.length}
            </span>
          </div>
          <div className="habit-quick">
            {habits.map((h) => {
              const done = isHabitDone(h, t);
              const cur = h.log[t] || 0;
              return (
                <button key={h.id} className={cx('habit-pill', done && 'done')} style={{ ['--c' as string]: h.color }} onClick={() => state.checkHabit(h.id, t, h.targetPerDay > 1 ? (done ? -cur : 1) : undefined)}>
                  <span className="habit-icon">{h.icon}</span>
                  <span className="habit-name">{h.name}</span>
                  <span className="small">{h.targetPerDay > 1 ? `${cur}/${h.targetPerDay}` : done ? '✓' : ''}</span>
                </button>
              );
            })}
            {habits.length === 0 && <Empty icon="habits" title="No habits yet" />}
          </div>
        </section>

        {/* Weekly chart */}
        <section className="card">
          <div className="card-head">
            <h3>
              <Icon name="analytics" size={16} /> This week
            </h3>
            <span className="small muted">tasks completed</span>
          </div>
          <BarChart data={weekTasks} height={150} color="var(--accent)" />
        </section>

        {/* Mood */}
        <section className="card">
          <div className="card-head">
            <h3>
              <Icon name="journal" size={16} /> How are you feeling?
            </h3>
            <button className="link-btn small" onClick={() => ui.navigate('journal')}>
              Journal →
            </button>
          </div>
          <div className="mood-row">
            {MOODS.map((m, i) => (
              <button key={i} className={cx('mood-btn', journal?.mood === i + 1 && 'active')} onClick={() => setMood((i + 1) as JournalEntry['mood'])} aria-label={`Mood ${i + 1}`}>
                {m}
              </button>
            ))}
          </div>
          {journal?.text && <p className="small muted clamp-2">“{journal.text}”</p>}
        </section>

        {/* Insights */}
        <section className="card span-2">
          <div className="card-head">
            <h3>
              <Icon name="sparkles" size={16} /> Insights
            </h3>
            <button className="link-btn small" onClick={() => ui.navigate('analytics')}>
              Analytics →
            </button>
          </div>
          <ul className="insights">
            {tips.slice(0, 4).map((x, i) => (
              <li key={i}>
                <RichText text={x} />
              </li>
            ))}
          </ul>
        </section>

        {/* Goals */}
        <section className="card">
          <div className="card-head">
            <h3>
              <Icon name="goals" size={16} /> Goals
            </h3>
            <button className="link-btn small" onClick={() => ui.navigate('goals')}>
              All →
            </button>
          </div>
          {state.goals.slice(0, 3).map((g) => {
            const p = goalProgress(g, data);
            return (
              <div key={g.id} className="goal-mini">
                <div className="row between small">
                  <span className="ellipsis">{g.title}</span>
                  <strong>{Math.round(p.pct * 100)}%</strong>
                </div>
                <Progress value={p.pct} color={g.color} />
              </div>
            );
          })}
          {state.goals.length === 0 && <Empty icon="goals" title="No goals yet" />}
        </section>

        {/* Finance */}
        <section className="card">
          <div className="card-head">
            <h3>
              <Icon name="wallet" size={16} /> This month
            </h3>
            <button className="link-btn small" onClick={() => ui.navigate('finance')}>
              Finance →
            </button>
          </div>
          <div className="fin-mini">
            <div>
              <div className="small muted">Income</div>
              <div className="success-text strong">{fmtMoney(month.income, state.settings.currency)}</div>
            </div>
            <div>
              <div className="small muted">Spent</div>
              <div className="danger-text strong">{fmtMoney(month.expense, state.settings.currency)}</div>
            </div>
            <div>
              <div className="small muted">Net</div>
              <div className="strong">{fmtMoney(month.net, state.settings.currency)}</div>
            </div>
          </div>
        </section>

        {/* Activity */}
        <section className="card">
          <div className="card-head">
            <h3>
              <Icon name="zap" size={16} /> Activity
            </h3>
          </div>
          <div className="activity">
            {state.activity.slice(0, 7).map((a) => (
              <div key={a.id} className="activity-item">
                <span className={cx('activity-dot', `k-${a.kind}`)} />
                <span className="ellipsis">{a.text}</span>
                <span className="small muted nowrap">{timeAgo(a.ts)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub, color, extra }: { icon: string; label: string; value: React.ReactNode; sub?: string; color: string; extra?: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-icon" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
        <Icon name={icon} size={18} />
      </div>
      <div className="stat-body">
        <div className="small muted">{label}</div>
        <div className="stat-value">{value}</div>
        {sub && <div className="small muted">{sub}</div>}
      </div>
      {extra}
    </div>
  );
}
