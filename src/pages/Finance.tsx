import { useEffect, useMemo, useState } from 'react';
import { useData } from '../store/data';
import { toast } from '../store/ui';
import { Topbar } from '../components/Shell';
import { Icon } from '../components/Icon';
import { Donut, BarChart } from '../components/Charts';
import { Empty, Modal, Progress, Segmented } from '../components/ui';
import { Field } from '../components/TaskParts';
import { monthTotals } from '../lib/analytics';
import { addMonths, fmtDate, fmtMonth, today, daysInMonth, parseISO } from '../lib/date';
import { cx, download, fmtMoney, fuzzy } from '../lib/id';
import type { Transaction } from '../types';

const CAT_COLORS: Record<string, string> = {
  Rent: '#1d1d1f',
  Groceries: '#0071e3',
  Utilities: '#5ac8fa',
  Health: '#34a853',
  Shopping: '#af52de',
  Entertainment: '#f5a623',
  Dining: '#ff9500',
  Transport: '#8e8e93',
  Salary: '#0071e3',
  Freelance: '#34a853',
  Other: '#c7c7cc',
};
const EXPENSE_CATS = ['Groceries', 'Dining', 'Transport', 'Entertainment', 'Shopping', 'Utilities', 'Health', 'Rent', 'Other'];
const INCOME_CATS = ['Salary', 'Freelance', 'Gift', 'Investment', 'Other'];
const catColor = (c: string) => CAT_COLORS[c] || `hsl(${[...c].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360} 60% 55%)`;

