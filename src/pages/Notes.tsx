import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../store/data';
import { useUI, toast } from '../store/ui';
import { Topbar } from '../components/Shell';
import { Icon } from '../components/Icon';
import { Empty, Segmented } from '../components/ui';
import { renderMarkdown, toggleTaskLine, extractWikiLinks, extractTags, wordCount, outline } from '../lib/markdown';
import { cx, download, fuzzy } from '../lib/id';
import { timeAgo, today, fmtDate } from '../lib/date';
import type { Note } from '../types';

type Mode = 'edit' | 'split' | 'preview';

const TEMPLATES: { name: string; icon: string; build: () => Partial<Note> }[] = [
  { name: 'Blank', icon: 'notes', build: () => ({ title: 'Untitled', content: '' }) },
  {
    name: 'Daily note',
    icon: 'calendar',
    build: () => ({
      title: `Daily — ${fmtDate(today(), { weekday: 'short', month: 'short', day: 'numeric' })}`,
      folder: 'Daily',
      content: `# ${fmtDate(today(), { weekday: 'long', month: 'long', day: 'numeric' })}\n\n## Top 3 priorities\n- [ ] \n- [ ] \n- [ ] \n\n## Notes\n\n\n## Grateful for\n- \n\n#daily`,
    }),
  },
  {
    name: 'Meeting',
    icon: 'users',
    build: () => ({
      title: 'Meeting notes',
      folder: 'Work',
      content: `# Meeting notes\n**Date:** ${today()}\n**Attendees:** \n\n## Agenda\n1. \n\n## Discussion\n\n\n## Action items\n- [ ] \n\n#meeting`,
    }),
  },
  {
    name: 'Project brief',
    icon: 'flag',
    build: () => ({
      title: 'Project brief',
      folder: 'Work',
      content: `# Project brief\n\n> [!info] Summary\n> One-sentence description of the project.\n\n## Problem\n\n## Goals\n- \n\n## Non-goals\n- \n\n## Milestones\n| Milestone | Date | Owner |\n| --- | --- | --- |\n| Kickoff | ${today()} | Me |\n\n#project`,
    }),
  },
  {
    name: 'Book notes',
    icon: 'book',
    build: () => ({ title: 'Book — ', folder: 'Personal', content: `# Book title\n**Author:** \n**Rating:** 4/5\n\n## Key ideas\n1. \n\n## Quotes\n> \n\n## How I'll apply this\n- \n\n#books` }),
  },
];

