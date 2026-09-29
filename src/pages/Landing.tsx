import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useUI } from '../store/ui';
import { Icon } from '../components/Icon';
import { cx } from '../lib/id';
import '../landing.css';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = IS_MAC ? '⌘' : 'Ctrl';

const shot = (name: string) => `${import.meta.env.BASE_URL}shots/${name}`;

type Tab = 'plan' | 'focus' | 'reflect';
const GRID: Record<Tab, { title: string; body: string }[]> = {
  plan: [
    { title: 'Tasks & Projects', body: 'Lists, boards and tables with smart grouping.' },
    { title: 'Natural capture', body: '“Call Sam friday 3pm !high” — parsed instantly.' },
    { title: 'Kanban Board', body: 'Drag work between stages with WIP awareness.' },
    { title: 'Calendar', body: 'Month, week and agenda views with drag to reschedule.' },
    { title: 'Recurring Work', body: 'Daily, weekday, weekly and monthly routines.' },
    { title: 'Goals', body: 'Outcomes tracked from real tasks and focus time.' },
    { title: 'Subtasks', body: 'Break big work into small, checkable steps.' },
    { title: 'Bulk Editing', body: 'Select many, reschedule or move in one go.' },
    { title: 'Command Palette', body: `Search and run everything from ${MOD} K.` },
  ],
  focus: [
    { title: 'Focus Timer', body: 'Pomodoro cycles that keep running across pages.' },
    { title: 'Ambient Sound', body: 'White, pink, brown noise and rain — generated live.' },
    { title: 'Zen Mode', body: 'A full-screen timer and nothing else.' },
    { title: 'Time Tracking', body: 'Sessions add up against each task’s estimate.' },
    { title: 'Daily Targets', body: 'Set a focus goal and watch it fill.' },
    { title: 'Notifications', body: 'A quiet chime when each block ends.' },
    { title: 'Linked Notes', body: 'Markdown with [[links]], backlinks and a graph.' },
    { title: 'Templates', body: 'Daily notes, meetings, briefs — one click.' },
    { title: 'Keyboard First', body: 'Every page and action has a shortcut.' },
  ],
  reflect: [
    { title: 'Journal', body: 'Mood, energy and gratitude in under a minute.' },
    { title: 'Habits & Streaks', body: 'Targets per day, chosen weekdays, honest streaks.' },
    { title: 'Analytics', body: 'Trends compared against the previous period.' },
    { title: 'Activity Heatmap', body: 'Twenty-six weeks of effort at a glance.' },
    { title: 'Finance', body: 'Budgets, cash flow and a month-end forecast.' },
    { title: 'Insights', body: 'Your peak hours and best days, surfaced for you.' },
    { title: 'Daily Score', body: 'Tasks, focus, habits and journal in one number.' },
    { title: 'CSV & JSON Export', body: 'Your data leaves whenever you want it to.' },
    { title: 'Themes', body: 'Light, dark or system — with your own accent.' },
  ],
};

