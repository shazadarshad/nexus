import { useState } from 'react';
import { useData, getData } from '../store/data';
import { toast } from '../store/ui';
import { Topbar } from '../components/Shell';
import { Icon } from '../components/Icon';
import { Empty, Modal, Progress } from '../components/ui';
import { Ring } from '../components/Charts';
import { Field } from '../components/TaskParts';
import { goalProgress } from '../lib/analytics';
import { diffDays, fmtDate, fmtMinutes, today } from '../lib/date';
import { cx } from '../lib/id';
import type { Goal } from '../types';

const COLORS = ['#7c5cff', '#00d4ff', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];

export default function Goals() {
  const goals = useData((s) => s.goals);
  useData((s) => s.tasks);
  useData((s) => s.sessions);
  const projects = useData((s) => s.projects);
  const [edit, setEdit] = useState<Goal | 'new' | null>(null);
  const data = getData();

  return (
    <div className="page">
      <Topbar
        title="Goals"
        subtitle="Long-term outcomes, tracked automatically from your tasks and focus"
        actions={
          <button className="btn sm" onClick={() => setEdit('new')}>
            <Icon name="plus" size={15} /> New goal
          </button>
        }
      />
      {goals.length === 0 ? (
        <Empty icon="goals" title="Set your first goal" hint="Link a goal to a project or focus time and Nexus tracks progress for you." action={<button className="btn primary" onClick={() => setEdit('new')}>Create goal</button>} />
      ) : (
        <div className="goal-grid">
          {goals.map((g) => {
            const p = goalProgress(g, data);
            const daysLeft = g.deadline ? diffDays(g.deadline, today()) : null;
            const elapsed = g.deadline ? Math.min(1, (Date.now() - g.createdAt) / (new Date(g.deadline).getTime() - g.createdAt)) : null;
            const onTrack = elapsed === null || p.pct >= elapsed - 0.05;
            const proj = projects.find((x) => x.id === g.projectId);
            return (
              <div key={g.id} className="card goal-card" style={{ ['--c' as string]: g.color }}>
                <div className="row between">
                  <span className={cx('chip tiny', onTrack ? 'ok' : 'warn')}>{p.pct >= 1 ? '🎉 Achieved' : onTrack ? 'On track' : 'Behind'}</span>
                  <button className="icon-btn" onClick={() => setEdit(g)} aria-label="Edit">
                    <Icon name="edit" size={15} />
                  </button>
                </div>
                <div className="goal-body">
                  <Ring value={p.pct} size={96} thickness={9} color={g.color}>
                    <strong>{Math.round(p.pct * 100)}%</strong>
                  </Ring>
                  <div className="flex-1">
                    <h3>{g.title}</h3>
                    {g.description && <p className="small muted">{g.description}</p>}
                    <div className="small">
                      {g.metric === 'focus' ? `${fmtMinutes(p.value)} of ${fmtMinutes(p.target)}` : `${p.value} of ${p.target} ${g.metric === 'tasks' ? 'tasks' : ''}`}
                    </div>
                  </div>
                </div>
                {elapsed !== null && (
                  <div className="small muted">
                    <div className="row between">
                      <span>Time elapsed</span>
                      <span>{daysLeft! >= 0 ? `${daysLeft} days left · ${fmtDate(g.deadline!)}` : `ended ${fmtDate(g.deadline!)}`}</span>
                    </div>
                    <Progress value={elapsed} height={4} color="var(--muted)" />
                  </div>
                )}
                <div className="row gap-s small muted">
                  <span className="chip tiny">{g.metric === 'tasks' ? '☑ Task-based' : g.metric === 'focus' ? '⏱ Focus-based' : '✎ Manual'}</span>
                  {proj && (
                    <span className="project-pill tiny" style={{ ['--c' as string]: proj.color }}>
                      {proj.icon} {proj.name}
                    </span>
                  )}
                </div>
                {g.metric === 'manual' && (
                  <div className="row gap-s">
                    <button className="btn sm" onClick={() => useData.getState().updateGoal(g.id, { manualProgress: Math.max(0, g.manualProgress - 1) })}>
                      −1
                    </button>
                    <button className="btn sm primary" onClick={() => { useData.getState().updateGoal(g.id, { manualProgress: g.manualProgress + 1 }); if (g.manualProgress + 1 === g.target) toast('🎉 Goal achieved!', { kind: 'success' }); }}>
                      +1 progress
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <GoalModal goal={edit} onClose={() => setEdit(null)} />
    </div>
  );
}

function GoalModal({ goal, onClose }: { goal: Goal | 'new' | null; onClose: () => void }) {
  const projects = useData((s) => s.projects);
  const g = goal && goal !== 'new' ? goal : null;
  const init = () => (g ? { ...g } : { title: '', description: '', deadline: null as string | null, metric: 'manual' as Goal['metric'], target: 10, manualProgress: 0, projectId: null as string | null, color: COLORS[0] });
  const [key, setKey] = useState<string>('');
  const [d, setD] = useState(init());
  const cur = goal === 'new' ? 'new' : goal?.id || '';
  if (cur !== key) {
    setKey(cur);
    setD(init());
  }
  const save = () => {
    if (!d.title.trim()) return toast('Name your goal', { kind: 'error' });
    if (d.metric === 'tasks' && !d.projectId) return toast('Pick a project for task-based goals', { kind: 'error' });
    const s = useData.getState();
    if (g) s.updateGoal(g.id, d);
    else s.addGoal(d);
    onClose();
  };
  return (
    <Modal
      open={!!goal}
      onClose={onClose}
      title={g ? 'Edit goal' : 'New goal'}
      width={500}
      footer={
        <>
          {g && (
            <button className="btn ghost danger-text" onClick={() => { useData.getState().deleteGoal(g.id); onClose(); }}>
              <Icon name="trash" size={15} /> Delete
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <input className="title-input" autoFocus placeholder="What do you want to achieve?" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
      <Field label="Why it matters">
        <textarea className="input" rows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
      </Field>
      <Field label="Measure progress by">
        <select className="input" value={d.metric} onChange={(e) => setD({ ...d, metric: e.target.value as Goal['metric'] })}>
          <option value="manual">Manual count</option>
          <option value="tasks">Completed tasks in a project</option>
          <option value="focus">Focus minutes (since goal created)</option>
        </select>
      </Field>
      <div className="grid-2">
        {d.metric === 'tasks' && (
          <Field label="Project">
            <select className="input" value={d.projectId || ''} onChange={(e) => setD({ ...d, projectId: e.target.value || null })}>
              <option value="">Select…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon} {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={d.metric === 'focus' ? 'Target (minutes)' : d.metric === 'tasks' ? 'Target (0 = all tasks)' : 'Target'}>
          <input type="number" min={0} className="input" value={d.target} onChange={(e) => setD({ ...d, target: Number(e.target.value) })} />
        </Field>
        <Field label="Deadline">
          <input type="date" className="input" value={d.deadline || ''} onChange={(e) => setD({ ...d, deadline: e.target.value || null })} />
        </Field>
      </div>
      <Field label="Color">
        <div className="row gap-s">
          {COLORS.map((c) => (
            <button key={c} className={cx('swatch', d.color === c && 'active')} style={{ background: c }} onClick={() => setD({ ...d, color: c })} aria-label={c} />
          ))}
        </div>
      </Field>
    </Modal>
  );
}
