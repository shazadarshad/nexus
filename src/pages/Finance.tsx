import { useEffect, useMemo, useState } from 'react';
import { useData } from '../store/data';
import { toast } from '../store/ui';
import { Topbar } from '../components/Shell';
import { Icon } from '../components/Icon';
import { Donut, Sparkline } from '../components/Charts';
import { Empty, Modal, Progress, Segmented } from '../components/ui';
import { monthTotals } from '../lib/analytics';
import { accountTypeMeta, balanceMap, categoryColor, effectOn, EXPENSE_CATEGORIES, netWorth, runningBalances, sortTx, accountBalance } from '../lib/finance';
import { addDays, addMonths, daysInMonth, fmtDate, fmtMonth, parseISO, range, today } from '../lib/date';
import { cx, download, fmtMoney, fuzzy } from '../lib/id';
import type { Account, Transaction } from '../types';
import TxModal, { type TxDraftDefaults } from './finance/TxModal';
import AccountModal from './finance/AccountModal';

type Tab = 'overview' | 'accounts' | 'transactions' | 'budgets';
type TypeFilter = 'all' | 'income' | 'expense' | 'transfer';

export default function Finance() {
  const accounts = useData((s) => s.accounts);
  const tx = useData((s) => s.transactions);
  const budgets = useData((s) => s.budgets);
  const currency = useData((s) => s.settings.currency);
  const money = (n: number, sign = false) => fmtMoney(n, currency, { sign });

  const [tab, setTab] = useState<Tab>(() => (localStorage.getItem('nexus-fin-tab') as Tab) || 'overview');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [editTx, setEditTx] = useState<Transaction | 'new' | null>(null);
  const [txDefaults, setTxDefaults] = useState<TxDraftDefaults | undefined>();
  const [editAcc, setEditAcc] = useState<Account | 'new' | null>(null);
  const [accFilter, setAccFilter] = useState<string>('all');
  const [budgetEdit, setBudgetEdit] = useState(false);

  useEffect(() => localStorage.setItem('nexus-fin-tab', tab), [tab]);
  useEffect(() => {
    const h = () => newTx();
    window.addEventListener('nexus:add-tx', h);
    return () => window.removeEventListener('nexus:add-tx', h);
  }, []); // eslint-disable-line

  const worth = useMemo(() => netWorth(accounts, tx), [accounts, tx]);
  const balances = worth.balances;
  const totals = useMemo(() => monthTotals(tx, month), [tx, month]);
  const live = accounts.filter((a) => !a.archived);

  const newTx = (defaults?: TxDraftDefaults) => {
    if (!useData.getState().accounts.some((a) => !a.archived)) {
      toast('Add an account first — then every transaction updates its balance');
      setEditAcc('new');
      return;
    }
    setTxDefaults(defaults);
    setEditTx('new');
  };

  const openAccount = (a: Account) => {
    setAccFilter(a.id);
    setTab('transactions');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const exportCsv = () => {
    const name = (id: string | null) => accounts.find((a) => a.id === id)?.name || '';
    const rows = [
      ['Date', 'Type', 'Amount', 'Category', 'Account', 'To account', 'Note'],
      ...sortTx(tx).map((t) => [t.date, t.kind, t.amount.toFixed(2), t.category, name(t.accountId), name(t.toAccountId), `"${t.note.replace(/"/g, '""')}"`]),
    ];
    download(`nexus-transactions-${today()}.csv`, rows.map((r) => r.join(',')).join('\n'), 'text/csv');
    toast('CSV exported', { kind: 'success' });
  };

  return (
    <div className="page">
      <Topbar
        title="Finance"
        subtitle={`${live.length} account${live.length === 1 ? '' : 's'} · net worth ${money(worth.total)}`}
        actions={
          <>
            <button className="btn ghost sm hide-sm" onClick={exportCsv}>
              <Icon name="download" size={15} /> CSV
            </button>
            <button className="btn sm" onClick={() => setEditAcc('new')} aria-label="New account">
              <Icon name="landmark" size={15} /> <span className="hide-sm">Account</span>
            </button>
            <button className="btn sm blue" onClick={() => newTx()} aria-label="Add transaction">
              <Icon name="plus" size={15} /> Transaction
            </button>
          </>
        }
      />

      {/* Net worth strip */}
      <section className="card worth-strip">
        <div>
          <div className="small muted">Net worth</div>
          <div className="worth-total">{money(worth.total)}</div>
          <div className="small muted">
            {money(worth.assets)} in accounts{worth.liabilities > 0 && <> · {money(worth.liabilities)} owed</>}
          </div>
        </div>
        <div className="worth-month">
          <MonthStepper month={month} setMonth={setMonth} />
          <div className="worth-io">
            <div>
              <span className="small muted">Money in</span>
              <strong className="success-text">{money(totals.income)}</strong>
            </div>
            <div>
              <span className="small muted">Money out</span>
              <strong>{money(totals.expense)}</strong>
            </div>
            <div>
              <span className="small muted">Net</span>
              <strong className={cx(totals.net < 0 && 'danger-text')}>{money(totals.net, true)}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="fin-tabs">
        <Segmented<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'overview', label: 'Overview' },
            { value: 'accounts', label: 'Accounts' },
            { value: 'transactions', label: 'Transactions' },
            { value: 'budgets', label: 'Budgets' },
          ]}
        />
      </div>

      {!accounts.length ? (
        <section className="card">
          <Empty
            icon="landmark"
            title="Start with your accounts"
            hint="Add your bank accounts, cash and cards with their current balance. Every transaction you log updates them."
            action={
              <button className="btn primary" onClick={() => setEditAcc('new')}>
                <Icon name="plus" size={15} /> Add your first account
              </button>
            }
          />
        </section>
      ) : tab === 'overview' ? (
        <Overview month={month} setMonth={setMonth} balances={balances} onOpenAccount={openAccount} onNewTx={newTx} onEditTx={setEditTx} onSeeAll={() => setTab('transactions')} />
      ) : tab === 'accounts' ? (
        <AccountsGrid balances={balances} onOpen={openAccount} onEdit={setEditAcc} onNewTx={newTx} />
      ) : tab === 'transactions' ? (
        <TransactionsList accFilter={accFilter} setAccFilter={setAccFilter} month={month} setMonth={setMonth} onEdit={setEditTx} onNewTx={newTx} />
      ) : (
        <Budgets month={month} setMonth={setMonth} onEdit={() => setBudgetEdit(true)} />
      )}

      <TxModal tx={editTx} defaults={txDefaults} onClose={() => setEditTx(null)} />
      <AccountModal account={editAcc} balance={editAcc && editAcc !== 'new' ? balances[editAcc.id] ?? 0 : 0} onClose={() => setEditAcc(null)} />
      <Modal open={budgetEdit} onClose={() => setBudgetEdit(false)} title="Monthly budgets" width={440}>
        {EXPENSE_CATEGORIES.filter((c) => c !== 'Other').map((c) => (
          <div key={c} className="row gap-s" style={{ marginBottom: 8 }}>
            <span className="dot" style={{ background: categoryColor(c) }} />
            <span className="flex-1">{c}</span>
            <input
              type="number"
              min={0}
              step={500}
              className="input sm"
              style={{ width: 130 }}
              placeholder="No limit"
              value={budgets[c] ?? ''}
              onChange={(e) => useData.getState().setBudget(c, e.target.value ? Number(e.target.value) : null)}
            />
          </div>
        ))}
      </Modal>
    </div>
  );
}

