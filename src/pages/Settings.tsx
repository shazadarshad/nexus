import { useRef, useState } from 'react';
import { useData, getData, DATA_VERSION } from '../store/data';
import { toast } from '../store/ui';
import { Topbar } from '../components/Shell';
import { Icon } from '../components/Icon';
import { Confirm, Segmented } from '../components/ui';
import { download, cx } from '../lib/id';
import { today } from '../lib/date';
import type { DataState, Settings as S } from '../types';

const ACCENTS = ['#0071e3', '#1d1d1f', '#34a853', '#f5a623', '#ff3b30', '#af52de', '#5ac8fa', '#8e8e93'];

export default function Settings() {
  const s = useData((x) => x.settings);
  const update = useData((x) => x.updateSettings);
  const x = useData();
  const counts = { tasks: x.tasks.length, notes: x.notes.length, events: x.events.length, habits: x.habits.length, sessions: x.sessions.length, transactions: x.transactions.length, journal: Object.keys(x.journal).length };
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<'reset' | 'clear' | null>(null);
  const size = new Blob([localStorage.getItem('nexus-data') || '']).size;

  const importFile = (f: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(String(reader.result)) as DataState;
        if (!Array.isArray(d.tasks) || !Array.isArray(d.notes)) throw new Error('Invalid file');
        useData.getState().importData(d);
        toast(`Imported ${d.tasks.length} tasks, ${d.notes.length} notes`, { kind: 'success' });
      } catch (e) {
        toast(`Import failed: ${(e as Error).message}`, { kind: 'error' });
      }
    };
    reader.readAsText(f);
  };

  const requestNotif = async () => {
    if (!('Notification' in window)) return toast('Notifications not supported', { kind: 'error' });
    const p = await Notification.requestPermission();
    update({ notifications: p === 'granted' });
    toast(p === 'granted' ? 'Notifications enabled' : 'Permission denied', { kind: p === 'granted' ? 'success' : 'error' });
  };

  const num = (k: keyof S, v: string, min = 1, max = 600) => update({ [k]: Math.min(max, Math.max(min, Number(v) || min)) } as Partial<S>);

  return (
    <div className="page">
      <Topbar title="Settings" subtitle="Personalize Nexus" />
      <div className="settings">
        <Section title="Profile" icon="star">
          <Row label="Your name" hint="Used in greetings">
            <input className="input" value={s.name} onChange={(e) => update({ name: e.target.value })} style={{ maxWidth: 240 }} />
          </Row>
        </Section>

        <Section title="Appearance" icon="sun">
          <Row label="Theme">
            <Segmented value={s.theme} onChange={(v) => update({ theme: v })} options={[{ value: 'light', label: 'Light', icon: 'sun' }, { value: 'dark', label: 'Dark', icon: 'moon' }, { value: 'system', label: 'System' }]} />
          </Row>
          <Row label="Accent color">
            <div className="row gap-s">
              {ACCENTS.map((c) => (
                <button key={c} className={cx('swatch', s.accent === c && 'active')} style={{ background: c }} onClick={() => update({ accent: c })} aria-label={c} />
              ))}
              <input type="color" value={s.accent} onChange={(e) => update({ accent: e.target.value })} className="color-input" aria-label="Custom color" />
            </div>
          </Row>
          <Row label="Density">
            <Segmented value={s.density} onChange={(v) => update({ density: v })} options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} />
          </Row>
          <Row label="Reduce motion">
            <Switch checked={s.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
          </Row>
        </Section>

        <Section title="Calendar & regional" icon="calendar">
          <Row label="Week starts on">
            <Segmented value={String(s.weekStart) as '0' | '1'} onChange={(v) => update({ weekStart: Number(v) as 0 | 1 })} options={[{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }]} />
          </Row>
          <Row label="Currency">
            <select className="input" value={s.currency} onChange={(e) => update({ currency: e.target.value })} style={{ maxWidth: 160 }}>
              {['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'CHF', 'CNY', 'BRL', 'PKR', 'AED'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Row>
        </Section>

        <Section title="Focus timer" icon="focus">
          <Row label="Focus length (min)">
            <input type="number" className="input sm" value={s.focusMinutes} onChange={(e) => num('focusMinutes', e.target.value, 1, 180)} />
          </Row>
          <Row label="Short break (min)">
            <input type="number" className="input sm" value={s.shortBreak} onChange={(e) => num('shortBreak', e.target.value, 1, 60)} />
          </Row>
          <Row label="Long break (min)">
            <input type="number" className="input sm" value={s.longBreak} onChange={(e) => num('longBreak', e.target.value, 1, 90)} />
          </Row>
          <Row label="Sessions before long break">
            <input type="number" className="input sm" value={s.sessionsBeforeLong} onChange={(e) => num('sessionsBeforeLong', e.target.value, 1, 12)} />
          </Row>
          <Row label="Daily focus goal (min)">
            <input type="number" className="input sm" value={s.dailyFocusGoal} onChange={(e) => num('dailyFocusGoal', e.target.value, 5, 960)} />
          </Row>
          <Row label="Sounds" hint="Chime when a block ends">
            <Switch checked={s.sounds} onChange={(v) => update({ sounds: v })} />
          </Row>
          <Row label="Desktop notifications">
            {s.notifications ? <Switch checked onChange={() => update({ notifications: false })} /> : <button className="btn sm" onClick={requestNotif}><Icon name="bell" size={14} /> Enable</button>}
          </Row>
        </Section>

        <Section title="Data & privacy" icon="download">
          <p className="small muted" style={{ marginTop: 0 }}>
            All data lives locally in this browser ({(size / 1024).toFixed(1)} KB). Nothing is sent to any server. Schema v{DATA_VERSION}.
          </p>
          <div className="data-counts">
            {Object.entries(counts).map(([k, v]) => (
              <div key={k} className="data-count">
                <strong>{v}</strong>
                <span className="small muted">{k}</span>
              </div>
            ))}
          </div>
          <div className="row gap-s wrap">
            <button className="btn" onClick={() => { download(`nexus-backup-${today()}.json`, JSON.stringify(getData(), null, 2)); toast('Backup downloaded', { kind: 'success' }); }}>
              <Icon name="download" size={15} /> Export backup
            </button>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={15} /> Import backup
            </button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ''; }} />
            <button className="btn" onClick={() => setConfirm('reset')}>
              <Icon name="reset" size={15} /> Load demo data
            </button>
            <button className="btn danger" onClick={() => setConfirm('clear')}>
              <Icon name="trash" size={15} /> Erase everything
            </button>
          </div>
        </Section>

        <Section title="About" icon="sparkles">
          <p className="small muted" style={{ margin: 0 }}>
            <strong>Nexus 1.0</strong> — a local-first personal operating system. Built with React, TypeScript, Zustand & Vite. Zero trackers, works offline.
          </p>
        </Section>
      </div>
      <Confirm open={confirm === 'reset'} onClose={() => setConfirm(null)} title="Load demo data?" body="This replaces all your current data with the sample workspace. Export a backup first if needed." label="Replace" onConfirm={() => { useData.getState().resetDemo(); toast('Demo data loaded', { kind: 'success' }); }} />
      <Confirm open={confirm === 'clear'} onClose={() => setConfirm(null)} title="Erase everything?" body="This permanently deletes all tasks, notes, events, habits, sessions, transactions and journal entries. This cannot be undone." label="Erase" onConfirm={() => { useData.getState().clearAll(); toast('Workspace cleared'); }} />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="card settings-section">
      <h3>
        <Icon name={icon} size={16} /> {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="settings-row">
      <div>
        <div>{label}</div>
        {hint && <div className="small muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}
