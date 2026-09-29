import { useMemo, useState } from 'react';
import { useData } from '../../store/data';
import { toast } from '../../store/ui';
import { Modal, Segmented } from '../../components/ui';
import { Field } from '../../components/TaskParts';
import { Icon } from '../../components/Icon';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, balanceMap, categoryColor, effectOn } from '../../lib/finance';
import { cx, fmtMoney } from '../../lib/id';
import { today } from '../../lib/date';
import type { ID, Transaction, TxKind } from '../../types';
import { parseAmount } from './money';

type Kind = Exclude<TxKind, 'adjustment'>;

export interface TxDraftDefaults {
  kind?: Kind;
  accountId?: ID;
}

interface Props {
  tx: Transaction | 'new' | null;
  defaults?: TxDraftDefaults;
  onClose: () => void;
}

/** Log income / expense / transfer. Shows exactly how each account balance will change before you save. */
export default function TxModal({ tx, defaults, onClose }: Props) {
  const accounts = useData((s) => s.accounts);
  const transactions = useData((s) => s.transactions);
  const currency = useData((s) => s.settings.currency);
  const live = accounts.filter((a) => !a.archived);
  const t = tx && tx !== 'new' ? tx : null;

  const blank = () => ({
    kind: (defaults?.kind || 'expense') as Kind,
    amountStr: '',
    accountId: defaults?.accountId || live[0]?.id || '',
    toAccountId: '',
    category: (defaults?.kind || 'expense') === 'income' ? 'Salary' : 'Groceries',
    date: today(),
    note: '',
  });
  const [key, setKey] = useState('');
  const [d, setD] = useState(blank);
  const cur = tx === 'new' ? `new-${defaults?.kind || ''}-${defaults?.accountId || ''}` : t?.id || '';
  // Forget the last draft once the dialog closes, so the next open starts clean.
  if (!tx && key) setKey('');
  if (tx && cur !== key) {
    setKey(cur);
    if (t)
      setD({
        kind: (t.kind === 'adjustment' ? (t.amount < 0 ? 'expense' : 'income') : t.kind) as Kind,
        amountStr: String(Math.abs(t.amount)),
        accountId: t.accountId,
        toAccountId: t.toAccountId || '',
        category: t.category,
        date: t.date,
        note: t.note,
      });
    else setD(blank());
  }

  const amount = parseAmount(d.amountStr);
  const cats = d.kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Balances without this transaction (when editing) so the preview is honest.
  const base = useMemo(() => balanceMap(accounts, t ? transactions.filter((x) => x.id !== t.id) : transactions), [accounts, transactions, t]);

  const preview = useMemo(() => {
    if (!amount || !d.accountId) return [];
    const draft: Transaction = {
      id: 'draft',
      date: d.date,
      kind: d.kind,
      amount: d.kind === 'expense' ? -Math.abs(amount) : Math.abs(amount),
      category: d.category,
      note: '',
      accountId: d.accountId,
      toAccountId: d.kind === 'transfer' ? d.toAccountId || null : null,
      createdAt: 0,
    };
    const ids = [d.accountId, d.kind === 'transfer' ? d.toAccountId : ''].filter(Boolean);
    return ids.map((id) => {
      const acc = accounts.find((a) => a.id === id)!;
      const before = base[id] ?? 0;
      return { acc, before, after: before + effectOn(draft, id) };
    });
  }, [amount, d, accounts, base]);

  const setKind = (k: Kind) =>
    setD((x) => ({
      ...x,
      kind: k,
      category: k === 'transfer' ? 'Transfer' : k === 'income' ? (INCOME_CATEGORIES.includes(x.category) ? x.category : 'Salary') : EXPENSE_CATEGORIES.includes(x.category) ? x.category : 'Groceries',
      toAccountId: k === 'transfer' ? x.toAccountId || live.find((a) => a.id !== x.accountId)?.id || '' : '',
    }));

  const save = (another = false) => {
    if (!live.length) return toast('Add an account first', { kind: 'error' });
    if (!amount || amount <= 0) return toast('Enter an amount greater than zero', { kind: 'error' });
    if (!d.accountId) return toast('Choose an account', { kind: 'error' });
    if (d.kind === 'transfer' && (!d.toAccountId || d.toAccountId === d.accountId)) return toast('Pick two different accounts', { kind: 'error' });
    const rec = {
      date: d.date || today(),
      kind: d.kind,
      amount: d.kind === 'expense' ? -Math.abs(amount) : Math.abs(amount),
      category: d.kind === 'transfer' ? 'Transfer' : d.category,
      note: d.note.trim(),
      accountId: d.accountId,
      toAccountId: d.kind === 'transfer' ? d.toAccountId : null,
    };
    const s = useData.getState();
    if (t) s.updateTransaction(t.id, rec);
    else s.addTransaction(rec);
    const acc = accounts.find((a) => a.id === d.accountId);
    const after = preview[0]?.after;
    toast(t ? 'Transaction updated' : `${d.kind === 'income' ? 'Income' : d.kind === 'transfer' ? 'Transfer' : 'Expense'} saved · ${acc?.name}: ${after !== undefined ? fmtMoney(after, currency) : ''}`, { kind: 'success' });
    if (another && !t) setD((x) => ({ ...x, amountStr: '', note: '' }));
    else onClose();
  };

  const remove = () => {
    if (!t) return;
    const s = useData.getState();
    s.deleteTransaction(t.id);
    onClose();
    toast('Transaction deleted — balance updated', { action: { label: 'Undo', run: () => s.restoreTransaction(t) } });
  };

  const accountChip = (id: string, onPick: (id: string) => void, exclude?: string) => (
    <div className="acct-chips">
      {live
        .filter((a) => a.id !== exclude)
        .map((a) => (
          <button key={a.id} type="button" className={cx('acct-chip', id === a.id && 'on')} onClick={() => onPick(a.id)} style={{ ['--c' as string]: a.color }}>
            <span className="dot" />
            <span className="acct-chip-name">{a.name}</span>
            <span className="acct-chip-bal">{fmtMoney(base[a.id] ?? 0, currency)}</span>
          </button>
        ))}
    </div>
  );

  return (
    <Modal
      open={!!tx}
      onClose={onClose}
      title={t ? 'Edit transaction' : 'New transaction'}
      width={520}
      footer={
        <>
          {t && (
            <button className="btn ghost danger-text" onClick={remove}>
              <Icon name="trash" size={15} /> Delete
            </button>
          )}
          <div style={{ flex: 1 }} />
          {!t && (
            <button className="btn ghost" onClick={() => save(true)}>
              Save &amp; add another
            </button>
          )}
          <button className="btn primary" onClick={() => save()}>
            Save
          </button>
        </>
      }
    >
      {t?.kind === 'adjustment' && <p className="small muted" style={{ marginTop: 0 }}>This is a manual balance adjustment. Saving turns it into a regular transaction.</p>}
      <Segmented<Kind>
        value={d.kind}
        onChange={setKind}
        options={[
          { value: 'expense', label: 'Expense', icon: 'minus' },
          { value: 'income', label: 'Income', icon: 'plus' },
          { value: 'transfer', label: 'Transfer', icon: 'swap' },
        ]}
      />

      <div className={cx('amount-hero', d.kind)}>
        <span>{d.kind === 'expense' ? '−' : d.kind === 'income' ? '+' : ''}{currency === 'LKR' ? 'Rs' : currency}</span>
        <input
          autoFocus
          inputMode="decimal"
          placeholder="0"
          value={d.amountStr}
          onChange={(e) => setD({ ...d, amountStr: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          aria-label="Amount"
          style={{ width: `${Math.max(1, d.amountStr.length || 1) + 0.6}ch` }}
        />
      </div>
      <div className="amount-hint small muted">
        {amount ? fmtMoney(amount, currency) : 'Type an amount — 2500, 2,500 or 2.5k all work'}
      </div>

      {!live.length ? (
        <p className="muted small">You don't have any accounts yet. Close this and add one from the Accounts tab.</p>
      ) : (
        <>
          <Field label={d.kind === 'transfer' ? 'From' : d.kind === 'income' ? 'Into account' : 'Paid from'}>{accountChip(d.accountId, (id) => setD((x) => ({ ...x, accountId: id, toAccountId: x.toAccountId === id ? '' : x.toAccountId })))}</Field>
          {d.kind === 'transfer' && <Field label="To">{accountChip(d.toAccountId, (id) => setD({ ...d, toAccountId: id }), d.accountId)}</Field>}
        </>
      )}

      {d.kind !== 'transfer' && (
        <Field label="Category">
          <div className="row gap-s wrap">
            {cats.map((c) => (
              <button key={c} type="button" className={cx('chip clickable', d.category === c && 'active')} onClick={() => setD({ ...d, category: c })}>
                <span className="dot" style={{ background: categoryColor(c) }} /> {c}
              </button>
            ))}
          </div>
        </Field>
      )}

      <div className="grid-2">
        <Field label="Date">
          <input type="date" className="input" aria-label="Date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} />
        </Field>
        <Field label="Note">
          <input className="input" aria-label="Note" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} placeholder={d.kind === 'transfer' ? 'e.g. Card payment' : 'Optional'} />
        </Field>
      </div>

      {preview.length > 0 && (
        <div className="bal-preview" aria-live="polite">
          {preview.map(({ acc, before, after }) => (
            <div key={acc.id} className="bal-preview-row">
              <span className="dot" style={{ background: acc.color }} />
              <span className="flex-1 ellipsis">{acc.name}</span>
              <span className="muted">{fmtMoney(before, currency)}</span>
              <Icon name="arrowRight" size={13} className="muted" />
              <strong className={cx(after < before ? '' : 'success-text')}>{fmtMoney(after, currency)}</strong>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