const STEPS = [
  { n: '01', title: 'Capture', body: 'Type the way you think. Nexus turns plain sentences into dated, prioritised tasks, events and notes.' },
  { n: '02', title: 'Focus', body: 'Pick one thing, start the timer and let the rest wait. Time spent flows straight back to the task.' },
  { n: '03', title: 'Reflect', body: 'Close the day with a short journal. Patterns in your habits, mood and focus surface on their own.' },
];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export default function Landing() {
  const navigate = useUI((s) => s.navigate);
  const [tab, setTab] = useState<Tab>('plan');
  const [scrolled, setScrolled] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal();

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 8);
    el.addEventListener('scroll', onScroll, { passive: true });
    const root = document.documentElement;
    const prev = root.dataset.theme;
    root.dataset.theme = 'light';
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (prev) root.dataset.theme = prev;
    };
  }, []);

  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const open = () => navigate('dashboard');

  return (
    <div className="lp" ref={rootRef}>
      <header className={cx('lp-nav', scrolled && 'scrolled')}>
        <div className="lp-wrap lp-nav-inner">
          <button className="lp-logo" onClick={() => rootRef.current?.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Nexus home">
            NEXUS
          </button>
          <nav className="lp-links">
            <button onClick={() => go('overview')}>Overview</button>
            <button onClick={() => go('features')}>Features</button>
            <button onClick={() => go('process')}>How it works</button>
            <button onClick={() => go('privacy')}>Privacy</button>
            <button className="lp-nav-cta" onClick={open}>
              Open app
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="lp-hero">
        <Ribbons />
        <div className="lp-hero-copy">
          <h1 className="lp-display">
            <span>Your whole day,</span>
            <span className="tone">in one quiet place.</span>
          </h1>
          <p className="lp-lede">Tasks, notes, calendar, habits, focus and money — together in a private workspace that lives entirely on your device.</p>
          <div className="lp-actions">
            <button className="lp-pill" onClick={open}>
              Open Nexus <Icon name="chevronRight" size={15} strokeWidth={2.4} />
            </button>
            <button className="lp-textlink" onClick={() => go('overview')}>
              See it in action <Icon name="chevronRight" size={15} strokeWidth={2.4} />
            </button>
          </div>
          <p className="lp-fine">Free. No account. Works offline.</p>
        </div>
      </section>

      {/* Built with */}
      <section className="lp-logos reveal">
        <div className="lp-eyebrow">Built on open standards</div>
        <div className="lp-logo-row">
          <span>React</span>
          <span>TypeScript</span>
          <span>Vite</span>
          <span>Web Audio</span>
          <span>Local-first</span>
        </div>
      </section>

      {/* Overview / device */}
      <section className="lp-showcase" id="overview">
        <div className="lp-wrap center reveal">
          <h2 className="lp-h2">Designed around how a day actually goes.</h2>
          <p className="lp-sub">One glance tells you what matters now, what’s next and how you’re doing.</p>
          <div className="lp-inline-links">
            <button className="lp-textlink big" onClick={open}>
              Open the dashboard <Icon name="chevronRight" size={16} strokeWidth={2.4} />
            </button>
            <button className="lp-textlink big" onClick={() => go('features')}>
              Explore features <Icon name="chevronRight" size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>
        <Laptop src={shot('dashboard.jpg')} alt="Nexus dashboard showing today’s tasks, schedule, habits and daily score" />
      </section>

      {/* Feature grid */}
      <section className="lp-grid-section" id="features">
        <div className="lp-mesh" aria-hidden>
          <span className="b1" />
          <span className="b2" />
          <span className="b3" />
        </div>
        <div className="lp-wrap center reveal">
          <div className="lp-eyebrow dark">Everything included</div>
          <h2 className="lp-h2 light-weight">Twenty-seven tools. One workspace.</h2>
          <div className="lp-tabs" role="tablist">
            {(
              [
                ['plan', 'Plan', 'tasks'],
                ['focus', 'Focus', 'focus'],
                ['reflect', 'Reflect', 'analytics'],
              ] as [Tab, string, string][]
            ).map(([k, label, icon]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={cx(tab === k && 'on')} onClick={() => setTab(k)}>
                <Icon name={icon} size={14} /> {label}
              </button>
            ))}
          </div>
          <div className="lp-cards" key={tab}>
            {GRID[tab].map((c, i) => (
              <div key={c.title} className="lp-card" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="lp-card-title">{c.title}</div>
                <div className="lp-card-body">{c.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="lp-process" id="process">
        <div className="lp-wrap center">
          <div className="lp-eyebrow on-dark reveal">— How it works —</div>
          <h2 className="lp-h2 on-dark reveal">A simple rhythm.</h2>
          <p className="lp-italic reveal">Capture, focus, reflect — every day.</p>
          <div className="lp-steps">
            <svg className="lp-arc" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden>
              <path d="M170 70 C 330 -10, 420 -10, 500 40 S 700 110, 830 40" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth="1.2" />
              <circle cx="330" cy="18" r="3" fill="#2997ff" />
              <circle cx="690" cy="86" r="3" fill="#2997ff" />
            </svg>
            {STEPS.map((s) => (
              <div key={s.n} className="lp-step reveal">
                <div className="lp-step-num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Split tiles */}
      <section className="lp-tiles">
        <Tile theme="light" title="Tasks" tagline="Plan it. Sort it. Ship it." img={shot('board.jpg')} onOpen={() => navigate('tasks')} />
        <Tile theme="dark" title="Notes" tagline="Linked thinking. Markdown. Instant." img={shot('notes-dark.jpg')} onOpen={() => navigate('notes')} />
        <Tile theme="dark" title="Focus" tagline="One timer. No distractions." img={shot('focus-dark.jpg')} onOpen={() => navigate('focus')} />
        <Tile theme="light" title="Finance" tagline="Budgets that keep themselves honest." img={shot('finance.jpg')} onOpen={() => navigate('finance')} />
      </section>

      {/* Privacy */}
      <section className="lp-privacy" id="privacy">
        <div className="lp-wrap center reveal">
          <h2 className="lp-display small on-dark">Private by design.</h2>
          <p className="lp-sub on-dark">Nexus has no servers to breach and no account to sign up for. Your data stays in your browser — export it anytime.</p>
        </div>
        <div className="lp-wrap lp-facts">
          <Fact icon="lock" title="No account" body="Open the app and start. Nothing to register." />
          <Fact icon="wifiOff" title="Works offline" body="Everything runs locally, even on a plane." />
          <Fact icon="download" title="Yours to keep" body="One-click JSON backups and CSV exports." />
        </div>
      </section>

      {/* Keyboard */}
      <section className="lp-keys">
        <div className="lp-wrap center reveal">
          <h2 className="lp-h2">Fast as a thought.</h2>
          <p className="lp-sub">Press a key, not a menu. The whole app is a few keystrokes away.</p>
          <div className="lp-keycaps">
            <Key k={MOD} />
            <Key k="K" />
            <span className="lp-key-label">Search everything</span>
            <Key k="N" />
            <span className="lp-key-label">New task</span>
            <Key k="G" />
            <Key k="T" />
            <span className="lp-key-label">Go to tasks</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="lp-cta">
        <div className="lp-wrap center reveal">
          <h2 className="lp-display small">Start a calmer day.</h2>
          <p className="lp-sub">It takes one click. A sample workspace is ready so you can explore right away.</p>
          <div className="lp-actions">
            <button className="lp-pill" onClick={open}>
              Open Nexus <Icon name="chevronRight" size={15} strokeWidth={2.4} />
            </button>
            <a className="lp-textlink" href="https://github.com/shazadarshad/nexus" target="_blank" rel="noreferrer">
              View source <Icon name="chevronRight" size={15} strokeWidth={2.4} />
            </a>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-foot-grid">
            <div>
              <div className="lp-logo">NEXUS</div>
              <p className="lp-foot-note">A personal operating system for people who like their tools quiet.</p>
            </div>
            <FootCol title="Product" items={[['Dashboard', 'dashboard'], ['Tasks', 'tasks'], ['Notes', 'notes'], ['Calendar', 'calendar']]} />
            <FootCol title="Growth" items={[['Habits', 'habits'], ['Focus', 'focus'], ['Goals', 'goals'], ['Journal', 'journal']]} />
            <FootCol title="Insights" items={[['Finance', 'finance'], ['Analytics', 'analytics'], ['Settings', 'settings']]} />
          </div>
          <div className="lp-foot-base">
            <span>© {new Date().getFullYear()} Nexus. All rights reserved.</span>
            <span>Made with care. Runs on your device.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FootCol({ title, items }: { title: string; items: [string, string][] }) {
  const navigate = useUI((s) => s.navigate);
  return (
    <div className="lp-foot-col">
      <div className="lp-foot-title">{title}</div>
      {items.map(([label, route]) => (
        <button key={route} onClick={() => navigate(route as never)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Laptop({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="lp-laptop reveal">
      <div className="lp-screen">
        <img src={src} alt={alt} loading="lazy" />
      </div>
      <div className="lp-base">
        <span />
      </div>
    </div>
  );
}

function Tile({ theme, title, tagline, img, onOpen }: { theme: 'light' | 'dark'; title: string; tagline: string; img: string; onOpen: () => void }) {
  return (
    <div className={cx('lp-tile', theme)}>
      <div className="lp-tile-copy reveal">
        <h3>{title}</h3>
        <p>{tagline}</p>
        <div className="lp-inline-links">
          <button className="lp-textlink" onClick={onOpen}>
            Open <Icon name="chevronRight" size={14} strokeWidth={2.4} />
          </button>
        </div>
      </div>
      <div className="lp-tile-img">
        <img src={img} alt={`${title} screen`} loading="lazy" />
      </div>
    </div>
  );
}

function Fact({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="lp-fact reveal">
      <Icon name={icon} size={22} strokeWidth={1.6} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function Key({ k }: { k: ReactNode }) {
  return <span className="lp-keycap">{k}</span>;
}

/** Soft sculpted ribbons behind the hero — pure SVG, no images. */
function Ribbons() {
  return (
    <svg className="lp-ribbons" viewBox="0 0 1440 820" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="rb-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#e9e9ee" />
          <stop offset="1" stopColor="#d4d4da" />
        </linearGradient>
        <linearGradient id="rb-b" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f7f9" />
          <stop offset="0.6" stopColor="#dedee4" />
          <stop offset="1" stopColor="#f2f2f5" />
        </linearGradient>
        <filter id="rb-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="18" />
          <feOffset dy="22" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.12" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="rb-fade" cx="0.5" cy="0.62" r="0.5">
          <stop offset="0" stopColor="#fff" stopOpacity="0.92" />
          <stop offset="0.7" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g filter="url(#rb-shadow)" opacity="0.95">
        <path d="M150 180 C 260 80, 360 140, 380 260 S 330 520, 470 600 S 760 560, 760 470" fill="none" stroke="url(#rb-a)" strokeWidth="92" strokeLinecap="round" />
        <path d="M470 330 C 600 300, 740 360, 760 450" fill="none" stroke="url(#rb-b)" strokeWidth="70" strokeLinecap="round" />
        <path d="M900 200 C 1010 150, 1080 260, 1010 380 S 960 560, 1080 620 S 1180 700, 1160 740" fill="none" stroke="url(#rb-a)" strokeWidth="84" strokeLinecap="round" />
        <path d="M1180 120 C 1300 160, 1330 260, 1280 330" fill="none" stroke="url(#rb-b)" strokeWidth="56" strokeLinecap="round" />
      </g>
      <rect x="0" y="0" width="1440" height="820" fill="url(#rb-fade)" />
    </svg>
  );
}
