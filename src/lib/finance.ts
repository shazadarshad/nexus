import type { Account, AccountType, ID, Transaction } from '../types';
import { sum } from './id';

export const ACCOUNT_TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: 'bank', label: 'Bank account', icon: 'landmark' },
  { value: 'savings', label: 'Savings', icon: 'piggy' },
  { value: 'cash', label: 'Cash', icon: 'banknote' },
  { value: 'card', label: 'Credit card', icon: 'card' },
  { value: 'wallet', label: 'e-Wallet', icon: 'wallet' },
];
export const accountTypeMeta = (t: AccountType) => ACCOUNT_TYPES.find((x) => x.value === t) || ACCOUNT_TYPES[0];

export const ACCOUNT_COLORS = ['#0071e3', '#1d1d1f', '#34a853', '#f5a623', '#af52de', '#ff3b30', '#5ac8fa', '#8e8e93'];

export const EXPENSE_CATEGORIES = [
  'Groceries',
  'Dining',
  'Transport',
  'Fuel',
  'Utilities',
  'Mobile & Internet',
  'Rent',
  'Health',
  'Shopping',
  'Entertainment',
  'Education',
  'Subscriptions',
  'Gifts',
  'Other',
];
export const INCOME_CATEGORIES = ['Salary', 'Freelance', 'Business', 'Interest', 'Gift', 'Refund', 'Other'];

const CAT_COLORS: Record<string, string> = {
  Rent: '#1d1d1f',
  Groceries: '#0071e3',
  Dining: '#ff9500',
  Transport: '#8e8e93',
  Fuel: '#5856d6',
  Utilities: '#5ac8fa',
  'Mobile & Internet': '#32ade6',
  Health: '#34a853',
  Shopping: '#af52de',
  Entertainment: '#f5a623',
  Education: '#30b0c7',
  Subscriptions: '#ff2d55',
  Gifts: '#ffcc00',
  Salary: '#0071e3',
  Freelance: '#34a853',
  Business: '#5856d6',
  Interest: '#30b0c7',
  Refund: '#8e8e93',
  Other: '#c7c7cc',
};
export const categoryColor = (c: string) =>
  CAT_COLORS[c] || `hsl(${[...c].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360} 55% 55%)`;

/** Income & expense only — transfers and manual adjustments don't count as money earned or spent. */
export const isReportable = (t: Transaction) => t.kind === 'income' || t.kind === 'expense';

/** Signed effect of one transaction on one account. */
export function effectOn(t: Transaction, accountId: ID): number {
  if (t.kind === 'transfer') {
    if (t.accountId === accountId) return -Math.abs(t.amount);
    if (t.toAccountId === accountId) return Math.abs(t.amount);
    return 0;
  }
  return t.accountId === accountId ? t.amount : 0;
}

export function accountBalance(acc: Account, tx: Transaction[], upToDate?: string): number {
  let b = acc.openingBalance;
  for (const t of tx) {
    if (upToDate && t.date > upToDate) continue;
    b += effectOn(t, acc.id);
  }
  return Math.round(b * 100) / 100;
}

export function balanceMap(accounts: Account[], tx: Transaction[]): Record<ID, number> {
  const m: Record<ID, number> = {};
  for (const a of accounts) m[a.id] = a.openingBalance;
  for (const t of tx) {
    if (t.kind === 'transfer') {
      if (t.accountId in m) m[t.accountId] -= Math.abs(t.amount);
      if (t.toAccountId && t.toAccountId in m) m[t.toAccountId] += Math.abs(t.amount);
    } else if (t.accountId in m) m[t.accountId] += t.amount;
  }
  for (const k in m) m[k] = Math.round(m[k] * 100) / 100;
  return m;
}

export function netWorth(accounts: Account[], tx: Transaction[]) {
  const m = balanceMap(accounts, tx);
  const live = accounts.filter((a) => !a.archived);
  const assets = sum(live.filter((a) => m[a.id] > 0).map((a) => m[a.id]));
  const liabilities = -sum(live.filter((a) => m[a.id] < 0).map((a) => m[a.id]));
  return { total: assets - liabilities, assets, liabilities, balances: m };
}

/** Transactions ordered newest first, ties broken by entry time. */
export const sortTx = (tx: Transaction[]) =>
  [...tx].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));

/** Running balance of `accountId` after each of its transactions (for statement-style lists). */
export function runningBalances(acc: Account, tx: Transaction[]): Record<ID, number> {
  const mine = tx.filter((t) => effectOn(t, acc.id) !== 0);
  const asc = [...mine].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
  const out: Record<ID, number> = {};
  let b = acc.openingBalance;
  for (const t of asc) {
    b += effectOn(t, acc.id);
    out[t.id] = Math.round(b * 100) / 100;
  }
  return out;
}
