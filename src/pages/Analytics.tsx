import { useMemo, useState } from 'react';
import { useData, getData } from '../store/data';
import { Topbar } from '../components/Shell';
import { Icon } from '../components/Icon';
import { AreaChart, BarChart, Donut, Heatmap } from '../components/Charts';
import { Progress, RichText, Segmented } from '../components/ui';
import { activityHeatmap, habitRate, insights, productivityScore, seriesFocus, seriesTasksDone } from '../lib/analytics';
import { addDays, DAY_SHORT, fmtMinutes, range, today } from '../lib/date';
import { sum } from '../lib/id';

export default function Analytics() {
  const state = useData();
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const n = Number(days);
  const data = getData();

  const tasksSeries = useMemo(() => seriesTasksDone(state.tasks, n * 2), [state.tasks, n]);
  const cur = tasksSeries.slice(n);
  const prev = tasksSeries.slice(0, n);
  const focus = useMemo(() => seriesFocus(state.sessions, n * 2), [state.sessions, n]);
  const fCur = focus.slice(n);
  const fPrev = focus.slice(0, n);
  const heat = useMemo(() => activityHeatmap(data, 26), [state.tasks, state.sessions, state.habits, state.journal]); // eslint-disable-line
  const tips = useMemo(() => insights(data), [state.tasks, state.sessions, state.habits, state.journal]); // eslint-disable-line
  const scoreSeries = useMemo(() => range(addDays(today(), -n + 1), n).map((d) => ({ date: d, value: productivityScore(data, d).score })), [n, state.tasks, state.sessions, state.habits, state.journal]); // eslint-disable-line

  const since = Date.now() - n * 864e5;
  const doneInRange = state.tasks.filter((t) => t.completedAt && t.completedAt >= since);
  const byWd = Array(7).fill(0);
  const byHour = Array(24).fill(0);
  doneInRange.forEach((t) => {
    const d = new Date(t.completedAt!);
    byWd[d.getDay()]++;
    byHour[d.getHours()]++;
  });
  const wdOrder = state.settings.weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const byProject = state.projects
    .map((p) => ({ label: `${p.icon} ${p.name}`, value: doneInRange.filter((t) => t.projectId === p.id).length, color: p.color }))
    .concat([{ label: 'No project', value: doneInRange.filter((t) => !t.projectId).length, color: '#64748b' }])
    .filter((x) => x.value > 0);
  const est = state.tasks.filter((t) => t.estimate && t.timeSpent);
  const accuracy = est.length ? sum(est.map((t) => t.timeSpent)) / sum(est.map((t) => t.estimate!)) : 0;
  const avgScore = scoreSeries.length ? Math.round(sum(scoreSeries.map((s) => s.value)) / scoreSeries.length) : 0;

  const pctChange = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
  const kpis = [
    { label: 'Tasks completed', value: String(sum(cur.map((x) => x.value))), change: pctChange(sum(cur.map((x) => x.value)), sum(prev.map((x) => x.value))), icon: 'check', color: '#22c55e' },
    { label: 'Focus time', value: fmtMinutes(sum(fCur.map((x) => x.value))), change: pctChange(sum(fCur.map((x) => x.value)), sum(fPrev.map((x) => x.value))), icon: 'focus', color: '#7c5cff' },
    { label: 'Avg daily score', value: String(avgScore), icon: 'zap', color: '#f59e0b' },
    { label: 'Habit consistency', value: `${state.habits.length ? Math.round((sum(state.habits.map((h) => habitRate(h, n))) / state.habits.length) * 100) : 0}%`, icon: 'habits', color: '#00d4ff' },
  ];

  return (
    <div className="page">
      <Topbar
        title="Analytics"
        subtitle="Understand how you work"
        actions={<Segmented value={days} onChange={setDays} options={[{ value: '7', label: '7d' }, { value: '30', label: '30d' }, { value: '90', label: '90d' }]} />}
      />
      <div className="fin-stats">
        {kpis.map((k) => (
          <div key={k.label} className="card fin-stat">
            <div className="stat-icon" style={{ color: k.color, background: `color-mix(in srgb, ${k.color} 14%, transparent)` }}>
              <Icon name={k.icon} size={18} />
            </div>
            <div>
              <div className="small muted">{k.label}</div>
              <div className="stat-value">{k.value}</div>
              {k.change !== undefined && (
                <div className={`small ${k.change >= 0 ? 'success-text' : 'danger-text'}`}>
                  {k.change >= 0 ? '▲' : '▼'} {Math.abs(k.change)}% vs prev {n}d
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="fin-grid">
        <section className="card span-2">
          <div className="card-head">
            <h3>Tasks completed</h3>
            <span className="small muted">dashed = previous period</span>
          </div>
          <AreaChart data={cur} secondary={prev} height={200} color="#22c55e" />
        </section>
        <section className="card span-2">
          <div className="card-head">
            <h3>Focus minutes</h3>
          </div>
          <AreaChart data={fCur} secondary={fPrev} height={200} color="#7c5cff" format={fmtMinutes} />
        </section>
        <section className="card span-2">
          <div className="card-head">
            <h3>Activity heatmap · 26 weeks</h3>
            <span className="small muted">tasks, focus, habits & journal</span>
          </div>
          <Heatmap values={heat} weeks={26} color={state.settings.accent} weekStart={state.settings.weekStart} />
        </section>
        <section className="card span-2">
          <div className="card-head">
            <h3>Daily score trend</h3>
          </div>
          <AreaChart data={scoreSeries} height={160} color="#f59e0b" />
        </section>
        <section className="card">
          <div className="card-head">
            <h3>By weekday</h3>
          </div>
          <BarChart data={wdOrder.map((i) => ({ label: DAY_SHORT[i], value: byWd[i] }))} height={150} highlightLast={false} />
        </section>
        <section className="card">
          <div className="card-head">
            <h3>By hour of day</h3>
          </div>
          <BarChart data={byHour.slice(6, 24).map((v, i) => ({ label: String(i + 6), value: v }))} height={150} highlightLast={false} color="#00d4ff" />
        </section>
        <section className="card">
          <div className="card-head">
            <h3>By project</h3>
          </div>
          <div className="donut-wrap">
            <Donut segments={byProject} size={150} center={<><strong>{doneInRange.length}</strong><div className="small muted">tasks</div></>} />
            <div className="legend">
              {byProject.map((p) => (
                <div key={p.label} className="legend-item small">
                  <span className="dot" style={{ background: p.color }} />
                  <span className="flex-1 ellipsis">{p.label}</span>
                  <strong>{p.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="card">
          <div className="card-head">
            <h3>Habit consistency · {n}d</h3>
          </div>
          {state.habits.map((h) => (
            <div key={h.id} className="budget-row">
              <div className="row between small">
                <span>
                  {h.icon} {h.name}
                </span>
                <strong>{Math.round(habitRate(h, n) * 100)}%</strong>
              </div>
              <Progress value={habitRate(h, n)} color={h.color} />
            </div>
          ))}
        </section>
        <section className="card span-2">
          <div className="card-head">
            <h3>
              <Icon name="sparkles" size={16} /> Insights
            </h3>
          </div>
          <ul className="insights">
            {tips.map((x, i) => (
              <li key={i}>
                <RichText text={x} />
              </li>
            ))}
            {est.length > 0 && (
              <li>
                <RichText text={`Estimation accuracy: tasks take **${Math.round(accuracy * 100)}%** of estimated time on average${accuracy > 1.15 ? ' — consider padding estimates.' : '.'}`} />
              </li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