export default function Notes() {
  const notes = useData((s) => s.notes);
  const { addNote, updateNote, deleteNote, restoreNote } = useData.getState();
  const selectedId = useUI((s) => s.selectedNoteId);
  const setUI = useUI((s) => s.set);
  const [q, setQ] = useState('');
  const [folder, setFolder] = useState('All');
  const [tag, setTag] = useState('');
  const [mode, setMode] = useState<Mode>(() => (localStorage.getItem('nexus-note-mode') as Mode) || 'split');
  const [showGraph, setShowGraph] = useState(false);
  const [showTpl, setShowTpl] = useState(false);
  const [saved, setSaved] = useState(true);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => localStorage.setItem('nexus-note-mode', mode), [mode]);

  const folders = useMemo(() => ['All', ...Array.from(new Set(notes.map((n) => n.folder))).sort()], [notes]);
  const tags = useMemo(() => Array.from(new Set(notes.flatMap((n) => n.tags))).sort(), [notes]);
  const titles = useMemo(() => notes.map((n) => n.title), [notes]);

  const list = useMemo(() => {
    let r = notes.filter((n) => (folder === 'All' || n.folder === folder) && (!tag || n.tags.includes(tag)));
    if (q.trim()) r = r.map((n) => ({ n, s: fuzzy(q, `${n.title} ${n.content}`) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.n);
    else r = [...r].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
    return r;
  }, [notes, q, folder, tag]);

  const note = notes.find((n) => n.id === selectedId) || list[0];
  useEffect(() => {
    if (note && note.id !== selectedId) setUI({ selectedNoteId: note.id });
  }, [note, selectedId, setUI]);

  const backlinks = useMemo(() => (note ? notes.filter((n) => n.id !== note.id && extractWikiLinks(n.content).some((l) => l.toLowerCase() === note.title.toLowerCase())) : []), [notes, note]);
  const html = useMemo(() => (note ? renderMarkdown(note.content, titles) : ''), [note, titles]);
  const toc = useMemo(() => (note ? outline(note.content) : []), [note]);

  const setContent = (content: string) => {
    if (!note) return;
    setSaved(false);
    updateNote(note.id, { content, tags: extractTags(content) });
    setTimeout(() => setSaved(true), 400);
  };

  const openWiki = (title: string) => {
    const found = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
    if (found) setUI({ selectedNoteId: found.id });
    else {
      const n = addNote({ title, content: `# ${title}\n\n`, folder: note?.folder || 'Inbox' });
      setUI({ selectedNoteId: n.id });
      toast(`Created note “${title}”`, { kind: 'success' });
    }
  };

  const onPreviewClick = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.matches('input[type=checkbox][data-line]')) {
      e.preventDefault();
      setContent(toggleTaskLine(note!.content, Number(el.dataset.line)));
    } else if (el.dataset.wiki) openWiki(el.dataset.wiki);
    else if (el.dataset.tag) setTag(el.dataset.tag.toLowerCase());
  };

  const wrap = (before: string, after = before, placeholder = 'text') => {
    const ta = taRef.current;
    if (!ta || !note) return;
    const { selectionStart: s, selectionEnd: en, value } = ta;
    const sel = value.slice(s, en) || placeholder;
    const next = value.slice(0, s) + before + sel + after + value.slice(en);
    setContent(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };
  const linePrefix = (prefix: string) => {
    const ta = taRef.current;
    if (!ta || !note) return;
    const { selectionStart: s, value } = ta;
    const ls = value.lastIndexOf('\n', s - 1) + 1;
    setContent(value.slice(0, ls) + prefix + value.slice(ls));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(s + prefix.length, s + prefix.length);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'b') (e.preventDefault(), wrap('**'));
    else if (mod && e.key === 'i') (e.preventDefault(), wrap('*'));
    else if (mod && e.key === 'k') (e.preventDefault(), e.stopPropagation(), wrap('[', '](https://)', 'link'));
    else if (mod && e.key === 's') (e.preventDefault(), toast('Saved — Nexus autosaves locally', { kind: 'success' }));
    else if (e.key === 'Tab') {
      e.preventDefault();
      wrap('  ', '', '');
    } else if (e.key === 'Enter') {
      // continue lists
      const ta = e.currentTarget;
      const { selectionStart: s, value } = ta;
      const ls = value.lastIndexOf('\n', s - 1) + 1;
      const line = value.slice(ls, s);
      const m = line.match(/^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. )/);
      if (m) {
        e.preventDefault();
        if (line.trim() === m[2].trim()) {
          setContent(value.slice(0, ls) + value.slice(s));
          requestAnimationFrame(() => ta.setSelectionRange(ls, ls));
          return;
        }
        const bullet = m[3] ? `${Number(m[3]) + 1}. ` : m[2].replace(/\[[xX]\]/, '[ ]');
        const ins = '\n' + m[1] + bullet;
        setContent(value.slice(0, s) + ins + value.slice(s));
        requestAnimationFrame(() => ta.setSelectionRange(s + ins.length, s + ins.length));
      }
    }
  };

  const create = (tpl = TEMPLATES[0]) => {
    const b = tpl.build();
    const n = addNote({ folder: folder === 'All' ? 'Inbox' : folder, ...b, tags: extractTags(b.content || '') });
    setUI({ selectedNoteId: n.id });
    setShowTpl(false);
    setMode((m) => (m === 'preview' ? 'split' : m));
  };

  const remove = () => {
    if (!note) return;
    const n = deleteNote(note.id);
    setUI({ selectedNoteId: null });
    if (n) toast(`Deleted “${n.title}”`, { action: { label: 'Undo', run: () => restoreNote(n) } });
  };

  const words = note ? wordCount(note.content) : 0;

  return (
    <div className="page notes-page">
      <Topbar
        title="Notes"
        subtitle={`${notes.length} notes · ${tags.length} tags`}
        actions={
          <>
            <button className={cx('btn ghost sm', showGraph && 'active')} onClick={() => setShowGraph(!showGraph)}>
              <Icon name="graph" size={15} /> Graph
            </button>
            <div className="dropdown">
              <button className="btn sm" onClick={() => setShowTpl(!showTpl)}>
                <Icon name="plus" size={15} /> New note <Icon name="chevronDown" size={13} />
              </button>
              {showTpl && (
                <div className="dropdown-menu" onMouseLeave={() => setShowTpl(false)}>
                  {TEMPLATES.map((t) => (
                    <button key={t.name} onClick={() => create(t)}>
                      <Icon name={t.icon} size={15} /> {t.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        }
      />
      {showGraph ? (
        <NoteGraph notes={notes} onOpen={(id) => { setUI({ selectedNoteId: id }); setShowGraph(false); }} />
      ) : (
        <div className="notes-layout">
          <aside className="notes-list">
            <div className="search-box">
              <Icon name="search" size={15} />
              <input placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="folder-tabs">
              {folders.map((f) => (
                <button key={f} className={cx('chip clickable', folder === f && 'active')} onClick={() => setFolder(f)}>
                  {f}
                </button>
              ))}
            </div>
            {tag && (
              <div className="row gap-s small" style={{ padding: '0 4px 8px' }}>
                Filtered by <span className="chip">#{tag}</span>
                <button className="link-btn small" onClick={() => setTag('')}>
                  clear
                </button>
              </div>
            )}
            <div className="notes-items">
              {list.map((n) => (
                <button key={n.id} className={cx('note-item', note?.id === n.id && 'active')} onClick={() => setUI({ selectedNoteId: n.id })}>
                  <div className="row gap-s">
                    {n.pinned && <Icon name="pin" size={12} className="accent-text" />}
                    <strong className="ellipsis">{n.title || 'Untitled'}</strong>
                  </div>
                  <div className="note-snippet small muted">{n.content.replace(/[#*>`\-[\]|=_~]/g, '').replace(/\s+/g, ' ').slice(0, 90) || 'Empty note'}</div>
                  <div className="row between small muted">
                    <span>{n.folder}</span>
                    <span>{timeAgo(n.updatedAt)}</span>
                  </div>
                </button>
              ))}
              {list.length === 0 && <Empty icon="notes" title="No notes" hint="Create one with the New note button." />}
            </div>
            {tags.length > 0 && (
              <div className="tag-cloud">
                {tags.map((t) => (
                  <button key={t} className={cx('md-tag', tag === t && 'active')} onClick={() => setTag(tag === t ? '' : t)}>
                    #{t}
                  </button>
                ))}
              </div>
            )}
          </aside>

          {note ? (
            <section className="note-editor">
              <div className="note-toolbar">
                <input className="note-title" value={note.title} onChange={(e) => updateNote(note.id, { title: e.target.value })} placeholder="Title" />
                <div className="row gap-s">
                  <input className="input xs" list="folders" value={note.folder} onChange={(e) => updateNote(note.id, { folder: e.target.value || 'Inbox' })} style={{ width: 110 }} title="Folder" />
                  <datalist id="folders">
                    {folders.slice(1).map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                  <button className={cx('icon-btn', note.pinned && 'active')} onClick={() => updateNote(note.id, { pinned: !note.pinned })} title="Pin">
                    <Icon name="pin" size={16} />
                  </button>
                  <button className="icon-btn" onClick={() => download(`${note.title || 'note'}.md`, note.content, 'text/markdown')} title="Export Markdown">
                    <Icon name="download" size={16} />
                  </button>
                  <button className="icon-btn" onClick={remove} title="Delete">
                    <Icon name="trash" size={16} />
                  </button>
                  <Segmented<Mode>
                    value={mode}
                    onChange={setMode}
                    options={[
                      { value: 'edit', label: '', icon: 'edit' },
                      { value: 'split', label: '', icon: 'columns' },
                      { value: 'preview', label: '', icon: 'eye' },
                    ]}
                  />
                </div>
              </div>
              {mode !== 'preview' && (
                <div className="fmt-bar">
                  <button onClick={() => linePrefix('# ')} title="Heading">H1</button>
                  <button onClick={() => linePrefix('## ')} title="Heading 2">H2</button>
                  <button onClick={() => wrap('**')} title="Bold (⌘B)"><b>B</b></button>
                  <button onClick={() => wrap('*')} title="Italic (⌘I)"><i>I</i></button>
                  <button onClick={() => wrap('~~')} title="Strikethrough"><s>S</s></button>
                  <button onClick={() => wrap('==')} title="Highlight"><mark>H</mark></button>
                  <button onClick={() => wrap('`')} title="Code">{'</>'}</button>
                  <span className="sep" />
                  <button onClick={() => linePrefix('- ')} title="Bullet list">•</button>
                  <button onClick={() => linePrefix('1. ')} title="Numbered list">1.</button>
                  <button onClick={() => linePrefix('- [ ] ')} title="Checklist"><Icon name="checkSquare" size={14} /></button>
                  <button onClick={() => linePrefix('> ')} title="Quote"><Icon name="quote" size={14} /></button>
                  <span className="sep" />
                  <button onClick={() => wrap('[', '](https://)', 'link')} title="Link (⌘K)"><Icon name="link" size={14} /></button>
                  <button onClick={() => wrap('[[', ']]', 'Note title')} title="Wiki link">[[ ]]</button>
                  <button onClick={() => wrap('\n```\n', '\n```\n', 'code')} title="Code block">{'{ }'}</button>
                  <button onClick={() => wrap('\n| Col 1 | Col 2 |\n| --- | --- |\n| ', ' |  |\n', 'cell')} title="Table">▦</button>
                  <button onClick={() => wrap('\n> [!tip] ', '\n> \n', 'Title')} title="Callout"><Icon name="info" size={14} /></button>
                </div>
              )}
              <div className={cx('note-body', `mode-${mode}`)}>
                {mode !== 'preview' && (
                  <textarea ref={taRef} className="note-textarea" value={note.content} onChange={(e) => setContent(e.target.value)} onKeyDown={onKeyDown} placeholder="Start writing… Markdown, [[links]], #tags and - [ ] checklists supported." spellCheck />
                )}
                {mode !== 'edit' && (
                  <div className="note-preview">
                    <div className="md" onClick={onPreviewClick} dangerouslySetInnerHTML={{ __html: html || '<p class="muted">Nothing to preview</p>' }} />
                    {backlinks.length > 0 && (
                      <div className="backlinks">
                        <div className="sub-head">
                          <Icon name="link" size={14} /> {backlinks.length} backlink{backlinks.length > 1 ? 's' : ''}
                        </div>
                        {backlinks.map((b) => (
                          <button key={b.id} className="backlink" onClick={() => setUI({ selectedNoteId: b.id })}>
                            <strong>{b.title}</strong>
                            <span className="small muted">{b.folder}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="note-status small muted">
                <span>{words} words</span>
                <span>{note.content.length} chars</span>
                <span>{Math.max(1, Math.round(words / 220))} min read</span>
                {toc.length > 0 && (
                  <select className="input xs" value="" onChange={(e) => document.getElementById(e.target.value)?.scrollIntoView({ behavior: 'smooth' })}>
                    <option value="">Outline ({toc.length})</option>
                    {toc.map((h, i) => (
                      <option key={i} value={h.id}>
                        {'\u00a0'.repeat((h.level - 1) * 3)}
                        {h.text}
                      </option>
                    ))}
                  </select>
                )}
                <span style={{ marginLeft: 'auto' }}>{saved ? `Saved · edited ${timeAgo(note.updatedAt)}` : 'Saving…'}</span>
              </div>
            </section>
          ) : (
            <section className="note-editor">
              <Empty icon="notes" title="No note selected" hint="Pick a note or create a new one." action={<button className="btn primary" onClick={() => create()}>New note</button>} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/** Simple force-directed graph of wiki links between notes. */
function NoteGraph({ notes, onOpen }: { notes: Note[]; onOpen: (id: string) => void }) {
  const W = 900;
  const H = 560;
  const { nodes, edges } = useMemo(() => {
    const byTitle = new Map(notes.map((n) => [n.title.toLowerCase(), n.id]));
    const edges: [string, string][] = [];
    notes.forEach((n) => extractWikiLinks(n.content).forEach((l) => {
      const to = byTitle.get(l.toLowerCase());
      if (to && to !== n.id) edges.push([n.id, to]);
    }));
    const pos = new Map(notes.map((n, i) => {
      const a = (i / Math.max(1, notes.length)) * Math.PI * 2;
      return [n.id, { x: W / 2 + Math.cos(a) * 200, y: H / 2 + Math.sin(a) * 160, vx: 0, vy: 0 }];
    }));
    for (let it = 0; it < 300; it++) {
      const arr = [...pos.values()];
      for (let i = 0; i < arr.length; i++)
        for (let j = i + 1; j < arr.length; j++) {
          const a = arr[i], b = arr[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = Math.max(100, dx * dx + dy * dy);
          const f = 6000 / d2;
          const d = Math.sqrt(d2);
          a.vx += (dx / d) * f; a.vy += (dy / d) * f;
          b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
        }
      edges.forEach(([s, t]) => {
        const a = pos.get(s)!, b = pos.get(t)!;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 140) * 0.02;
        a.vx += (dx / d) * f; a.vy += (dy / d) * f;
        b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
      });
      arr.forEach((p) => {
        p.vx += (W / 2 - p.x) * 0.005; p.vy += (H / 2 - p.y) * 0.005;
        p.x = Math.max(60, Math.min(W - 60, p.x + p.vx)); p.y = Math.max(30, Math.min(H - 30, p.y + p.vy));
        p.vx *= 0.6; p.vy *= 0.6;
      });
    }
    const deg = new Map<string, number>();
    edges.forEach(([s, t]) => { deg.set(s, (deg.get(s) || 0) + 1); deg.set(t, (deg.get(t) || 0) + 1); });
    return { nodes: notes.map((n) => ({ n, ...pos.get(n.id)!, deg: deg.get(n.id) || 0 })), edges };
  }, [notes]);
  const [hover, setHover] = useState<string | null>(null);
  const P = new Map(nodes.map((x) => [x.n.id, x]));
  return (
    <div className="card graph-card">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: '70vh' }}>
        {edges.map(([s, t], i) => {
          const a = P.get(s)!, b = P.get(t)!;
          const hl = hover === s || hover === t;
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hl ? 'var(--accent)' : 'var(--border-strong)'} strokeWidth={hl ? 2 : 1} />;
        })}
        {nodes.map((x) => (
          <g key={x.n.id} transform={`translate(${x.x},${x.y})`} style={{ cursor: 'pointer' }} onClick={() => onOpen(x.n.id)} onMouseEnter={() => setHover(x.n.id)} onMouseLeave={() => setHover(null)}>
            <circle r={7 + x.deg * 3} fill={hover === x.n.id ? 'var(--accent)' : x.deg ? 'color-mix(in srgb, var(--accent) 60%, var(--surface))' : 'var(--muted)'} />
            <text y={-12 - x.deg * 3} textAnchor="middle" className="graph-label">
              {x.n.title}
            </text>
          </g>
        ))}
      </svg>
      <div className="small muted" style={{ padding: 12 }}>
        {nodes.length} notes · {edges.length} links — click a node to open it. Link notes with [[Note title]].
      </div>
    </div>
  );
}
