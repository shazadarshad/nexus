import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { useData } from '../store/data';
import { useUI, toast } from '../store/ui';
import type { Priority, Recurrence, Task, TaskStatus } from '../types';
import { Icon } from './Icon';
import { Modal, PriorityFlag, PRIORITY_COLOR, PRIORITY_LABEL, Progress } from './ui';
import { cx, uid } from '../lib/id';
import { addDays, fmtMinutes, fmtTime, relativeDay, timeAgo, today } from '../lib/date';
import { renderMarkdown } from '../lib/markdown';

export const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  backlog: { label: 'Backlog', color: '#c7c7cc' },
  todo: { label: 'To do', color: '#8e8e93' },
  doing: { label: 'In progress', color: '#f5a623' },
  done: { label: 'Done', color: '#34a853' },
};

export function Check({ done, onClick, color }: { done: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      className={cx('check', done && 'checked')}
      style={{ ['--c' as string]: color || 'var(--accent)' }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={done ? 'Mark incomplete' : 'Mark complete'}
    >
      {done && <Icon name="check" size={12} strokeWidth={3} />}
    </button>
  );
}

export function useToggleTask() {
  const toggle = useData((s) => s.toggleTask);
  return (t: Task) => {
    toggle(t.id);
    if (t.status !== 'done') toast(t.recurrence ? `Done — next “${t.title}” scheduled` : `Completed “${t.title}”`, { kind: 'success', action: { label: 'Undo', run: () => toggle(t.id) } });
  };
}

export function TaskRow({ task, showProject = true, selected, onSelect, compact }: { task: Task; showProject?: boolean; selected?: boolean; onSelect?: (e: MouseEvent) => void; compact?: boolean }) {
  const project = useData((s) => s.projects.find((p) => p.id === task.projectId));
  const open = useUI((s) => s.set);
  const toggle = useToggleTask();
  const done = task.status === 'done';
  const overdue = !done && task.due && task.due < today();
  const subDone = task.subtasks.filter((s) => s.done).length;
  return (
    <div
      className={cx('task-row', done && 'done', selected && 'selected', compact && 'compact')}
      onClick={(e) => (onSelect && (e.metaKey || e.ctrlKey || e.shiftKey) ? onSelect(e) : open({ taskModal: { id: task.id } }))}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/task', task.id)}
    >
      <Check done={done} onClick={() => toggle(task)} color={PRIORITY_COLOR[task.priority]} />
      <div className="task-main">
        <div className="task-title">{task.title}</div>
        {!compact && (
          <div className="task-meta">
            {done && task.completedAt ? (
              <span className="meta">
                <Icon name="check" size={12} />
                Done {timeAgo(task.completedAt)}
              </span>
            ) : task.due && (
              <span className={cx('meta', overdue && 'danger', task.due === today() && 'accent')}>
                <Icon name="calendar" size={12} />
                {relativeDay(task.due)}
                {task.dueTime && ` · ${fmtTime(task.dueTime)}`}
              </span>
            )}
            {task.recurrence && (
              <span className="meta">
                <Icon name="repeat" size={12} />
                {task.recurrence}
              </span>
            )}
            {task.subtasks.length > 0 && (
              <span className="meta">
                <Icon name="check" size={12} />
                {subDone}/{task.subtasks.length}
              </span>
            )}
            {task.estimate && (
              <span className="meta">
                <Icon name="clock" size={12} />
                {task.timeSpent ? `${fmtMinutes(task.timeSpent)} / ` : ''}
                {fmtMinutes(task.estimate)}
              </span>
            )}
            {task.description && (
              <span className="meta">
                <Icon name="notes" size={12} />
              </span>
            )}
            {task.tags.map((t) => (
              <span key={t} className="chip tiny">
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>
      <PriorityFlag p={task.priority} />
      {showProject && project && (
        <span className="project-pill" style={{ ['--c' as string]: project.color }}>
          {project.name}
        </span>
      )}
    </div>
  );
}

const blank = (): Task => ({
  id: '',
  title: '',
  description: '',
  status: 'todo',
  priority: 0,
  due: null,
  dueTime: null,
  tags: [],
  projectId: null,
  subtasks: [],
  estimate: null,
  timeSpent: 0,
  recurrence: null,
  createdAt: Date.now(),
  completedAt: null,
  order: 0,
});

export function TaskModal() {
  const modal = useUI((s) => s.taskModal);
  const setUI = useUI((s) => s.set);
  const tasks = useData((s) => s.tasks);
  const projects = useData((s) => s.projects);
  const notes = useData((s) => s.notes);
  const { addTask, updateTask, deleteTask, restoreTask } = useData.getState();
  const existing = modal && modal.id !== 'new' ? tasks.find((t) => t.id === modal.id) : undefined;
  const [draft, setDraft] = useState<Task>(blank());
  const [newSub, setNewSub] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!modal) return;
    setDraft(existing ? { ...existing } : { ...blank(), ...modal.defaults });
    setPreview(!!existing?.description);
    setNewSub('');
    setTagInput('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal?.id]);

  const close = () => setUI({ taskModal: null });
  const patch = (p: Partial<Task>) => {
    setDraft((d) => ({ ...d, ...p }));
    if (existing) updateTask(existing.id, p);
  };

  const noteTitles = useMemo(() => notes.map((n) => n.title), [notes]);
  if (!modal) return null;

  const save = () => {
    if (!draft.title.trim()) return toast('Give the task a title', { kind: 'error' });
    if (!existing) {
      const { id: _id, ...rest } = draft;
      void _id;
      addTask({ ...rest, title: draft.title.trim() });
      toast('Task created', { kind: 'success' });
    }
    close();
  };

  const remove = () => {
    if (!existing) return close();
    const t = deleteTask(existing.id);
    close();
    if (t) toast(`Deleted “${t.title}”`, { action: { label: 'Undo', run: () => restoreTask(t) } });
  };

  const addSub = () => {
    if (!newSub.trim()) return;
    patch({ subtasks: [...draft.subtasks, { id: uid(), title: newSub.trim(), done: false }] });
    setNewSub('');
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (t && !draft.tags.includes(t)) patch({ tags: [...draft.tags, t] });
    setTagInput('');
  };

  const subPct = draft.subtasks.length ? draft.subtasks.filter((s) => s.done).length / draft.subtasks.length : 0;

  return (
    <Modal
      open
      onClose={close}
      width={760}
      title={existing ? 'Task details' : 'New task'}
      className="task-modal"
      footer={
        <>
          {existing && (
            <button className="btn ghost danger-text" onClick={remove}>
              <Icon name="trash" size={16} /> Delete
            </button>
          )}
          <div style={{ flex: 1 }} />
          {existing && (
            <button
              className="btn ghost"
              onClick={() => {
                close();
                useUI.getState().setTimer({ taskId: existing.id });
                useUI.getState().navigate('focus');
              }}
            >
              <Icon name="focus" size={16} /> Focus on this
            </button>
          )}
          <button className="btn primary" onClick={save}>
            {existing ? 'Done' : 'Create task'}
          </button>
        </>
      }
    >
      <div className="task-edit">
        <div className="task-edit-main">
          <input
            className="title-input"
            placeholder="Task title"
            value={draft.title}
            autoFocus
            onChange={(e) => patch({ title: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && !existing && save()}
          />
          <div className="field-head">
            <label>Description</label>
            <button className="link-btn small" onClick={() => setPreview(!preview)}>
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>
          {preview ? (
            <div
              className="md md-preview-box"
              onClick={() => setPreview(false)}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.description || '*No description*', noteTitles) }}
            />
          ) : (
            <textarea className="input" rows={5} placeholder="Add details… Markdown supported" value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
          )}

          <div className="field-head">
            <label>
              Subtasks {draft.subtasks.length > 0 && <span className="muted">({draft.subtasks.filter((s) => s.done).length}/{draft.subtasks.length})</span>}
            </label>
          </div>
          {draft.subtasks.length > 0 && <Progress value={subPct} color="var(--success)" height={4} />}
          <div className="subtasks">
            {draft.subtasks.map((st, i) => (
              <div key={st.id} className={cx('subtask', st.done && 'done')}>
                <Check done={st.done} onClick={() => patch({ subtasks: draft.subtasks.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x)) })} />
                <input className="bare" value={st.title} onChange={(e) => patch({ subtasks: draft.subtasks.map((x) => (x.id === st.id ? { ...x, title: e.target.value } : x)) })} />
                <button className="icon-btn tiny" disabled={i === 0} onClick={() => { const a = [...draft.subtasks]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; patch({ subtasks: a }); }} aria-label="Move up">
                  <Icon name="arrowUp" size={13} />
                </button>
                <button className="icon-btn tiny" onClick={() => patch({ subtasks: draft.subtasks.filter((x) => x.id !== st.id) })} aria-label="Remove">
                  <Icon name="x" size={13} />
                </button>
              </div>
            ))}
            <div className="subtask add">
              <Icon name="plus" size={14} />
              <input className="bare" placeholder="Add subtask and press Enter" value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} />
            </div>
          </div>
        </div>

        <aside className="task-edit-side">
          <Field label="Status">
            <select className="input" value={draft.status} onChange={(e) => patch({ status: e.target.value as TaskStatus, completedAt: e.target.value === 'done' ? Date.now() : null })}>
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <div className="prio-picker">
              {([0, 1, 2, 3, 4] as Priority[]).map((p) => (
                <button key={p} className={cx('prio-btn', draft.priority === p && 'active')} style={{ ['--c' as string]: PRIORITY_COLOR[p] }} onClick={() => patch({ priority: p })} title={PRIORITY_LABEL[p]}>
                  {p ? <Icon name="flag" size={14} /> : '—'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Project">
            <select className="input" value={draft.projectId || ''} onChange={(e) => patch({ projectId: e.target.value || null })}>
              <option value="">No project</option>
              {projects.filter((p) => !p.archived).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date">
            <div className="row gap-s">
              <input type="date" className="input" value={draft.due || ''} onChange={(e) => patch({ due: e.target.value || null })} />
              <input type="time" className="input" style={{ maxWidth: 110 }} value={draft.dueTime || ''} onChange={(e) => patch({ dueTime: e.target.value || null })} />
            </div>
            <div className="row gap-s wrap" style={{ marginTop: 6 }}>
              {[
                ['Today', 0],
                ['Tomorrow', 1],
                ['+1 week', 7],
              ].map(([l, n]) => (
                <button key={l} className="chip clickable" onClick={() => patch({ due: addDays(today(), n as number) })}>
                  {l}
                </button>
              ))}
              {draft.due && (
                <button className="chip clickable" onClick={() => patch({ due: null, dueTime: null })}>
                  Clear
                </button>
              )}
            </div>
          </Field>
          <Field label="Repeat">
            <select className="input" value={draft.recurrence || ''} onChange={(e) => patch({ recurrence: (e.target.value || null) as Recurrence })}>
              <option value="">Never</option>
              <option value="daily">Every day</option>
              <option value="weekdays">Every weekday</option>
              <option value="weekly">Every week</option>
              <option value="monthly">Every month</option>
            </select>
          </Field>
          <Field label="Estimate (minutes)">
            <input type="number" min={0} step={5} className="input" value={draft.estimate ?? ''} onChange={(e) => patch({ estimate: e.target.value ? Number(e.target.value) : null })} />
            {draft.timeSpent > 0 && <div className="small muted" style={{ marginTop: 4 }}>Tracked: {fmtMinutes(draft.timeSpent)}</div>}
          </Field>
          <Field label="Tags">
            <div className="row gap-s wrap">
              {draft.tags.map((t) => (
                <span key={t} className="chip">
                  #{t}
                  <button className="chip-x" onClick={() => patch({ tags: draft.tags.filter((x) => x !== t) })} aria-label={`Remove ${t}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input className="input" placeholder="Add tag + Enter" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addTag())} style={{ marginTop: 6 }} />
          </Field>
          {existing && <div className="small muted">Created {new Date(existing.createdAt).toLocaleString()}</div>}
        </aside>
      </div>
    </Modal>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}