export default function Finance() {
  const tx = useData((s) => s.transactions);
  const budgets = useData((s) => s.budgets);
  const currency = useData((s) => s.settings.currency);
  const { deleteTransaction, setBudget } = useData.getState();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | 'expense' | 'income'>('all');
  const [edit, setEdit] = useState<Transaction | 'new' | null>(null);
  const [budgetEdit, setBudgetEdit] = useState(false);
  const money = (n: number) => fmtMoney(n, currency);

  useEffect(() => {
    const h = () => setEdit('new');
    window.addEventListener('nexus:add-tx', h);
    return () => window.removeEventListener('nexus:add-tx', h);
  }, []);

  const totals = useMemo(() => monthTotals(tx, month), [tx, month]);
  const prev = useMemo(() => monthTotals(tx, addMonths(month + '-01', -1).slice(0, 7)), [tx, month]);
  const six = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const m = addMonths(month + '-01', i - 5).slice(0, 7);
        const t = monthTotals(tx, m);
        return { m, label: fmtMonth(m + '-01').slice(0, 3), income: t.income, expense: t.expense };
      }),
    [tx, month]
  );

  const list = useMemo(() => {
    let r = tx.filter((t) => t.date.startsWith(month) && (type === 'all' || (type === 'expense' ? t.amount < 0 : t.amount > 0)));
    if (q) r = r.filter((t) => fuzzy(q, `${t.category} ${t.note} ${t.account}`) > 0);
    return r.sort((a, b) => b.date.localeCompare(a.date));
  }, [tx, month, q, type]);

  const segs = Object.entries(totals.byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: catColor(label) }));
  const savingsRate = totals.income ? (totals.net / totals.income) * 100 : 0;
  const isCurrent = month === today().slice(0, 7);
  const dayOfMonth = isCurrent ? parseISO(today()).getDate() : daysInMonth(month + '-01');
  const forecast = isCurrent ? (totals.expense / dayOfMonth) * daysInMonth(month + '-01') : totals.expense;
  const delta = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0);

  const exportCsv = () => {
    const rows = [['Date', 'Amount', 'Category', 'Account', 'Note'], ...tx.map((t) => [t.date, t.amount.toFixed(2), t.category, t.account, `"${t.note.replace(/"/g, '""')}"`])];
    download(`nexus-transactions-${today()}.csv`, rows.map((r) => r.join(',')).join('\n'), 'text/csv');
    toast('CSV exported', { kind: 'success' });
  };

  return (
    <div className="page">
      <Topbar
        title="Finance"
        subtitle="Budgets, cash flow and spending insights"
        actions={
          <>
            <button className="btn ghost sm" onClick={exportCsv}>
              <Icon name="download" size={15} /> CSV
            </button>
            <button className="btn sm" onClick={() => setEdit('new')}>
              <Icon name="plus" size={15} /> Transaction
            </button>
          </>
        }
      />
      <div className="toolbar">
        <button className="icon-btn" onClick={() => setMonth(addMonths(month + '-01', -1).slice(0, 7))} aria-label="Previous month">
          <Icon name="chevronLeft" />
        </button>
        <h2 className="cal-title">{fmtMonth(month + '-01')}</h2>
        <button className="icon-btn" onClick={() => setMonth(addMonths(month + '-01', 1).slice(0, 7))} aria-label="Next month">
          <Icon name="chevronRight" />
        </button>
        {!isCurrent && (
          <button className="btn sm" onClick={() => setMonth(today().slice(0, 7))}>
            This month
          </button>
        )}
      </div>

      <div className="fin-stats">
        <FinStat label="Income" value={money(totals.income)} delta={delta(totals.income, prev.income)} good="up" icon="arrowDown" color="var(--accent)" />
        <FinStat label="Expenses" value={money(totals.expense)} delta={delta(totals.expense, prev.expense)} good="down" icon="arrowUp" color="#ef4444" />
        <FinStat label="Net savings" value={money(totals.net)} delta={delta(totals.net, prev.net)} good="up" icon="wallet" color="var(--accent)" />
        <FinStat label="Savings rate" value={`${savingsRate.toFixed(0)}%`} sub={isCurrent ? `Forecast spend: ${money(forecast)}` : `${totals.count} transactions`} icon="trend" color="var(--accent)" />
      </div>

      <div className="fin-grid">
        <section className="card">
          <div className="card-head">
            <h3>Spending by category</h3>
          </div>
          {segs.length ? (
            <div className="donut-wrap">
              <Donut segments={segs} size={180} center={<><div className="small muted">Spent</div><strong>{money(totals.expense)}</strong></>} />
              <div className="legend">
                {segs.map((s) => (
                  <div key={s.label} className="legend-item small">
                    <span className="dot" style={{ background: s.color }} />
                    <span className="flex-1">{s.label}</span>
                    <span className="muted">{Math.round((s.value / totals.expense) * 100)}%</span>
                    <strong>{money(s.value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Empty icon="wallet" title="No expenses this month" />
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Budgets</h3>
            <button className="link-btn small" onClick={() => setBudgetEdit(true)}>
              Edit
            </button>
          </div>
          {Object.keys(budgets).length === 0 && <Empty icon="wallet" title="No budgets" hint="Set monthly limits per category." />}
          {Object.entries(budgets).map(([cat, limit]) => {
            const spent = totals.byCat[cat] || 0;
            const pct = spent / limit;
            const expected = dayOfMonth / daysInMonth(month + '-01');
            return (
              <div key={cat} className="budget-row">
                <div className="row between small">
                  <span className="row gap-s">
                    <span className="dot" style={{ background: catColor(cat) }} />
                    {cat}
                  </span>
                  <span>
                    <strong className={cx(pct > 1 && 'danger-text')}>{money(spent)}</strong>
                    <span className="muted"> / {money(limit)}</span>
                  </span>
                </div>
                <div className="budget-bar">
                  <Progress value={pct} color={pct > 1 ? 'var(--danger)' : pct > expected + 0.1 ? 'var(--warning)' : catColor(cat)} height={7} />
                  {isCurrent && <span className="budget-marker" style={{ left: `${expected * 100}%` }} title="Expected by today" />}
                </div>
                {pct > 1 && <div className="small danger-text">Over by {money(spent - limit)}</div>}
              </div>
            );
          })}
        </section>

        <section className="card span-2">
          <div className="card-head">
            <h3>Cash flow · 6 months</h3>
            <span className="small muted">
              <span className="dot" style={{ background: 'var(--accent)' }} /> Income <span className="dot" style={{ background: 'var(--surface-3)', marginLeft: 12 }} /> Expenses
            </span>
          </div>
          <div className="cashflow">
            {six.map((m) => {
              const max = Math.max(1, ...six.map((x) => Math.max(x.income, x.expense)));
              return (
                <div key={m.m} className={cx('cf-col', m.m === month && 'active')} onClick={() => setMonth(m.m)}>
                  <div className="cf-bars">
                    <div className="cf-bar" style={{ height: `${(m.income / max) * 100}%`, background: 'var(--accent)' }} title={`Income ${money(m.income)}`} />
                    <div className="cf-bar" style={{ height: `${(m.expense / max) * 100}%`, background: 'var(--surface-3)' }} title={`Expenses ${money(m.expense)}`} />
                  </div>
                  <span className="small muted">{m.label}</span>
                  <span className={cx('small strong', m.income - m.expense < 0 && 'danger-text')}>{money(m.income - m.expense)}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="card span-2">
          <div className="card-head">
            <h3>Daily spending</h3>
          </div>
          <BarChart
            height={120}
            highlightLast={false}
            color="var(--accent)"
            format={(v) => money(v)}
            data={Array.from({ length: daysInMonth(month + '-01') }, (_, i) => {
              const d = `${month}-${String(i + 1).padStart(2, '0')}`;
              return { label: String(i + 1), value: -tx.filter((t) => t.date === d && t.amount < 0).reduce((a, t) => a + t.amount, 0) };
            })}
          />
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h3>Transactions · {list.length}</h3>
          <div className="row gap-s">
            <Segmented value={type} onChange={setType} options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]} />
            <div className="search-box sm">
              <Icon name="search" size={14} />
              <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Note</th>
                <th>Account</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => setEdit(t)}>
                  <td className="muted nowrap">{fmtDate(t.date, { month: 'short', day: 'numeric', weekday: 'short' })}</td>
                  <td>
                    <span className="row gap-s">
                      <span className="dot" style={{ background: catColor(t.category) }} />
                      {t.category}
                    </span>
                  </td>
                  <td className="muted">{t.note || '—'}</td>
                  <td className="muted">{t.account}</td>
                  <td style={{ textAlign: 'right' }} className={cx('strong nowrap', t.amount > 0 ? 'success-text' : '')}>
                    {t.amount > 0 ? '+' : ''}
                    {money(t.amount)}
                  </td>
                  <td>
                    <button className="icon-btn tiny" onClick={(e) => { e.stopPropagation(); deleteTransaction(t.id); toast('Transaction deleted', { action: { label: 'Undo', run: () => useData.getState().addTransaction(t) } }); }} aria-label="Delete">
                      <Icon name="trash" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <Empty icon="wallet" title="No transactions" />}
        </div>
      </section>

      <TxModal tx={edit} onClose={() => setEdit(null)} />
      <Modal open={budgetEdit} onClose={() => setBudgetEdit(false)} title="Monthly budgets" width={420}>
        {EXPENSE_CATS.map((c) => (
          <div key={c} className="row gap-s" style={{ marginBottom: 8 }}>
            <span className="dot" style={{ background: catColor(c) }} />
            <span className="flex-1">{c}</span>
            <input type="number" min={0} className="input sm" style={{ width: 120 }} placeholder="No limit" value={budgets[c] ?? ''} onChange={(e) => setBudget(c, e.target.value ? Number(e.target.value) : null)} />
          </div>
        ))}
      </Modal>
    </div>
  );
}

function FinStat({ label, value, delta, good, icon, color, sub }: { label: string; value: string; delta?: number; good?: 'up' | 'down'; icon: string; color: string; sub?: string }) {
  const positive = delta !== undefined && (good === 'up' ? delta >= 0 : delta <= 0);
  return (
    <div className="card fin-stat">
      <div className="stat-icon" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
        <Icon name={icon} size={18} />
      </div>
      <div>
        <div className="small muted">{label}</div>
        <div className="stat-value">{value}</div>
        {delta !== undefined ? (
          <div className={cx('small', positive ? 'success-text' : 'danger-text')}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs last month
          </div>
        ) : (
          <div className="small muted">{sub}</div>
        )}
      </div>
    </div>
  );
}

function TxModal({ tx, onClose }: { tx: Transaction | 'new' | null; onClose: () => void }) {
  const t = tx && tx !== 'new' ? tx : null;
  const blank = { date: today(), amount: 0, category: 'Groceries', note: '', account: 'Checking' };
  const [key, setKey] = useState('');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [d, setD] = useState({ ...blank, amountStr: '' });
  const cur = tx === 'new' ? 'new' : t?.id || '';
  if (cur !== key) {
    setKey(cur);
    if (t) {
      setKind(t.amount < 0 ? 'expense' : 'income');
      setD({ ...t, amountStr: String(Math.abs(t.amount)) });
    } else {
      setKind('expense');
      setD({ ...blank, amountStr: '' });
    }
  }
  const save = () => {
    const n = parseFloat(d.amountStr);
    if (!n || n <= 0) return toast('Enter a positive amount', { kind: 'error' });
    const rec = { date: d.date, amount: kind === 'expense' ? -n : n, category: d.category, note: d.note, account: d.account };
    const s = useData.getState();
    if (t) s.updateTransaction(t.id, rec);
    else s.addTransaction(rec);
    toast(t ? 'Transaction updated' : 'Transaction added', { kind: 'success' });
    onClose();
  };
  const cats = kind === 'expense' ? EXPENSE_CATS : INCOME_CATS;
  return (
    <Modal open={!!tx} onClose={onClose} title={t ? 'Edit transaction' : 'New transaction'} width={440} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" onClick={save}>Save</button></>}>
      <Segmented value={kind} onChange={(k) => { setKind(k); setD({ ...d, category: (k === 'expense' ? EXPENSE_CATS : INCOME_CATS)[0] }); }} options={[{ value: 'expense', label: '− Expense' }, { value: 'income', label: '+ Income' }]} />
      <input className="title-input amount-input" autoFocus inputMode="decimal" placeholder="0.00" value={d.amountStr} onChange={(e) => setD({ ...d, amountStr: e.target.value.replace(/[^\d.]/g, '') })} onKeyDown={(e) => e.key === 'Enter' && save()} />
      <Field label="Category">
        <div className="row gap-s wrap">
          {cats.map((c) => (
            <button key={c} className={cx('chip clickable', d.category === c && 'active')} onClick={() => setD({ ...d, category: c })}>
              <span className="dot" style={{ background: catColor(c) }} /> {c}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid-2">
        <Field label="Date">
          <input type="date" className="input" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
        </Field>
        <Field label="Account">
          <select className="input" value={d.account} onChange={(e) => setD({ ...d, account: e.target.value })}>
            {['Checking', 'Savings', 'Credit Card', 'Cash'].map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Note">
        <input className="input" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder="Optional" />
      </Field>
    </Modal>
  );
}
