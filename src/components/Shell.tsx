import type { ReactNode } from 'react';
import { useData } from '../store/data';
import { useUI } from '../store/ui';
import { Icon } from './Icon';
import { NAV } from './CommandPalette';
import { Kbd, Modal } from './ui';
import { cx } from '../lib/id';
import { fmtDate, today } from '../lib/date';

const fmtClock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function Sidebar() {
  const route = useUI((s) => s.route);
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const mobile = useUI((s) => s.mobileNav);
  const navigate = useUI((s) => s.navigate);
  const set = useUI((s) => s.set);
  const tasks = useData((s) => s.tasks);
  const projects = useData((s) => s.projects);
  const habits = useData((s) => s.habits);
  const t = today();
  const counts: Partial<Record<string, number>> = {
    tasks: tasks.filter((x) => x.status !== 'done' && x.due && x.due <= t).length,
    habits: habits.filter((h) => !h.archived && h.daysOfWeek.includes(new Date().getDay()) && (h.log[t] || 0) < h.targetPerDay).length,
  };
  const groups: [string, typeof NAV][] = [
    ['', NAV.slice(0, 1)],
    ['Workspace', NAV.slice(1, 4)],
    ['Growth', NAV.slice(4, 8)],
    ['Insights', NAV.slice(8, 10)],
  ];
  return (
    <>
      {mobile && <div className="scrim" onClick={() => set({ mobileNav: false })} />}
      <aside className={cx('sidebar', collapsed && 'collapsed', mobile && 'mobile-open')}>
        <div className="brand">
          <div className="logo">
            <svg viewBox="0 0 32 32" width="28" height="28">
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="var(--accent)" />
                  <stop offset="1" stopColor="#00d4ff" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="9" fill="url(#lg)" />
              <path d="M9 23V9l14 14V9" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {!collapsed && <span className="brand-name">Nexus</span>}
          <button
            className="icon-btn collapse-btn"
            onClick={() => {
              localStorage.setItem('nexus-sidebar', collapsed ? '0' : '1');
              set({ sidebarCollapsed: !collapsed });
            }}
            aria-label="Toggle sidebar"
          >
            <Icon name="sidebar" size={16} />
          </button>
        </div>

        <button className="search-trigger" onClick={() => set({ paletteOpen: true })}>
          <Icon name="search" size={16} />
          {!collapsed && (
            <>
              <span>Search</span>
              <Kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K'}</Kbd>
            </>
          )}
        </button>

        <nav className="nav">
          {groups.map(([g, items]) => (
            <div key={g || 'root'} className="nav-group">
              {g && !collapsed && <div className="nav-label">{g}</div>}
              {items.map((n) => (
                <button key={n.route} className={cx('nav-item', route === n.route && 'active')} onClick={() => navigate(n.route)} title={collapsed ? n.label : undefined}>
                  <Icon name={n.icon} size={18} />
                  {!collapsed && <span>{n.label}</span>}
                  {!!counts[n.route] && <span className="badge">{counts[n.route]}</span>}
                </button>
              ))}
            </div>
          ))}
          {!collapsed && (
            <div className="nav-group">
              <div className="nav-label">Projects</div>
              {projects
                .filter((p) => !p.archived)
                .map((p) => {
                  const open = tasks.filter((x) => x.projectId === p.id && x.status !== 'done').length;
                  return (
                    <button
                      key={p.id}
                      className="nav-item project"
                      onClick={() => {
                        navigate('tasks');
                        setTimeout(() => window.dispatchEvent(new CustomEvent('nexus:filter-project', { detail: p.id })), 0);
                      }}
                    >
                      <span className="dot" style={{ background: p.color }} />
                      <span>{p.name}</span>
                      <span className="count">{open || ''}</span>
                    </button>
                  );
                })}
            </div>
          )}
        </nav>

        <div className="sidebar-foot">
          <MiniTimer collapsed={collapsed} />
          <button className={cx('nav-item', route === 'settings' && 'active')} onClick={() => navigate('settings')} title="Settings">
            <Icon name="settings" size={18} />
            {!collapsed && <span>Settings</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

function MiniTimer({ collapsed }: { collapsed: boolean }) {
  const timer = useUI((s) => s.timer);
  const navigate = useUI((s) => s.navigate);
  if (!timer.running && timer.remaining === timer.total) return null;
  const left = Math.ceil(timer.remaining);
  return (
    <button className={cx('mini-timer', timer.mode !== 'focus' && 'break')} onClick={() => navigate('focus')}>
      <Icon name={timer.running ? 'focus' : 'pause'} size={16} />
      {!collapsed && <span>{timer.mode === 'focus' ? 'Focus' : 'Break'}</span>}
      <strong>{fmtClock(left)}</strong>
    </button>
  );
}

export function Topbar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const set = useUI((s) => s.set);
  const theme = useData((s) => s.settings.theme);
  const update = useData((s) => s.updateSettings);
  return (
    <header className="topbar">
      <button className="icon-btn mobile-only" onClick={() => set({ mobileNav: true })} aria-label="Open menu">
        <Icon name="menu" />
      </button>
      <div className="topbar-title">
        <h1>{title}</h1>
        {subtitle && <div className="muted small">{subtitle}</div>}
      </div>
      <div className="topbar-actions">
        {actions}
        <button className="icon-btn" onClick={() => update({ theme: theme === 'light' ? 'dark' : 'light' })} title="Toggle theme" aria-label="Toggle theme">
          <Icon name={theme === 'light' ? 'moon' : 'sun'} />
        </button>
        <button className="btn primary" onClick={() => set({ quickAddOpen: true })}>
          <Icon name="plus" size={16} />
          <span className="hide-sm">New</span>
          <Kbd>N</Kbd>
        </button>
      </div>
    </header>
  );
}

export function ShortcutsHelp() {
  const open = useUI((s) => s.shortcutsOpen);
  const set = useUI((s) => s.set);
  const rows: [string, string][] = [
    ['⌘/Ctrl K', 'Command palette & global search'],
    ['N', 'Quick add (task / event / note)'],
    ['/', 'Search'],
    ['?', 'This help'],
    ['[', 'Toggle sidebar'],
    ['Esc', 'Close dialogs'],
    ...NAV.map((n) => [`G then ${n.key.toUpperCase()}`, `Go to ${n.label}`] as [string, string]),
    ['Space (Focus page)', 'Start / pause timer'],
    ['⌘/Ctrl click (Tasks)', 'Multi-select tasks'],
    ['⌘/Ctrl S (Notes)', 'Save indicator / force save'],
  ];
  return (
    <Modal open={open} onClose={() => set({ shortcutsOpen: false })} title="Keyboard shortcuts" width={520}>
      <div className="shortcut-list">
        {rows.map(([k, v]) => (
          <div key={k} className="shortcut-row">
            <span>{v}</span>
            <span>
              {k.split(' then ').map((p, i) => (
                <span key={i}>
                  {i > 0 && <span className="muted small"> then </span>}
                  <Kbd>{p}</Kbd>
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        Today is {fmtDate(today(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.
      </p>
    </Modal>
  );
}
