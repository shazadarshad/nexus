import { useEffect, useMemo, useState } from 'react';
import { useData } from '../store/data';
import { useUI, toast } from '../store/ui';
import { Topbar } from '../components/Shell';
import { Icon } from '../components/Icon';
import { STATUS_META, TaskRow, Check, useToggleTask } from '../components/TaskParts';
import { Empty, Modal, PriorityFlag, PRIORITY_LABEL, Segmented } from '../components/ui';
import { Field } from '../components/TaskParts';
import type { Priority, Task, TaskStatus } from '../types';
import { addDays, relativeDay, today, fmtMinutes, timeAgo } from '../lib/date';
import { cx, fuzzy } from '../lib/id';
import { parseInput } from '../lib/nlp';

type View = 'list' | 'board' | 'table';
type Group = 'due' | 'project' | 'priority' | 'status' | 'none';
type Sort = 'smart' | 'due' | 'priority' | 'created' | 'title';

const PROJECT_COLORS = ['#7c5cff', '#00d4ff', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#64748b'];

export default function Tasks() {
  const tasks = useData((s) => s.tasks);
  const projects = useData((s) => s.projects);
  const store = useData.getState();
  const [view, setView] = useState<View>(() => (localStorage.getItem('nexus-task-view') as View) || 'list');
  const [group, setGroup] = useState<Group>('due');
  const [sort, setSort] = useState<Sort>('smart');
  const [q, setQ] = useState('');
  const [project, setProject] = useState<string>('all');
  const [prio, setPrio] = useState<number>(-1);
  const [tag, setTag] = useState<string>('');
  const [showDone, setShowDone] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inline, setInline] = useState('');
  const [projModal, setProjModal] = useState(false);

  useEffect(() => localStorage.setItem('nexus-task-view', view), [view]);
  useEffect(() => {
    const h = (e: Event) => setProject((e as CustomEvent).detail);
    window.addEventListener('nexus:filter-project', h);
    return () => window.removeEventListener('nexus:filter-project', h);
  }, []);

  const allTags = useMemo(() => Array.from(new Set(tasks.flatMap((t) => t.tags))).sort(), [tasks]);

  const filtered = useMemo(() => {
    let r = tasks.filter((t) => {
      if (project !== 'all' && (project === 'none' ? t.projectId : t.projectId !== project)) return false;
      if (prio >= 0 && t.priority !== prio) return false;
      if (tag && !t.tags.includes(tag)) return false;
      if (!showDone && view !== 'board' && t.status === 'done') return false;
      if (view === 'board' && t.status === 'done' && t.completedAt && Date.now() - t.completedAt > 7 * 864e5) return false;
      return true;
    });
    if (q.trim()) r = r.map((t) => ({ t, s: fuzzy(q, `${t.title} ${t.tags.join(' ')} ${t.description}`) })).filter((x) => x.s > 0).map((x) => x.t);
    const cmp: Record<Sort, (a: Task, b: Task) => number> = {
      smart: (a, b) => Number(a.status === 'done') - Number(b.status === 'done') || (a.due || '9999').localeCompare(b.due || '9999') || b.priority - a.priority || a.order - b.order,
      due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.dueTime || '99').localeCompare(b.dueTime || '99'),
      priority: (a, b) => b.priority - a.priority,
      created: (a, b) => b.createdAt - a.createdAt,
      title: (a, b) => a.title.localeCompare(b.title),
    };
    return [...r].sort(cmp[sort]);
  }, [tasks, project, prio, tag, showDone, q, sort, view]);

  const groups = useMemo(() => {
    const t = today();
    const g: { key: string; label: string; color?: string; items: Task[] }[] = [];
    const add = (key: string, label: string, items: Task[], color?: string) => items.length && g.push({ key, label, items, color });
    if (group === 'none') add('all', 'All tasks', filtered);
    else if (group === 'due') {
      const open = filtered.filter((x) => x.status !== 'done');
      add('overdue', 'Overdue', open.filter((x) => x.due && x.due < t), '#ef4444');
      add('today', 'Today', open.filter((x) => x.due === t), 'var(--accent)');
      add('tomorrow', 'Tomorrow', open.filter((x) => x.due === addDays(t, 1)));
      add('week', 'Next 7 days', open.filter((x) => x.due && x.due > addDays(t, 1) && x.due <= addDays(t, 7)));
      add('later', 'Later', open.filter((x) => x.due && x.due > addDays(t, 7)));
      add('nodate', 'No date', open.filter((x) => !x.due));
      add('done', 'Completed', filtered.filter((x) => x.status === 'done'), '#22c55e');
    } else if (group === 'project') {
      projects.forEach((p) => add(p.id, `${p.icon} ${p.name}`, filtered.filter((x) => x.projectId === p.id), p.color));
      add('none', 'No project', filtered.filter((x) => !x.projectId || !projects.some((p) => p.id === x.projectId)));
    } else if (group === 'priority') {
      [4, 3, 2, 1, 0].forEach((p) => add(String(p), PRIORITY_LABEL[p], filtered.filter((x) => x.priority === p)));
    } else {
      (Object.keys(STATUS_META) as TaskStatus[]).forEach((s) => add(s, STATUS_META[s].label, filtered.filter((x) => x.status === s), STATUS_META[s].color));
    }
    return g;
  }, [filtered, group, projects]);

  const toggleSel = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const addInline = () => {
    if (!inline.trim()) return;
    const p = parseInput(inline, projects.map((x) => x.name));
    let projectId = project !== 'all' && project !== 'none' ? project : null;
    if (p.project) projectId = (projects.find((x) => x.name.toLowerCase() === p.project!.toLowerCase()) || store.addProject({ name: p.project })).id;
    store.addTask({ title: p.title || inline, due: p.due, dueTime: p.dueTime, priority: p.priority, tags: p.tags, projectId, estimate: p.estimate, recurrence: p.recurrence });
    setInline('');
  };

  const openCount = tasks.filter((t) => t.status !== 'done').length;
  const activeFilters = (project !== 'all' ? 1 : 0) + (prio >= 0 ? 1 : 0) + (tag ? 1 : 0);

  return (
    <div className="page">
      <Topbar
        title="Tasks"
        subtitle={`${openCount} open · ${tasks.filter((t) => t.completedAt && Date.now() - t.completedAt < 7 * 864e5).length} completed this week`}
        actions={
          <Segmented<View>
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: 'List', icon: 'list' },
              { value: 'board', label: 'Board', icon: 'kanban' },
              { value: 'table', label: 'Table', icon: 'grid' },
            ]}
          />
        }
      />

      <div className="toolbar">
        <div className="search-box">
          <Icon name="search" size={15} />
          <input placeholder="Filter tasks…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button className="icon-btn tiny" onClick={() => setQ('')}>
              <Icon name="x" size={13} />
            </button>
          )}
        </div>
        <select className="input sm" value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="all">All projects</option>
          <option value="none">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.icon} {p.name}
            </option>
          ))}
        </select>
        <select className="input sm" value={prio} onChange={(e) => setPrio(Number(e.target.value))}>
          <option value={-1}>Any priority</option>
          {[4, 3, 2, 1, 0].map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <select className="input sm" value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">Any tag</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
        {view !== 'board' && (
          <>
            <select className="input sm" value={group} onChange={(e) => setGroup(e.target.value as Group)} title="Group by">
              <option value="due">Group: Due date</option>
              <option value="project">Group: Project</option>
              <option value="priority">Group: Priority</option>
              <option value="status">Group: Status</option>
              <option value="none">No grouping</option>
            </select>
            <select className="input sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)} title="Sort">
              <option value="smart">Sort: Smart</option>
              <option value="due">Sort: Due</option>
              <option value="priority">Sort: Priority</option>
              <option value="created">Sort: Newest</option>
              <option value="title">Sort: A–Z</option>
            </select>
            <label className="toggle-label small">
              <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done
            </label>
          </>
        )}
        {activeFilters > 0 && (
          <button className="link-btn small" onClick={() => { setProject('all'); setPrio(-1); setTag(''); }}>
            Clear filters ({activeFilters})
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button className="btn ghost sm" onClick={() => setProjModal(true)}>
          <Icon name="folder" size={15} /> Projects
        </button>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <strong>{selected.size} selected</strong>
          <button className="btn sm" onClick={() => { store.bulkUpdateTasks([...selected], { status: 'done' }); setSelected(new Set()); }}>
            <Icon name="check" size={14} /> Complete
          </button>
          <button className="btn sm" onClick={() => { store.bulkUpdateTasks([...selected], { due: today() }); setSelected(new Set()); }}>
            Today
          </button>
          <button className="btn sm" onClick={() => { store.bulkUpdateTasks([...selected], { due: addDays(today(), 1) }); setSelected(new Set()); }}>
            Tomorrow
          </button>
          <select className="input sm" value="" onChange={(e) => { store.bulkUpdateTasks([...selected], { priority: Number(e.target.value) as Priority }); setSelected(new Set()); }}>
            <option value="" disabled>
              Priority…
            </option>
            {[4, 3, 2, 1, 0].map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
          <select className="input sm" value="" onChange={(e) => { store.bulkUpdateTasks([...selected], { projectId: e.target.value || null }); setSelected(new Set()); }}>
            <option value="" disabled>
              Move to…
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="btn sm danger" onClick={() => { const n = selected.size; store.bulkDeleteTasks([...selected]); setSelected(new Set()); toast(`Deleted ${n} tasks`); }}>
            <Icon name="trash" size={14} /> Delete
          </button>
          <button className="link-btn small" onClick={() => setSelected(new Set())}>
            Cancel
          </button>
        </div>
      )}

      {view !== 'board' && (
        <div className="inline-add">
          <Icon name="plus" size={16} />
          <input value={inline} onChange={(e) => setInline(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addInline()} placeholder='Add a task… try "Email Sam friday 3pm !high #work"' />
          {inline && <span className="small muted">↵</span>}
        </div>
      )}

      {view === 'list' && (
        <div className="task-groups">
          {groups.length === 0 && <Empty icon="tasks" title="No tasks match" hint="Try adjusting filters or add a new task." />}
          {groups.map((g) => (
            <TaskGroup key={g.key} label={g.label} color={g.color} items={g.items} selected={selected} onSelect={toggleSel} />
          ))}
        </div>
      )}

      {view === 'board' && <Board tasks={filtered} />}
      {view === 'table' && <TaskTable tasks={groups.flatMap((g) => g.items)} selected={selected} onSelect={toggleSel} onSelectAll={(ids) => setSelected(new Set(ids))} />}

      <ProjectsModal open={projModal} onClose={() => setProjModal(false)} />
    </div>
  );
}

function TaskGroup({ label, color, items, selected, onSelect }: { label: string; color?: string; items: Task[]; selected: Set<string>; onSelect: (id: string) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const est = items.reduce((a, t) => a + (t.estimate || 0), 0);
  return (
    <div className="task-group">
      <button className="group-head" onClick={() => setCollapsed(!collapsed)}>
        <Icon name="chevronDown" size={14} style={{ transform: collapsed ? 'rotate(-90deg)' : undefined, transition: 'transform .15s' }} />
        <span style={{ color }}>{label}</span>
        <span className="count">{items.length}</span>
        {est > 0 && <span className="small muted">· {fmtMinutes(est)} est.</span>}
      </button>
      {!collapsed && (
        <div className="group-body">
          {items.map((t) => (
            <TaskRow key={t.id} task={t} selected={selected.has(t.id)} onSelect={() => onSelect(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Board({ tasks }: { tasks: Task[] }) {
  const move = useData((s) => s.moveTask);
  const projects = useData((s) => s.projects);
  const setUI = useUI((s) => s.set);
  const toggle = useToggleTask();
  const [over, setOver] = useState<{ col: TaskStatus; before: string | null } | null>(null);
  const cols = Object.keys(STATUS_META) as TaskStatus[];
  return (
    <div className="board">
      {cols.map((c) => {
        const items = tasks.filter((t) => t.status === c).sort((a, b) => a.order - b.order);
        const wip = c === 'doing' && items.length > 3;
        return (
          <div
            key={c}
            className={cx('board-col', over?.col === c && 'drag-over')}
            onDragOver={(e) => {
              e.preventDefault();
              if (over?.col !== c || over.before !== null) {
                if ((e.target as HTMLElement).closest('.board-card') === null) setOver({ col: c, before: null });
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/task');
              if (id) move(id, c, over?.col === c ? over.before : null);
              setOver(null);
            }}
          >
            <div className="board-col-head">
              <span className="dot" style={{ background: STATUS_META[c].color }} />
              <strong>{STATUS_META[c].label}</strong>
              <span className="count">{items.length}</span>
              {wip && <span className="chip tiny warn" title="WIP limit is 3">WIP!</span>}
              <button className="icon-btn tiny" style={{ marginLeft: 'auto' }} onClick={() => setUI({ taskModal: { id: 'new', defaults: { status: c } } })} aria-label="Add">
                <Icon name="plus" size={14} />
              </button>
            </div>
            <div className="board-col-body">
              {items.map((t) => {
                const p = projects.find((x) => x.id === t.projectId);
                const subDone = t.subtasks.filter((s) => s.done).length;
                return (
                  <div key={t.id}>
                    {over?.col === c && over.before === t.id && <div className="drop-indicator" />}
                    <div
                      className={cx('board-card', t.status === 'done' && 'done')}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/task', t.id);
                        e.dataTransfer.effectAllowed = 'move';
                        (e.currentTarget as HTMLElement).classList.add('dragging');
                      }}
                      onDragEnd={(e) => (e.currentTarget as HTMLElement).classList.remove('dragging')}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        const after = e.clientY > r.top + r.height / 2;
                        const idx = items.indexOf(t);
                        setOver({ col: c, before: after ? items[idx + 1]?.id ?? null : t.id });
                      }}
                      onClick={() => setUI({ taskModal: { id: t.id } })}
                    >
                      <div className="row gap-s" style={{ alignItems: 'flex-start' }}>
                        <Check done={t.status === 'done'} onClick={() => toggle(t)} />
                        <div className="board-title">{t.title}</div>
                        <PriorityFlag p={t.priority} />
                      </div>
                      {t.subtasks.length > 0 && (
                        <div className="mini-progress">
                          <div style={{ width: `${(subDone / t.subtasks.length) * 100}%` }} />
                        </div>
                      )}
                      <div className="board-meta">
                        {p && (
                          <span className="project-pill tiny" style={{ ['--c' as string]: p.color }}>
                            {p.icon} {p.name}
                          </span>
                        )}
                        {t.status === 'done' && t.completedAt ? <span className="meta">✓ {timeAgo(t.completedAt)}</span> : t.due && <span className={cx('meta', t.due < today() && 'danger')}>{relativeDay(t.due)}</span>}
                        {t.subtasks.length > 0 && (
                          <span className="meta">
                            ☑ {subDone}/{t.subtasks.length}
                          </span>
                        )}
                        {t.estimate && <span className="meta">⏱ {fmtMinutes(t.estimate)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {over?.col === c && over.before === null && <div className="drop-indicator" />}
              {items.length === 0 && <div className="board-empty small muted">Drop tasks here</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskTable({ tasks, selected, onSelect, onSelectAll }: { tasks: Task[]; selected: Set<string>; onSelect: (id: string) => void; onSelectAll: (ids: string[]) => void }) {
  const projects = useData((s) => s.projects);
  const update = useData((s) => s.updateTask);
  const setUI = useUI((s) => s.set);
  const toggle = useToggleTask();
  const all = tasks.length > 0 && tasks.every((t) => selected.has(t.id));
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}>
              <input type="checkbox" checked={all} onChange={() => onSelectAll(all ? [] : tasks.map((t) => t.id))} aria-label="Select all" />
            </th>
            <th style={{ width: 32 }} />
            <th>Title</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Project</th>
            <th>Due</th>
            <th>Estimate</th>
            <th>Tags</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id} className={cx(selected.has(t.id) && 'selected', t.status === 'done' && 'done')}>
              <td>
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => onSelect(t.id)} aria-label="Select" />
              </td>
              <td>
                <Check done={t.status === 'done'} onClick={() => toggle(t)} />
              </td>
              <td className="clickable strong" onClick={() => setUI({ taskModal: { id: t.id } })}>
                {t.title}
              </td>
              <td>
                <select className="input xs" value={t.status} onChange={(e) => update(t.id, { status: e.target.value as TaskStatus, completedAt: e.target.value === 'done' ? Date.now() : null })}>
                  {Object.entries(STATUS_META).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select className="input xs" value={t.priority} onChange={(e) => update(t.id, { priority: Number(e.target.value) as Priority })}>
                  {[0, 1, 2, 3, 4].map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <select className="input xs" value={t.projectId || ''} onChange={(e) => update(t.id, { projectId: e.target.value || null })}>
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input type="date" className="input xs" value={t.due || ''} onChange={(e) => update(t.id, { due: e.target.value || null })} />
              </td>
              <td className="muted">{t.estimate ? fmtMinutes(t.estimate) : '—'}</td>
              <td>
                {t.tags.map((x) => (
                  <span key={x} className="chip tiny">
                    #{x}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && <Empty icon="tasks" title="No tasks" />}
    </div>
  );
}

function ProjectsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const projects = useData((s) => s.projects);
  const tasks = useData((s) => s.tasks);
  const { addProject, updateProject, deleteProject } = useData.getState();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📁');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  return (
    <Modal open={open} onClose={onClose} title="Projects" width={560}>
      <div className="project-list">
        {projects.map((p) => {
          const ts = tasks.filter((t) => t.projectId === p.id);
          const done = ts.filter((t) => t.status === 'done').length;
          return (
            <div key={p.id} className="project-item">
              <input className="bare emoji-input" value={p.icon} onChange={(e) => updateProject(p.id, { icon: e.target.value.slice(-2) || '📁' })} aria-label="Icon" />
              <input className="bare strong" value={p.name} onChange={(e) => updateProject(p.id, { name: e.target.value })} />
              <span className="small muted nowrap">
                {done}/{ts.length} done
              </span>
              <div className="row gap-xs">
                {PROJECT_COLORS.slice(0, 6).map((c) => (
                  <button key={c} className={cx('swatch sm', p.color === c && 'active')} style={{ background: c }} onClick={() => updateProject(p.id, { color: c })} aria-label={c} />
                ))}
              </div>
              <button className="icon-btn" onClick={() => { deleteProject(p.id); toast(`Deleted project ${p.name}`); }} aria-label="Delete">
                <Icon name="trash" size={15} />
              </button>
            </div>
          );
        })}
      </div>
      <div className="sub-head">New project</div>
      <div className="row gap-s">
        <input className="input" style={{ width: 56, textAlign: 'center' }} value={icon} onChange={(e) => setIcon(e.target.value)} aria-label="Icon" />
        <input className="input" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { addProject({ name: name.trim(), icon, color }); setName(''); } }} />
        <button className="btn primary" disabled={!name.trim()} onClick={() => { addProject({ name: name.trim(), icon, color }); setName(''); }}>
          Add
        </button>
      </div>
      <Field label="Color">
        <div className="row gap-s">
          {PROJECT_COLORS.map((c) => (
            <button key={c} className={cx('swatch', color === c && 'active')} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>
      </Field>
    </Modal>
  );
}