/* ───────────────────────── shared bits ───────────────────────── */

/** Short signed amount for tight spots: +107.6k, −2.4k, 0. */
const compact = (n: number) => {
  if (!n) return '0';
  const a = Math.abs(n);
  const v = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(1)}M` : a >= 1000 ? `${(a / 1000).toFixed(a >= 100_000 ? 0 : 1)}k` : `${Math.round(a)}`;
  return `${n < 0 ? '−' : '+'}${v}`;
};

function MonthStepper({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const isCurrent = month === today().slice(0, 7);
  return (
    <div className="month-stepper">
      <button className="icon-btn" onClick={() => setMonth(addMonths(month + '-01', -1).slice(0, 7))} aria-label="Previous month">
        <Icon name="chevronLeft" size={16} />
      </button>
      <span>{fmtMonth(month + '-01')}</span>
      <button className="icon-btn" onClick={() => setMonth(addMonths(month + '-01', 1).slice(0, 7))} aria-label="Next month" disabled={isCurrent}>
        <Icon name="chevronRight" size={16} />
      </button>
    </div>
  );
}

function AccountCard({ a, balance, onOpen, onEdit, onNewTx }: { a: Account; balance: number; onOpen: () => void; onEdit: () => void; onNewTx: () => void }) {
  const currency = useData((s) => s.settings.currency);
  const tx = useData((s) => s.transactions);
  const meta = accountTypeMeta(a.type);
  const spark = useMemo(() => range(addDays(today(), -29), 30).map((d) => accountBalance(a, tx, d)), [a, tx]);
  const owed = a.type === 'card' && balance < 0;
  return (
    <div className={cx('acct-card', a.archived && 'archived')} style={{ ['--c' as string]: a.color }}>
      <button className="acct-card-main" onClick={onOpen}>
        <div className="row between">
          <span className="acct-icon">
            <Icon name={meta.icon} size={16} />
          </span>
          <Sparkline values={spark.map((v) => v - Math.min(...spark))} width={72} height={22} color={a.color} />
        </div>
        <div className="acct-name">{a.name}</div>
        <div className="small muted">
          {[a.institution || meta.label, a.last4 && `•• ${a.last4}`].filter(Boolean).join(' ')}
          {a.archived && ' · archived'}
        </div>
        <div className={cx('acct-balance', balance < 0 && !owed && 'danger-text')}>{fmtMoney(owed ? -balance : balance, currency)}</div>
        <div className="small muted">{owed ? 'owed on card' : balance < 0 ? 'overdrawn' : a.type === 'card' ? 'in credit' : 'available'}</div>
      </button>
      <div className="acct-card-actions">
        <button onClick={onNewTx}>
          <Icon name="plus" size={14} /> Add
        </button>
        <button onClick={onEdit}>
          <Icon name="edit" size={14} /> Edit
        </button>
      </div>
    </div>
  );
}

function TxRow({ t, onClick, running, perspective }: { t: Transaction; onClick: () => void; running?: number; perspective?: string }) {
  const accounts = useData((s) => s.accounts);
  const currency = useData((s) => s.settings.currency);
  const acc = accounts.find((a) => a.id === t.accountId);
  const to = accounts.find((a) => a.id === t.toAccountId);
  const transfer = t.kind === 'transfer';
  const adjustment = t.kind === 'adjustment';
  return (
    <button className="tx-row" onClick={onClick}>
      <span className="tx-icon" style={{ background: transfer || adjustment ? 'var(--surface-2)' : `color-mix(in srgb, ${categoryColor(t.category)} 14%, transparent)`, color: transfer || adjustment ? 'var(--text-2)' : categoryColor(t.category) }}>
        <Icon name={transfer ? 'swap' : adjustment ? 'edit' : t.amount >= 0 ? 'arrowDown' : 'arrowUp'} size={15} />
      </span>
      <span className="tx-main">
        <span className="tx-title">{t.note || t.category}</span>
        <span className="tx-sub">
          {transfer ? (
            <>
              {acc?.name ?? 'Deleted'} <Icon name="arrowRight" size={11} style={{ verticalAlign: '-1px' }} /> {to?.name ?? 'Deleted'}
            </>
          ) : (
            <>
              {t.note ? `${t.category} · ` : ''}
              {acc?.name ?? 'Deleted account'}
            </>
          )}
        </span>
      </span>
      <span className="tx-amount">
        <strong className={cx(t.kind === 'income' && 'success-text', adjustment && 'muted')}>
          {transfer
            ? perspective
              ? fmtMoney(effectOn(t, perspective), currency, { sign: true })
              : fmtMoney(Math.abs(t.amount), currency)
            : fmtMoney(t.amount, currency, { sign: true })}
        </strong>
        {running !== undefined && <span className="tx-running">{fmtMoney(running, currency)}</span>}
      </span>
    </button>
  );
}

/* ───────────────────────── Overview ───────────────────────── */

function Overview({
  month,
  setMonth,
  balances,
  onOpenAccount,
  onNewTx,
  onEditTx,
  onSeeAll,
}: {
  month: string;
  setMonth: (m: string) => void;
  balances: Record<string, number>;
  onOpenAccount: (a: Account) => void;
  onNewTx: (d?: TxDraftDefaults) => void;
  onEditTx: (t: Transaction) => void;
  onSeeAll: () => void;
}) {
  const accounts = useData((s) => s.accounts);
  const tx = useData((s) => s.transactions);
  const currency = useData((s) => s.settings.currency);
  const money = (n: number) => fmtMoney(n, currency);
  const totals = useMemo(() => monthTotals(tx, month), [tx, month]);
  const six = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const m = addMonths(month + '-01', i - 5).slice(0, 7);
        const t = monthTotals(tx, m);
        return { m, label: fmtMonth(m + '-01').slice(0, 3), income: t.income, expense: t.expense };
      }),
    [tx, month]
  );
  const segs = Object.entries(totals.byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: categoryColor(label) }));
  const recent = sortTx(tx).slice(0, 6);
  const max = Math.max(1, ...six.map((x) => Math.max(x.income, x.expense)));

  return (
    <>
      <div className="acct-strip">
        {accounts
          .filter((a) => !a.archived)
          .map((a) => (
            <AccountCard key={a.id} a={a} balance={balances[a.id] ?? 0} onOpen={() => onOpenAccount(a)} onEdit={() => onOpenAccount(a)} onNewTx={() => onNewTx({ accountId: a.id })} />
          ))}
      </div>

      <div className="fin-grid">
        <section className="card">
          <div className="card-head">
            <h3>Recent activity</h3>
            <button className="link-btn small" onClick={onSeeAll}>
              All transactions <Icon name="chevronRight" size={13} />
            </button>
          </div>
          {recent.length ? recent.map((t) => <TxRow key={t.id} t={t} onClick={() => onEditTx(t)} />) : <Empty icon="wallet" title="No transactions yet" />}
          <div className="quick-add-row">
            <button className="btn sm" onClick={() => onNewTx({ kind: 'expense' })}>
              <Icon name="minus" size={14} /> Expense
            </button>
            <button className="btn sm" onClick={() => onNewTx({ kind: 'income' })}>
              <Icon name="plus" size={14} /> Income
            </button>
            <button className="btn sm" onClick={() => onNewTx({ kind: 'transfer' })}>
              <Icon name="swap" size={14} /> Transfer
            </button>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h3>Spending · {fmtMonth(month + '-01')}</h3>
            <MonthStepper month={month} setMonth={setMonth} />
          </div>
          {segs.length ? (
            <div className="donut-wrap">
              <Donut
                segments={segs}
                size={168}
                center={
                  <>
                    <div className="small muted">Spent</div>
                    <strong>{money(totals.expense)}</strong>
                  </>
                }
              />
              <div className="legend">
                {segs.slice(0, 7).map((s) => (
                  <div key={s.label} className="legend-item small">
                    <span className="dot" style={{ background: s.color }} />
                    <span className="flex-1 ellipsis">{s.label}</span>
                    <strong>{money(s.value)}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <Empty icon="wallet" title="No spending this month" />
          )}
        </section>

        <section className="card span-2">
          <div className="card-head">
            <h3>Cash flow · 6 months</h3>
            <span className="small muted">
              <span className="dot" style={{ background: 'var(--accent)' }} /> In <span className="dot" style={{ background: 'var(--surface-3)', marginLeft: 12 }} /> Out
            </span>
          </div>
          <div className="cashflow">
            {six.map((m) => (
              <button key={m.m} className={cx('cf-col', m.m === month && 'active')} onClick={() => setMonth(m.m)}>
                <div className="cf-bars">
                  <div className="cf-bar" style={{ height: `${(m.income / max) * 100}%`, background: 'var(--accent)' }} title={`In ${money(m.income)}`} />
                  <div className="cf-bar" style={{ height: `${(m.expense / max) * 100}%`, background: 'var(--surface-3)' }} title={`Out ${money(m.expense)}`} />
                </div>
                <span className="small muted">{m.label}</span>
                <span className={cx('small strong nowrap', m.income - m.expense < 0 && 'danger-text')}>{compact(m.income - m.expense)}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

/* ───────────────────────── Accounts ───────────────────────── */

function AccountsGrid({
  balances,
  onOpen,
  onEdit,
  onNewTx,
}: {
  balances: Record<string, number>;
  onOpen: (a: Account) => void;
  onEdit: (a: Account | 'new') => void;
  onNewTx: (d?: TxDraftDefaults) => void;
}) {
  const accounts = useData((s) => s.accounts);
  const [showArchived, setShowArchived] = useState(false);
  const archived = accounts.filter((a) => a.archived);
  const list = accounts.filter((a) => showArchived || !a.archived);
  return (
    <>
      <div className="acct-grid">
        {list.map((a) => (
          <AccountCard key={a.id} a={a} balance={balances[a.id] ?? 0} onOpen={() => onOpen(a)} onEdit={() => onEdit(a)} onNewTx={() => onNewTx({ accountId: a.id })} />
        ))}
        <button className="acct-card add" onClick={() => onEdit('new')}>
          <Icon name="plus" size={20} />
          <span>Add account</span>
          <span className="small muted">Bank, savings, cash, card or e-wallet</span>
        </button>
      </div>
      {archived.length > 0 && (
        <button className="link-btn small" style={{ marginTop: 12 }} onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? 'Hide' : 'Show'} {archived.length} archived
        </button>
      )}
    </>
  );
}

/* ───────────────────────── Transactions ───────────────────────── */

function TransactionsList({
  accFilter,
  setAccFilter,
  month,
  setMonth,
  onEdit,
  onNewTx,
}: {
  accFilter: string;
  setAccFilter: (v: string) => void;
  month: string;
  setMonth: (m: string) => void;
  onEdit: (t: Transaction) => void;
  onNewTx: (d?: TxDraftDefaults) => void;
}) {
  const accounts = useData((s) => s.accounts);
  const tx = useData((s) => s.transactions);
  const currency = useData((s) => s.settings.currency);
  const [type, setType] = useState<TypeFilter>('all');
  const [q, setQ] = useState('');
  const [allTime, setAllTime] = useState(false);
  const acc = accounts.find((a) => a.id === accFilter);

  const running = useMemo(() => (acc ? runningBalances(acc, tx) : {}), [acc, tx]);
  const list = useMemo(() => {
    let r = tx.filter((t) => {
      if (!allTime && !t.date.startsWith(month)) return false;
      if (acc && t.accountId !== acc.id && t.toAccountId !== acc.id) return false;
      if (type === 'income' && !(t.kind === 'income' || (t.kind === 'adjustment' && t.amount > 0))) return false;
      if (type === 'expense' && !(t.kind === 'expense' || (t.kind === 'adjustment' && t.amount < 0))) return false;
      if (type === 'transfer' && t.kind !== 'transfer') return false;
      return true;
    });
    if (q.trim()) r = r.filter((t) => fuzzy(q, `${t.note} ${t.category}`) > 0);
    return sortTx(r);
  }, [tx, month, allTime, acc, type, q]);

  const groups = useMemo(() => {
    const m = new Map<string, Transaction[]>();
    for (const t of list) m.set(t.date, [...(m.get(t.date) || []), t]);
    return [...m.entries()];
  }, [list]);

  const accBalance = acc ? balanceMap([acc], tx)[acc.id] : 0;
  const dayLabel = (d: string) => (d === today() ? 'Today' : d === addDays(today(), -1) ? 'Yesterday' : fmtDate(d, { weekday: 'long', month: 'short', day: 'numeric' }));

  return (
    <section className="card tx-card">
      <div className="tx-toolbar">
        <select className="input sm" value={accFilter} onChange={(e) => setAccFilter(e.target.value)} aria-label="Account">
          <option value="all">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
              {a.archived ? ' (archived)' : ''}
            </option>
          ))}
        </select>
        <Segmented<TypeFilter>
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'All' },
            { value: 'income', label: 'In' },
            { value: 'expense', label: 'Out' },
            { value: 'transfer', label: 'Transfers' },
          ]}
        />
        <div className="search-box sm flex-1">
          <Icon name="search" size={14} />
          <input placeholder="Search notes or categories" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {!allTime && <MonthStepper month={month} setMonth={setMonth} />}
        <label className="toggle-label small">
          <input type="checkbox" checked={allTime} onChange={(e) => setAllTime(e.target.checked)} /> All time
        </label>
      </div>

      {acc && (
        <div className="acct-banner" style={{ ['--c' as string]: acc.color }}>
          <span className="dot" />
          <div className="flex-1">
            <strong>{acc.name}</strong>
            <div className="small muted">Running balance shown on each row</div>
          </div>
          <div className="right">
            <div className="small muted">Balance</div>
            <strong>{fmtMoney(accBalance, currency)}</strong>
          </div>
          <button className="btn sm" onClick={() => onNewTx({ accountId: acc.id })}>
            <Icon name="plus" size={14} /> Add
          </button>
          <button className="icon-btn" onClick={() => setAccFilter('all')} aria-label="Show all accounts">
            <Icon name="x" size={15} />
          </button>
        </div>
      )}

      {groups.length === 0 ? (
        <Empty icon="wallet" title="No transactions here" hint={allTime ? 'Try another filter.' : `Nothing in ${fmtMonth(month + '-01')} for these filters.`} action={<button className="btn primary sm" onClick={() => onNewTx(acc ? { accountId: acc.id } : undefined)}>Add transaction</button>} />
      ) : (
        groups.map(([date, items]) => {
          const dayNet = items.filter((t) => t.kind === 'income' || t.kind === 'expense').reduce((s, t) => s + t.amount, 0);
          return (
            <div key={date} className="tx-day">
              <div className="tx-day-head">
                <span>{dayLabel(date)}</span>
                {dayNet !== 0 && <span className={cx(dayNet > 0 && 'success-text')}>{fmtMoney(dayNet, currency, { sign: true })}</span>}
              </div>
              {items.map((t) => (
                <TxRow key={t.id} t={t} onClick={() => onEdit(t)} running={acc ? running[t.id] : undefined} perspective={acc?.id} />
              ))}
            </div>
          );
        })
      )}
      {list.length > 0 && <p className="small muted" style={{ margin: '12px 4px 0' }}>{list.length} transaction{list.length === 1 ? '' : 's'}</p>}
    </section>
  );
}

/* ───────────────────────── Budgets ───────────────────────── */

function Budgets({ month, setMonth, onEdit }: { month: string; setMonth: (m: string) => void; onEdit: () => void }) {
  const budgets = useData((s) => s.budgets);
  const tx = useData((s) => s.transactions);
  const currency = useData((s) => s.settings.currency);
  const money = (n: number) => fmtMoney(n, currency);
  const totals = useMemo(() => monthTotals(tx, month), [tx, month]);
  const isCurrent = month === today().slice(0, 7);
  const dim = daysInMonth(month + '-01');
  const dayOfMonth = isCurrent ? parseISO(today()).getDate() : dim;
  const expected = dayOfMonth / dim;
  const entries = Object.entries(budgets);
  const budgetTotal = entries.reduce((s, [, v]) => s + v, 0);
  const spentInBudgets = entries.reduce((s, [c]) => s + (totals.byCat[c] || 0), 0);

  return (
    <section className="card">
      <div className="card-head">
        <h3>Budgets</h3>
        <div className="row gap-s">
          <MonthStepper month={month} setMonth={setMonth} />
          <button className="btn sm" onClick={onEdit}>
            <Icon name="edit" size={14} /> Edit limits
          </button>
        </div>
      </div>
      {entries.length === 0 ? (
        <Empty icon="wallet" title="No budgets yet" hint="Set a monthly limit per category." action={<button className="btn primary sm" onClick={onEdit}>Set budgets</button>} />
      ) : (
        <>
          <div className="budget-summary">
            <div>
              <div className="small muted">Spent in budgeted categories</div>
              <div className="worth-total" style={{ fontSize: 28 }}>
                {money(spentInBudgets)} <span className="small muted" style={{ fontSize: 15 }}>of {money(budgetTotal)}</span>
              </div>
            </div>
            <div className="small muted">{isCurrent ? `${dim - dayOfMonth === 0 ? 'Last day' : `${dim - dayOfMonth} day${dim - dayOfMonth === 1 ? '' : 's'} left`} · ${money(Math.max(0, budgetTotal - spentInBudgets))} remaining` : fmtMonth(month + '-01')}</div>
          </div>
          <Progress value={spentInBudgets / budgetTotal} height={8} color={spentInBudgets > budgetTotal ? 'var(--danger)' : undefined} />
          <div style={{ marginTop: 20 }}>
            {entries.map(([cat, limit]) => {
              const spent = totals.byCat[cat] || 0;
              const pct = spent / limit;
              return (
                <div key={cat} className="budget-row">
                  <div className="row between small">
                    <span className="row gap-s">
                      <span className="dot" style={{ background: categoryColor(cat) }} />
                      {cat}
                    </span>
                    <span>
                      <strong className={cx(pct > 1 && 'danger-text')}>{money(spent)}</strong>
                      <span className="muted"> / {money(limit)}</span>
                    </span>
                  </div>
                  <div className="budget-bar">
                    <Progress value={pct} color={pct > 1 ? 'var(--danger)' : pct > expected + 0.1 ? 'var(--warning)' : categoryColor(cat)} height={7} />
                    {isCurrent && <span className="budget-marker" style={{ left: `${expected * 100}%` }} title="Expected by today" />}
                  </div>
                  {pct > 1 && <div className="small danger-text">Over by {money(spent - limit)}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
