import { useEffect, useState } from 'react';
import { useData } from '../store/data';
import { useUI } from '../store/ui';
import { Topbar } from '../components/Shell';
import { Icon } from '../components/Icon';
import { Ring, BarChart } from '../components/Charts';
import { Kbd, Segmented, Progress } from '../components/ui';
import { timer } from '../lib/timer';
import { playNoise, setNoiseVolume, stopNoise, type NoiseKind } from '../lib/audio';
import { focusOn, seriesFocus, dayOfTs } from '../lib/analytics';
import { fmtMinutes, today } from '../lib/date';
import { cx, sum } from '../lib/id';
import type { TimerMode } from '../store/ui';

const QUOTES = [
  ['The successful warrior is the average man, with laser-like focus.', 'Bruce Lee'],
  ['Concentrate all your thoughts upon the work at hand.', 'Alexander Graham Bell'],
  ['Where focus goes, energy flows.', 'Tony Robbins'],
  ['Deep work is the superpower of the 21st century.', 'Cal Newport'],
  ['It is not enough to be busy. The question is: what are we busy about?', 'Henry David Thoreau'],
];

let currentNoise: NoiseKind = 'off';

export default function Focus() {
  const t = useUI((s) => s.timer);
  const setTimer = useUI((s) => s.setTimer);
  const tasks = useData((s) => s.tasks);
  const sessions = useData((s) => s.sessions);
  const settings = useData((s) => s.settings);
  const [noise, setNoise] = useState<NoiseKind>(currentNoise);
  const [vol, setVol] = useState(0.4);
  const [zen, setZen] = useState(false);
  const [quote] = useState(() => QUOTES[Math.floor(Math.random() * QUOTES.length)]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).matches('input, textarea, select')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        timer.toggle();
      }
      if (e.key === 'Escape' && zen) setZen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zen]);

  const pickNoise = (n: NoiseKind) => {
    currentNoise = n;
    setNoise(n);
    if (n === 'off') stopNoise();
    else playNoise(n, vol);
  };

  const rem = Math.ceil(t.remaining);
  const mm = String(Math.floor(rem / 60)).padStart(2, '0');
  const ss = String(rem % 60).padStart(2, '0');
  const pct = 1 - t.remaining / t.total;
  const color = t.mode === 'focus' ? 'var(--accent)' : t.mode === 'short' ? 'var(--success)' : 'var(--success)';
  const linked = tasks.find((x) => x.id === t.taskId);
  const todayMin = focusOn(sessions, today());
  const todaySessions = sessions.filter((s) => s.kind === 'focus' && dayOfTs(s.start) === today()).sort((a, b) => b.start - a.start);
  const week = seriesFocus(sessions, 7);
  const open = tasks.filter((x) => x.status !== 'done').sort((a, b) => b.priority - a.priority);
  const total = sum(sessions.filter((s) => s.kind === 'focus').map((s) => s.minutes));

  const timerUI = (
    <div className={cx('timer-wrap', zen && 'zen')}>
      <Segmented<TimerMode>
        value={t.mode}
        onChange={(m) => timer.setMode(m)}
        options={[
          { value: 'focus', label: 'Focus' },
          { value: 'short', label: 'Short break' },
          { value: 'long', label: 'Long break' },
        ]}
      />
      <Ring value={pct} size={zen ? 360 : 280} thickness={zen ? 14 : 12} color={color}>
        <div className="timer-digits">
          {mm}:{ss}
        </div>
        <div className="muted small">{t.running ? (t.mode === 'focus' ? 'Stay focused' : 'Relax') : rem === t.total ? 'Ready' : 'Paused'}</div>
      </Ring>
      <div className="session-dots">
        {Array.from({ length: settings.sessionsBeforeLong }).map((_, i) => (
          <span key={i} className={cx('sdot', i < t.completedFocus % settings.sessionsBeforeLong && 'on')} />
        ))}
        <span className="small muted">#{t.completedFocus + 1}</span>
      </div>
      <div className="timer-controls">
        <button className="icon-btn lg" onClick={() => timer.reset()} title="Reset" aria-label="Reset">
          <Icon name="reset" />
        </button>
        <button className="play-btn" style={{ background: color }} onClick={() => timer.toggle()} aria-label={t.running ? 'Pause' : 'Start'}>
          <Icon name={t.running ? 'pause' : 'play'} size={28} />
        </button>
        <button className="icon-btn lg" onClick={() => timer.skip()} title="Skip" aria-label="Skip">
          <Icon name="skip" />
        </button>
      </div>
      {linked && (
        <div className="linked-task">
          <Icon name="tasks" size={14} /> {linked.title}
        </div>
      )}
      {zen && (
        <p className="zen-quote">
          “{quote[0]}” <span className="muted">— {quote[1]}</span>
        </p>
      )}
      <div className="small muted">
        <Kbd>Space</Kbd> start/pause {zen && <> · <Kbd>Esc</Kbd> exit zen</>}
      </div>
    </div>
  );

  if (zen)
    return (
      <div className="zen-overlay" style={{ ['--c' as string]: color }}>
        <button className="icon-btn zen-close" onClick={() => setZen(false)} aria-label="Exit zen mode">
          <Icon name="x" />
        </button>
        {timerUI}
      </div>
    );

  return (
    <div className="page">
      <Topbar
        title="Focus"
        subtitle={`${fmtMinutes(todayMin)} focused today · ${fmtMinutes(total)} all-time`}
        actions={
          <button className="btn ghost sm" onClick={() => setZen(true)}>
            <Icon name="maximize" size={15} /> Zen mode
          </button>
        }
      />
      <div className="focus-layout">
        <section className="card focus-main">{timerUI}</section>
        <aside className="focus-side">
          <section className="card">
            <div className="card-head">
              <h3>Working on</h3>
            </div>
            <select className="input" value={t.taskId || ''} onChange={(e) => setTimer({ taskId: e.target.value || null })}>
              <option value="">— No task (free focus) —</option>
              {open.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
            {linked?.estimate && (
              <div style={{ marginTop: 10 }}>
                <div className="row between small muted">
                  <span>Tracked {fmtMinutes(linked.timeSpent)}</span>
                  <span>Estimate {fmtMinutes(linked.estimate)}</span>
                </div>
                <Progress value={linked.timeSpent / linked.estimate} color={linked.timeSpent > linked.estimate ? 'var(--danger)' : undefined} />
              </div>
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <h3>Daily goal</h3>
              <span className="small muted">
                {fmtMinutes(todayMin)} / {fmtMinutes(settings.dailyFocusGoal)}
              </span>
            </div>
            <Progress value={todayMin / settings.dailyFocusGoal} height={8} />
          </section>
          <section className="card">
            <div className="card-head">
              <h3>
                <Icon name="volume" size={16} /> Ambient sound
              </h3>
            </div>
            <div className="noise-grid">
              {(['off', 'white', 'pink', 'brown', 'rain'] as NoiseKind[]).map((n) => (
                <button key={n} className={cx('chip clickable', noise === n && 'active')} onClick={() => pickNoise(n)}>
                  {{ off: 'Off', white: 'White', pink: 'Pink', brown: 'Brown', rain: 'Rain' }[n]}
                </button>
              ))}
            </div>
            {noise !== 'off' && (
              <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => { setVol(+e.target.value); setNoiseVolume(+e.target.value); }} className="range" aria-label="Volume" />
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <h3>This week</h3>
            </div>
            <BarChart data={week} height={120} format={(v) => fmtMinutes(v)} />
          </section>
          <section className="card">
            <div className="card-head">
              <h3>Today's sessions</h3>
              <span className="small muted">{todaySessions.length}</span>
            </div>
            {todaySessions.length === 0 && <div className="small muted">No sessions yet — press start!</div>}
            {todaySessions.map((s) => (
              <div key={s.id} className="session-item small">
                <span>{new Date(s.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                <span className="muted ellipsis">{tasks.find((x) => x.id === s.taskId)?.title || 'Free focus'}</span>
                <strong>{s.minutes}m</strong>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
