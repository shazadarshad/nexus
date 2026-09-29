import { useState, type ReactNode } from 'react';
import type { ISODate } from '../types';
import { addDays, fmtDate, parseISO, today, DAY_SHORT, startOfWeek } from '../lib/date';

type Pt = { date?: ISODate; label?: string; value: number };

export function AreaChart({ data, height = 180, color = 'var(--accent)', format = (v: number) => String(Math.round(v)), secondary }: { data: Pt[]; height?: number; color?: string; format?: (v: number) => string; secondary?: Pt[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = height;
  const pad = { t: 12, r: 8, b: 22, l: 8 };
  const max = Math.max(1, ...data.map((d) => d.value), ...(secondary?.map((d) => d.value) || []));
  const x = (i: number) => pad.l + (i / Math.max(1, data.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = (pts: Pt[]) => {
    if (!pts.length) return '';
    let d = `M${x(0)},${y(pts[0].value)}`;
    for (let i = 1; i < pts.length; i++) {
      const x0 = x(i - 1), y0 = y(pts[i - 1].value), x1 = x(i), y1 = y(pts[i].value);
      const cx = (x0 + x1) / 2;
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    return d;
  };
  const line = path(data);
  const area = `${line} L${x(data.length - 1)},${H - pad.b} L${x(0)},${H - pad.b} Z`;
  const gid = `g${Math.abs(color.split('').reduce((a, c) => a + c.charCodeAt(0), 0))}${data.length}`;
  const labelEvery = Math.ceil(data.length / 7);
  return (
    <div className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.35" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={pad.l} x2={W - pad.r} y1={y(max * g)} y2={y(max * g)} className="grid-line" />
        ))}
        <path d={area} fill={`url(#${gid})`} />
        {secondary && <path d={path(secondary)} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        {data.map((_, i) => (
          <rect key={i} x={x(i) - W / data.length / 2} y={0} width={W / data.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--border-strong)" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="4" fill={color} stroke="var(--surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <div className="chart-x">
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <span key={i} style={{ left: `${(x(i) / W) * 100}%` }}>
              {d.label || (d.date ? fmtDate(d.date) : '')}
            </span>
          ) : null
        )}
      </div>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${(x(hover) / W) * 100}%` }}>
          <div className="muted small">{data[hover].label || (data[hover].date ? fmtDate(data[hover].date!, { weekday: 'short', month: 'short', day: 'numeric' }) : '')}</div>
          <strong>{format(data[hover].value)}</strong>
        </div>
      )}
    </div>
  );
}

export function BarChart({ data, height = 160, color = 'var(--accent)', format = (v: number) => String(Math.round(v)), highlightLast = true }: { data: Pt[]; height?: number; color?: string; format?: (v: number) => string; highlightLast?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="bar-col" title={`${d.label || (d.date ? fmtDate(d.date) : '')}: ${format(d.value)}`}>
          <div className="bar-val small muted">{d.value ? format(d.value) : ''}</div>
          <div className="bar-track">
            <div
              className="bar"
              style={{ height: `${(d.value / max) * 100}%`, background: color, opacity: highlightLast && i !== data.length - 1 ? 0.55 : 1 }}
            />
          </div>
          <div className="bar-label small muted">{d.label || (d.date ? DAY_SHORT[parseISO(d.date).getDay()][0] : '')}</div>
        </div>
      ))}
    </div>
  );
}

export function Donut({ segments, size = 160, thickness = 18, center }: { segments: { label: string; value: number; color: string }[]; size?: number; thickness?: number; center?: ReactNode }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={thickness} />
        {segments.map((s, i) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={hover === i ? thickness + 4 : thickness}
              strokeDasharray={`${Math.max(0, len - 2)} ${C}`}
              strokeDashoffset={-acc}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              style={{ transition: 'stroke-width .15s' }}
            />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="donut-center">
        {hover !== null ? (
          <>
            <div className="small muted">{segments[hover].label}</div>
            <strong>{Math.round((segments[hover].value / total) * 100)}%</strong>
          </>
        ) : (
          center
        )}
      </div>
    </div>
  );
}

export function Ring({ value, size = 120, thickness = 10, color = 'var(--accent)', children, track = 'var(--surface-2)' }: { value: number; size?: number; thickness?: number; color?: string; children?: ReactNode; track?: string }) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function Heatmap({ values, weeks = 26, color = 'var(--accent)', weekStart = 1 }: { values: Record<ISODate, number>; weeks?: number; color?: string; weekStart?: 0 | 1 }) {
  const end = today();
  const start = startOfWeek(addDays(end, -(weeks - 1) * 7), weekStart);
  const max = Math.max(1, ...Object.values(values));
  const cols: ISODate[][] = [];
  let d = start;
  while (d <= end) {
    const col: ISODate[] = [];
    for (let i = 0; i < 7; i++) {
      col.push(d);
      d = addDays(d, 1);
    }
    cols.push(col);
  }
  return (
    <div className="heatmap">
      <div className="heatmap-days small muted">
        {[0, 2, 4, 6].map((i) => (
          <span key={i} style={{ gridRow: i + 1 }}>
            {DAY_SHORT[(i + weekStart) % 7]}
          </span>
        ))}
      </div>
      <div className="heatmap-grid">
        {cols.map((col, ci) => (
          <div key={ci} className="heatmap-col">
            {col.map((day) => {
              const v = values[day] || 0;
              const lvl = v ? Math.min(4, Math.ceil((v / max) * 4)) : 0;
              return (
                <div
                  key={day}
                  className="heat-cell"
                  title={`${fmtDate(day, { weekday: 'short', month: 'short', day: 'numeric' })}: ${v.toFixed(1)} pts`}
                  style={{ background: day > end ? 'transparent' : lvl ? color : undefined, opacity: lvl ? 0.25 + lvl * 0.19 : undefined }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({ values, color = 'var(--accent)', width = 80, height = 24 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * width},${height - (v / max) * (height - 2) - 1}`).join(' ');
  return (
    <svg width={width} height={height} className="sparkline">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
