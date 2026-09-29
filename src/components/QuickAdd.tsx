import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useData } from '../store/data';
import { useUI, toast } from '../store/ui';
import { parseInput } from '../lib/nlp';
import { Icon } from './Icon';
import { Kbd } from './ui';
import { cx } from '../lib/id';
import { fmtDate, minToTime, timeToMin, relativeDay, fmtTime, today } from '../lib/date';

type Kind = 'task' | 'event' | 'note';
const KINDS: { k: Kind; label: string; icon: string; ph: string }[] = [
  { k: 'task', label: 'Task', icon: 'tasks', ph: 'e.g. Send invoice tomorrow 10am !high #finance +Home ~20m' },
  { k: 'event', label: 'Event', icon: 'calendar', ph: 'e.g. Lunch with Maya friday 12:30pm' },
  { k: 'note', label: 'Note', icon: 'notes', ph: 'Note title — press Enter to start writing' },
];

export function QuickAdd() {
  const open = useUI((s) => s.quickAddOpen);
  const setUI = useUI((s) => s.set);
  const projects = useData((s) => s.projects);
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Kind>('task');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setText('');
      setTimeout(() => ref.current?.focus(), 10);
    }
  }, [open]);

  const parsed = useMemo(() => parseInput(text, projects.map((p) => p.name)), [text, projects]);
  if (!open) return null;
  const close = () => setUI({ quickAddOpen: false });

  const submit = (keepOpen = false) => {
    if (!text.trim()) return;
    const s = useData.getState();
    if (kind === 'task') {
      let projectId: string | null = null;
      if (parsed.project) {
        const p = projects.find((x) => x.name.toLowerCase() === parsed.project!.toLowerCase()) || s.addProject({ name: parsed.project });
        projectId = p.id;
      }
      s.addTask({
        title: parsed.title || text,
        due: parsed.due,
        dueTime: parsed.dueTime,
        priority: parsed.priority,
        tags: parsed.tags,
        projectId,
        estimate: parsed.estimate,
        recurrence: parsed.recurrence,
      });
      toast(`Task added${parsed.due ? ` · ${relativeDay(parsed.due)}` : ''}`, { kind: 'success' });
    } else if (kind === 'event') {
      const start = parsed.dueTime || '09:00';
      s.addEvent({
        title: parsed.title || text,
        date: parsed.due || today(),
        start,
        end: minToTime(Math.min(timeToMin(start) + (parsed.estimate || 60), 23 * 60 + 59)),
      });
      toast('Event scheduled', { kind: 'success' });
    } else {
      const n = s.addNote({ title: text.trim(), content: `# ${text.trim()}\n\n` });
      setUI({ selectedNoteId: n.id });
      useUI.getState().navigate('notes');
      close();
      return;
    }
    setText('');
    if (!keepOpen) close();
  };

  const current = KINDS.find((k) => k.k === kind)!;

  return createPortal(
    <div className="overlay top" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="quickadd">
        <div className="qa-tabs">
          {KINDS.map((k) => (
            <button key={k.k} className={cx('qa-tab', kind === k.k && 'active')} onClick={() => setKind(k.k)}>
              <Icon name={k.icon} size={14} /> {k.label}
            </button>
          ))}
          <span className="small muted" style={{ marginLeft: 'auto' }}>
            <Kbd>Tab</Kbd> to switch
          </span>
        </div>
        <div className="qa-input-row">
          <Icon name="plus" />
          <input
            ref={ref}
            value={text}
            placeholder={current.ph}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') close();
              if (e.key === 'Enter') submit(e.shiftKey);
              if (e.key === 'Tab') {
                e.preventDefault();
                const i = KINDS.findIndex((k) => k.k === kind);
                setKind(KINDS[(i + (e.shiftKey ? 2 : 1)) % 3].k);
              }
            }}
          />
        </div>
        {kind !== 'note' && text && (
          <div className="qa-preview">
            <span className="qa-title">{parsed.title || <em className="muted">untitled</em>}</span>
            {parsed.chips.map((c, i) => (
              <span key={i} className={cx('chip', `chip-${c.kind}`)}>
                {c.kind === 'date' && parsed.due ? `${relativeDay(parsed.due)} ${parsed.due !== today() ? `(${fmtDate(parsed.due)})` : ''}${parsed.dueTime ? ' · ' + fmtTime(parsed.dueTime) : ''}` : c.label}
              </span>
            ))}
          </div>
        )}
        <div className="qa-help small muted">
          <span>
            <b>Syntax:</b> tomorrow · fri · in 3 days · jan 5 · 5pm · !high/p1 · #tag · +project · ~30m · every week
          </span>
          <span>
            <Kbd>Enter</Kbd> save · <Kbd>Shift+Enter</Kbd> save & add another
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
