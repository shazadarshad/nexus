import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData, getData } from '../store/data';
import { useUI, toast } from '../store/ui';
import type { Route } from '../types';
import { Icon } from './Icon';
import { Kbd } from './ui';
import { cx, download, fuzzy } from '../lib/id';
import { fmtDate, relativeDay, today } from '../lib/date';

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: string;
  keywords?: string;
  run: () => void;
}

export const NAV: { route: Route; label: string; icon: string; key: string }[] = [
  { route: 'dashboard', label: 'Dashboard', icon: 'dashboard', key: 'd' },
  { route: 'tasks', label: 'Tasks', icon: 'tasks', key: 't' },
  { route: 'notes', label: 'Notes', icon: 'notes', key: 'n' },
  { route: 'calendar', label: 'Calendar', icon: 'calendar', key: 'c' },
  { route: 'habits', label: 'Habits', icon: 'habits', key: 'h' },
  { route: 'focus', label: 'Focus', icon: 'focus', key: 'f' },
  { route: 'goals', label: 'Goals', icon: 'goals', key: 'g' },
  { route: 'journal', label: 'Journal', icon: 'journal', key: 'j' },
  { route: 'finance', label: 'Finance', icon: 'finance', key: 'm' },
  { route: 'analytics', label: 'Analytics', icon: 'analytics', key: 'a' },
  { route: 'settings', label: 'Settings', icon: 'settings', key: 's' },
];

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const ui = useUI();
  const data = useData();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const close = () => ui.set({ paletteOpen: false });

  const items = useMemo<Item[]>(() => {
    if (!open) return [];
    const cmds: Item[] = [
      { id: 'c-task', group: 'Actions', label: 'Create task', icon: 'plus', hint: 'N', keywords: 'new add todo', run: () => ui.set({ quickAddOpen: true }) },
      { id: 'c-note', group: 'Actions', label: 'Create note', icon: 'notes', keywords: 'new write', run: () => { const n = data.addNote({ title: 'Untitled' }); ui.set({ selectedNoteId: n.id }); ui.navigate('notes'); } },
      { id: 'c-event', group: 'Actions', label: 'Create event', icon: 'calendar', keywords: 'new meeting schedule', run: () => ui.set({ eventModal: { id: 'new' } }) },
      { id: 'c-focus', group: 'Actions', label: ui.timer.running ? 'Pause focus timer' : 'Start focus timer', icon: 'focus', keywords: 'pomodoro timer', run: () => { ui.navigate('focus'); window.dispatchEvent(new CustomEvent('nexus:timer-toggle')); } },
      { id: 'c-journal', group: 'Actions', label: "Write today's journal", icon: 'journal', keywords: 'mood diary', run: () => ui.navigate('journal') },
      { id: 'c-expense', group: 'Actions', label: 'Log expense', icon: 'wallet', keywords: 'money spend finance', run: () => { ui.navigate('finance'); setTimeout(() => window.dispatchEvent(new CustomEvent('nexus:add-tx')), 50); } },
      { id: 'c-theme', group: 'Actions', label: `Switch to ${data.settings.theme === 'light' ? 'dark' : 'light'} theme`, icon: data.settings.theme === 'light' ? 'moon' : 'sun', keywords: 'appearance mode', run: () => data.updateSettings({ theme: data.settings.theme === 'light' ? 'dark' : 'light' }) },
      { id: 'c-sidebar', group: 'Actions', label: 'Toggle sidebar', icon: 'sidebar', hint: '[', run: () => ui.set({ sidebarCollapsed: !ui.sidebarCollapsed }) },
      { id: 'c-export', group: 'Actions', label: 'Export backup (JSON)', icon: 'download', keywords: 'save backup', run: () => { download(`nexus-backup-${today()}.json`, JSON.stringify(getData(), null, 2)); toast('Backup downloaded', { kind: 'success' }); } },
      { id: 'c-keys', group: 'Actions', label: 'Keyboard shortcuts', icon: 'keyboard', hint: '?', run: () => ui.set({ shortcutsOpen: true }) },
    ];
    const nav: Item[] = NAV.map((n) => ({ id: 'n-' + n.route, group: 'Navigate', label: `Go to ${n.label}`, icon: n.icon, hint: `G ${n.key.toUpperCase()}`, run: () => ui.navigate(n.route) }));
    if (!q.trim()) return [...cmds.slice(0, 5), ...nav];

    const all: (Item & { score: number })[] = [];
    const push = (it: Item, text: string) => {
      const s = fuzzy(q, text);
      if (s > 0) all.push({ ...it, score: s });
    };
    [...cmds, ...nav].forEach((c) => push(c, `${c.label} ${c.keywords || ''}`));
    data.tasks.forEach((t) =>
      push(
        { id: 't-' + t.id, group: 'Tasks', label: t.title, icon: t.status === 'done' ? 'check' : 'tasks', hint: t.status === 'done' ? 'done' : relativeDay(t.due), run: () => ui.set({ taskModal: { id: t.id } }) },
        `${t.title} ${t.tags.join(' ')} ${t.description}`
      )
    );
    data.notes.forEach((n) =>
      push({ id: 'o-' + n.id, group: 'Notes', label: n.title, icon: 'notes', hint: n.folder, run: () => { ui.set({ selectedNoteId: n.id }); ui.navigate('notes'); } }, `${n.title} ${n.tags.join(' ')} ${n.content.slice(0, 400)}`)
    );
    data.events.forEach((e) => push({ id: 'e-' + e.id, group: 'Events', label: e.title, icon: 'calendar', hint: fmtDate(e.date), run: () => ui.set({ eventModal: { id: e.id } }) }, `${e.title} ${e.location}`));
    data.projects.forEach((p) => push({ id: 'p-' + p.id, group: 'Projects', label: `${p.icon} ${p.name}`, icon: 'folder', run: () => { ui.navigate('tasks'); window.dispatchEvent(new CustomEvent('nexus:filter-project', { detail: p.id })); } }, p.name));
    data.habits.forEach((h) => push({ id: 'h-' + h.id, group: 'Habits', label: `${h.icon} ${h.name}`, icon: 'habits', hint: 'toggle today', run: () => { data.checkHabit(h.id, today()); toast(`Toggled ${h.name}`); } }, h.name));
    all.sort((a, b) => b.score - a.score);
    const quick: Item = { id: 'quick', group: 'Actions', label: `Create task “${q}”`, icon: 'plus', run: () => { data.addTask({ title: q }); toast('Task created', { kind: 'success' }); } };
    return [...all.slice(0, 40), quick];
  }, [q, open, data, ui]);

  useEffect(() => setIdx(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('.pal-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  if (!open) return null;

  const run = (it: Item) => {
    close();
    setTimeout(it.run, 0);
  };

  let lastGroup = '';
  return createPortal(
    <div className="overlay top" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="palette" role="dialog" aria-label="Command palette">
        <div className="pal-input">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={q}
            placeholder="Search everything or run a command…"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIdx((i) => Math.min(items.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIdx((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter' && items[idx]) run(items[idx]);
            }}
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="pal-list" ref={listRef}>
          {items.length === 0 && <div className="pal-empty muted">No results</div>}
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? <div className="pal-group">{it.group}</div> : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header}
                <div className={cx('pal-item', i === idx && 'active')} onMouseMove={() => setIdx(i)} onClick={() => run(it)}>
                  <Icon name={it.icon} size={16} />
                  <span className="pal-label">{it.label}</span>
                  {it.hint && <span className="pal-hint">{it.hint}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="pal-foot small muted">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span>
            <Kbd>↵</Kbd> select
          </span>
          <span>{items.length} results</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
