import { useEffect, useState } from 'react';
import { useData } from '../store/data';
import { useUI, toast } from '../store/ui';
import type { CalEvent } from '../types';
import { Modal } from './ui';
import { Field } from './TaskParts';
import { Icon } from './Icon';
import { today } from '../lib/date';
import { cx } from '../lib/id';

export const EVENT_COLORS = ['#7c5cff', '#00d4ff', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#64748b'];

export function EventModal() {
  const modal = useUI((s) => s.eventModal);
  const setUI = useUI((s) => s.set);
  const events = useData((s) => s.events);
  const existing = modal && modal.id !== 'new' ? events.find((e) => e.id === modal.id) : undefined;
  const [d, setD] = useState<Omit<CalEvent, 'id'>>({ title: '', date: today(), start: '09:00', end: '10:00', allDay: false, color: EVENT_COLORS[1], location: '', notes: '' });

  useEffect(() => {
    if (!modal) return;
    if (existing) setD({ ...existing });
    else setD({ title: '', date: today(), start: '09:00', end: '10:00', allDay: false, color: EVENT_COLORS[1], location: '', notes: '', ...modal.defaults });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal?.id]);

  if (!modal) return null;
  const close = () => setUI({ eventModal: null });
  const save = () => {
    if (!d.title.trim()) return toast('Event needs a title', { kind: 'error' });
    if (!d.allDay && d.end <= d.start) return toast('End time must be after start', { kind: 'error' });
    const s = useData.getState();
    if (existing) s.updateEvent(existing.id, d);
    else s.addEvent(d);
    toast(existing ? 'Event updated' : 'Event created', { kind: 'success' });
    close();
  };
  const remove = () => {
    if (!existing) return;
    const s = useData.getState();
    const e = s.deleteEvent(existing.id);
    close();
    if (e) toast('Event deleted', { action: { label: 'Undo', run: () => s.restoreEvent(e) } });
  };

  return (
    <Modal
      open
      onClose={close}
      title={existing ? 'Edit event' : 'New event'}
      width={520}
      footer={
        <>
          {existing && (
            <button className="btn ghost danger-text" onClick={remove}>
              <Icon name="trash" size={16} /> Delete
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn ghost" onClick={close}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <input className="title-input" autoFocus placeholder="Event title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} />
      <div className="grid-2">
        <Field label="Date">
          <input type="date" className="input" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
        </Field>
        <Field label="All day">
          <label className="switch">
            <input type="checkbox" checked={d.allDay} onChange={(e) => setD({ ...d, allDay: e.target.checked })} />
            <span />
          </label>
        </Field>
        {!d.allDay && (
          <>
            <Field label="Start">
              <input type="time" className="input" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })} />
            </Field>
            <Field label="End">
              <input type="time" className="input" value={d.end} onChange={(e) => setD({ ...d, end: e.target.value })} />
            </Field>
          </>
        )}
      </div>
      <Field label="Location">
        <input className="input" placeholder="Add location or link" value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} />
      </Field>
      <Field label="Color">
        <div className="row gap-s">
          {EVENT_COLORS.map((c) => (
            <button key={c} className={cx('swatch', d.color === c && 'active')} style={{ background: c }} onClick={() => setD({ ...d, color: c })} aria-label={c} />
          ))}
        </div>
      </Field>
      <Field label="Notes">
        <textarea className="input" rows={3} value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
      </Field>
    </Modal>
  );
}
