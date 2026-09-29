import { useState } from 'react';
import { useData } from '../../store/data';
import { toast } from '../../store/ui';
import { Modal, Confirm } from '../../components/ui';
import { Field } from '../../components/TaskParts';
import { Icon } from '../../components/Icon';
import { ACCOUNT_COLORS, ACCOUNT_TYPES } from '../../lib/finance';
import { cx, fmtMoney } from '../../lib/id';
import type { Account } from '../../types';
import { parseAmount } from './money';

interface Props {
  account: Account | 'new' | null;
  balance: number;
  onClose: () => void;
}

/** Create an account with its current balance, or edit one (rename, re-set balance, archive, delete). */
export default function AccountModal({ account, balance, onClose }: Props) {
  const currency = useData((s) => s.settings.currency);
  const txCount = useData((s) => (account && account !== 'new' ? s.transactions.filter((t) => t.accountId === account.id || t.toAccountId === account.id).length : 0));
  const a = account && account !== 'new' ? account : null;
  const [key, setKey] = useState('');
  const [d, setD] = useState({ name: '', type: 'bank' as Account['type'], institution: '', last4: '', color: ACCOUNT_COLORS[0], balanceStr: '' });
  const [confirm, setConfirm] = useState(false);

  const cur = account === 'new' ? 'new' : a?.id || '';
  // Forget the last draft once the dialog closes, so the next open starts clean.
  if (!account && key) setKey('');
  if (account && cur !== key) {
    setKey(cur);
    setD(
      a
        ? { name: a.name, type: a.type, institution: a.institution, last4: a.last4, color: a.color, balanceStr: String(balance) }
        : { name: '', type: 'bank', institution: '', last4: '', color: ACCOUNT_COLORS[0], balanceStr: '' }
    );
  }

  const isCard = d.type === 'card';
  const typed = parseAmount(d.balanceStr);

  const save = () => {
    if (!d.name.trim()) return toast('Give the account a name', { kind: 'error' });
    const s = useData.getState();
    // Credit cards: the user types what they owe; store it as a negative balance.
    const target = typed === null ? 0 : isCard ? -Math.abs(typed) : typed;
    const meta = { name: d.name.trim(), type: d.type, institution: d.institution.trim(), last4: d.last4.trim(), color: d.color };
    if (a) {
      s.updateAccount(a.id, meta);
      if (typed !== null && Math.round(target * 100) !== Math.round(balance * 100)) {
        s.setAccountBalance(a.id, target, balance);
        toast(`Balance set to ${fmtMoney(target, currency)} — recorded as an adjustment`, { kind: 'success' });
      } else toast('Account updated', { kind: 'success' });
    } else {
      s.addAccount({ ...meta, openingBalance: target });
      toast(`Added ${meta.name}`, { kind: 'success' });
    }
    onClose();
  };

  const remove = () => {
    if (!a) return;
    const s = useData.getState();
    const removed = s.deleteAccount(a.id);
    onClose();
    if (removed) toast(`Deleted ${a.name}`, { action: { label: 'Undo', run: () => s.restoreAccount(removed.account, removed.transactions) } });
  };

  return (
    <>
      <Modal
        open={!!account}
        onClose={onClose}
        title={a ? 'Edit account' : 'Add account'}
        width={480}
        footer={
          <>
            {a && (
              <>
                <button className="btn ghost danger-text" onClick={() => setConfirm(true)}>
                  <Icon name="trash" size={15} /> Delete
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    useData.getState().updateAccount(a.id, { archived: !a.archived });
                    toast(a.archived ? 'Account restored' : 'Account archived');
                    onClose();
                  }}
                >
                  {a.archived ? 'Unarchive' : 'Archive'}
                </button>
              </>
            )}
            <div style={{ flex: 1 }} />
            <button className="btn primary" onClick={save}>
              {a ? 'Save' : 'Add account'}
            </button>
          </>
        }
      >
        <div className="acct-type-grid" role="radiogroup" aria-label="Account type">
          {ACCOUNT_TYPES.map((t) => (
            <button key={t.value} type="button" role="radio" aria-checked={d.type === t.value} className={cx('acct-type', d.type === t.value && 'on')} onClick={() => setD({ ...d, type: t.value })}>
              <Icon name={t.icon} size={18} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <Field label="Account name">
          <input className="input" autoFocus aria-label="Account name" placeholder={isCard ? 'e.g. HNB Visa' : 'e.g. Salary account'} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
        </Field>
        <div className="grid-2">
          <Field label="Bank / provider">
            <input className="input" aria-label="Bank or provider" placeholder="Commercial Bank" value={d.institution} onChange={(e) => setD({ ...d, institution: e.target.value })} />
          </Field>
          <Field label="Last 4 digits">
            <input className="input" aria-label="Last 4 digits" inputMode="numeric" maxLength={4} placeholder="4821" value={d.last4} onChange={(e) => setD({ ...d, last4: e.target.value.replace(/\D/g, '') })} />
          </Field>
        </div>

        <Field label={isCard ? 'Amount owed right now' : a ? 'Current balance' : 'Current balance (opening)'}>
          <div className="money-field">
            <span>{currency === 'LKR' ? 'Rs' : currency}</span>
            <input inputMode="decimal" aria-label={isCard ? 'Amount owed' : 'Current balance'} placeholder="0" value={d.balanceStr} onChange={(e) => setD({ ...d, balanceStr: e.target.value })} />
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            {a
              ? `Currently ${fmtMoney(balance, currency)}. Change it and Nexus records the difference as a balance adjustment, so your history stays intact.`
              : 'Every income, expense and transfer you log will update this balance automatically.'}
          </p>
        </Field>

        <Field label="Colour">
          <div className="row gap-s">
            {ACCOUNT_COLORS.map((c) => (
              <button key={c} className={cx('swatch', d.color === c && 'active')} style={{ background: c }} onClick={() => setD({ ...d, color: c })} aria-label={c} />
            ))}
          </div>
        </Field>
      </Modal>
      <Confirm
        open={confirm}
        onClose={() => setConfirm(false)}
        title={`Delete ${a?.name ?? 'account'}?`}
        body={txCount ? `This also deletes its ${txCount} transaction${txCount === 1 ? '' : 's'}. Consider archiving instead to keep your history.` : 'This account has no transactions.'}
        onConfirm={remove}
      />
    </>
  );
}
