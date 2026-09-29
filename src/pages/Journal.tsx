import { useEffect, useMemo, useState } from 'react';
import { useData } from '../store/data';
import { toast } from '../store/ui';
import { Topbar } from '../components/Shell';
import { Icon } from '../components/Icon';
import { AreaChart } from '../components/Charts';
import { addDays, fmtDate, range, today, DAY_SHORT, weekdayOf, parseISO, startOfMonth, startOfWeek, fmtMonth, addMonths } from '../lib/date';
import { cx } from '../lib/id';
import type { JournalEntry } from '../types';

const MOODS = ['1', '2', '3', '4', '5'];
const MOOD_LABEL = ['Awful', 'Bad', 'Okay', 'Good', 'Great'];
const MOOD_COLOR = ['#d1d1d6', '#aeaeb2', '#8e8e93', '#5ac8fa', '#0071e3'];
const PROMPTS = [
  'What made today meaningful?',
  'What is one thing you learned today?',
  'What would make tomorrow great?',
  'What challenged you today, and how did you respond?',
  'Who are you grateful for, and why?',
  'What drained your energy today? What restored it?',
];

export default function Journal() {
  const journal = useData((s) => s.journal);
  const save = useData((s) => s.saveJournal);
  const weekStart = useData((s) => s.settings.weekStart);
  const [date, setDate] = useState(today());
  const [month, setMonth] = useState(startOfMonth(today()));
  const entry = journal[date];
  const [draft, setDraft] = useState<JournalEntry>(entry || { date, mood: 3, energy: 3, text: '', gratitude: '' });
  const prompt = PROMPTS[parseISO(date).getDate() % PROMPTS.length];

  useEffect(() => setDraft(journal[date] || { date, mood: 3, energy: 3, text: '', gratitude: '' }), [date]); // eslint-disable-line

  const commit = (d: JournalEntry) => {
    setDraft(d);
    save(d);
  };

  const moodSeries = useMemo(() => range(addDays(today(), -29), 30).map((d) => ({ date: d, value: journal[d]?.mood || 0 })), [journal]);
  const entries = Object.values(journal);
  const avg = entries.length ? entries.reduce((a, e) => a + e.mood, 0) / entries.length : 0;
  let streak = 0;
  for (let d = journal[today()] ? today() : addDays(today(), -1); journal[d]; d = addDays(d, -1)) streak++;

  const gridStart = startOfWeek(month, weekStart);
  const cells = range(gridStart, 42);

  return (
    <div className="page">
      <Topbar title="Journal" subtitle={`${entries.length} entries · ${streak}-day streak · avg mood ${avg.toFixed(1)}`} />
      <div className="journal-layout">
        <section className="card journal-editor">
          <div className="row between">
            <div className="row gap-s">
              <button className="icon-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
                <Icon name="chevronLeft" />
              </button>
              <h2>{fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
              <button className="icon-btn" disabled={date >= today()} onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
                <Icon name="chevronRight" />
              </button>
            </div>
            {date !== today() && (
              <button className="btn sm" onClick={() => setDate(today())}>
                Today
              </button>
            )}
          </div>

          <div className="field">
            <label>Mood</label>
            <div className="mood-row big">
              {MOODS.map((m, i) => (
                <button key={i} className={cx('mood-btn', draft.mood === i + 1 && 'active')} onClick={() => commit({ ...draft, mood: (i + 1) as JournalEntry['mood'] })} title={MOOD_LABEL[i]}>
                  <span className="mood-num">{m}</span>
                  <span className="small">{MOOD_LABEL[i]}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Energy · {draft.energy}/5</label>
            <input type="range" className="range" min={1} max={5} value={draft.energy} onChange={(e) => commit({ ...draft, energy: Number(e.target.value) as JournalEntry['energy'] })} />
          </div>
          <div className="field">
            <label>{prompt}</label>
            <textarea className="input journal-text" rows={8} placeholder="Write freely…" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} onBlur={() => save(draft)} />
          </div>
          <div className="field">
            <label>Grateful for</label>
            <input className="input" value={draft.gratitude} onChange={(e) => setDraft({ ...draft, gratitude: e.target.value })} onBlur={() => save(draft)} placeholder="Three small things" />
          </div>
          <div className="row between">
            <span className="small muted">{entry ? 'Saved automatically' : 'Not saved yet'}</span>
            <button className="btn primary" onClick={() => { save(draft); toast('Journal saved', { kind: 'success' }); }}>
              Save entry
            </button>
          </div>
        </section>

        <aside className="journal-side">
          <section className="card">
            <div className="card-head">
              <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
                <Icon name="chevronLeft" size={16} />
              </button>
              <h3>{fmtMonth(month)}</h3>
              <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
                <Icon name="chevronRight" size={16} />
              </button>
            </div>
            <div className="mini-cal">
              {range(gridStart, 7).map((d) => (
                <span key={d} className="small muted center">
                  {DAY_SHORT[weekdayOf(d)][0]}
                </span>
              ))}
              {cells.map((d) => {
                const j = journal[d];
                return (
                  <button
                    key={d}
                    className={cx('mini-day', d.slice(0, 7) !== month.slice(0, 7) && 'other', d === date && 'active', d === today() && 'today')}
                    style={j ? { background: `color-mix(in srgb, ${MOOD_COLOR[j.mood - 1]} 35%, transparent)` } : undefined}
                    disabled={d > today()}
                    onClick={() => setDate(d)}
                    title={j ? `${MOOD_LABEL[j.mood - 1]} — ${j.text.slice(0, 60)}` : ''}
                  >
                    {parseISO(d).getDate()}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="card">
            <div className="card-head">
              <h3>Mood · 30 days</h3>
            </div>
            <AreaChart data={moodSeries} height={120} color="#0071e3" format={(v) => (v ? `${MOOD_LABEL[v - 1]} (${v}/5)` : 'No entry')} />
          </section>
          <section className="card">
            <div className="card-head">
              <h3>Mood distribution</h3>
            </div>
            {MOODS.map((m, i) => {
              const n = entries.filter((e) => e.mood === i + 1).length;
              return (
                <div key={i} className="row gap-s small" style={{ marginBottom: 6 }}>
                  <span style={{ width: 44 }}>{MOOD_LABEL[Number(m) - 1]}</span>
                  <div className="progress flex-1" style={{ height: 8 }}>
                    <div className="progress-fill" style={{ width: `${entries.length ? (n / entries.length) * 100 : 0}%`, background: MOOD_COLOR[i] }} />
                  </div>
                  <span className="muted" style={{ width: 24, textAlign: 'right' }}>
                    {n}
                  </span>
                </div>
              );
            })}
          </section>
        </aside>
      </div>
    </div>
  );
}
