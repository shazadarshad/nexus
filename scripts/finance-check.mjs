// End-to-end check of the finance flows in a real browser against the production build.
// Usage: npm run build && node scripts/finance-check.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_REQUIRE || '/root/.nvm/versions/node/v22.23.3/lib/node_modules/@playwright/mcp/');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/playwright';
const { chromium } = require('playwright');

const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.setHeader('content-type', types[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}/`;
const shots = process.env.SHOTS || '/projects/sandbox/.kiro/artifacts/screenshots';
const W = Number(process.env.W || 1440), H = Number(process.env.H || 900);

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
let failures = 0;
const check = (label, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures++;
};
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('nexus-data') || '{}').state);
const bal = (s, id) => {
  const a = s.accounts.find((x) => x.id === id);
  let b = a.openingBalance;
  for (const t of s.transactions) {
    if (t.kind === 'transfer') {
      if (t.accountId === id) b -= Math.abs(t.amount);
      if (t.toAccountId === id) b += Math.abs(t.amount);
    } else if (t.accountId === id) b += t.amount;
  }
  return Math.round(b * 100) / 100;
};
const snap = (n) => page.screenshot({ path: `${shots}/fin-${W}-${n}.png` });

// ── 1. Migration from an old (v2) backup with free-text accounts in USD ──
await page.goto(base + '#/dashboard');
await page.waitForTimeout(600);
// Persistence is lazy; make one change so the store is written.
await page.click('[aria-label="Toggle theme"]');
await page.click('[aria-label="Toggle theme"]');
await page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('nexus-data') || 'null');
  const s = raw?.state;
  if (!s) return;
  s.version = 2;
  s.settings.currency = 'USD';
  delete s.accounts;
  s.transactions = [
    { id: 'old1', date: '2026-09-01', amount: 1000, category: 'Salary', note: 'old salary', account: 'Checking' },
    { id: 'old2', date: '2026-09-02', amount: -250, category: 'Groceries', note: '', account: 'Checking' },
    { id: 'old3', date: '2026-09-03', amount: -40, category: 'Dining', note: '', account: 'Credit Card' },
  ];
  localStorage.setItem('nexus-data', JSON.stringify({ state: s, version: 2 }));
});
await page.reload();
await page.waitForTimeout(800);
let s = await state();
check('v2 → v3 migration creates accounts from old names', s.accounts?.length === 2, s.accounts?.map((a) => `${a.name}:${a.type}`).join(', '));
check('migrated transactions get kind + accountId', s.transactions.every((t) => t.kind && t.accountId), `${s.transactions.length} tx`);
check('migrated currency becomes LKR', s.settings.currency === 'LKR');
const checking = s.accounts.find((a) => a.name === 'Checking');
check('migrated balance is preserved (1000 − 250 = 750)', bal(s, checking.id) === 750);

// ── 2. Fresh start: erase, then add an account with an opening balance ──
await page.evaluate(() => localStorage.removeItem('nexus-fin-tab'));
await page.goto(base + '#/settings');
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Erase everything' }).click();
await page.getByRole('button', { name: 'Erase', exact: true }).click();
await page.waitForTimeout(300);
await page.goto(base + '#/finance');
await page.waitForTimeout(700);
await snap('0-empty');
await page.getByRole('button', { name: 'Add your first account' }).click();
await page.waitForTimeout(300);
await page.getByLabel('Account name').fill('Commercial Bank');
await page.getByPlaceholder('Commercial Bank').fill('Commercial Bank');
await page.getByPlaceholder('4821').fill('4821');
await page.locator('.money-field input').fill('250,000');
await snap('1-add-account');
await page.getByRole('button', { name: 'Add account', exact: true }).click();
await page.waitForTimeout(300);
s = await state();
const bank = s.accounts[0];
check('account created with opening balance Rs 250,000', s.accounts.length === 1 && bank.openingBalance === 250000);

// Cash account
await page.getByRole('button', { name: 'New account' }).click();
await page.waitForTimeout(250);
await page.getByRole('radio', { name: 'Cash' }).click();
await page.getByLabel('Account name').fill('Wallet cash');
await page.locator('.money-field input').fill('12500');
await page.getByRole('button', { name: 'Add account', exact: true }).click();
await page.waitForTimeout(300);
s = await state();
const cash = s.accounts.find((a) => a.name === 'Wallet cash');
check('second account (cash) created', !!cash && cash.type === 'cash' && cash.openingBalance === 12500);

// ── 3. Expense from bank updates balance ──
const openTx = async () => {
  await page.getByRole('button', { name: 'Add transaction' }).first().click();
  await page.waitForTimeout(300);
};
const pickAccount = async (label, name) => {
  await page.locator('.field', { hasText: label }).locator('.acct-chip', { hasText: name }).click();
};
await openTx();
await page.getByLabel('Amount').fill('4,850');
await pickAccount('Paid from', 'Commercial Bank');
await page.getByRole('button', { name: 'Groceries' }).click();
await page.getByLabel('Note').fill('Keells');
const previewTxt = await page.locator('.bal-preview').innerText();
check('balance preview shows before → after', /250,000/.test(previewTxt) && /245,150/.test(previewTxt), previewTxt.replace(/\n/g, ' '));
await snap('2-expense');
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.waitForTimeout(300);
s = await state();
check('expense Rs 4,850 → bank balance Rs 245,150', bal(s, bank.id) === 245150);

// ── 4. Income ──
await openTx();
await page.getByRole('tab', { name: /Income/ }).click();
await page.getByLabel('Amount').fill('185000');
await pickAccount('Into account', 'Commercial Bank');
await page.getByRole('button', { name: 'Salary' }).click();
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.waitForTimeout(300);
s = await state();
check('income Rs 185,000 → bank balance Rs 430,150', bal(s, bank.id) === 430150);

// ── 5. Transfer bank → cash moves money both sides, not counted as spending ──
await openTx();
await page.getByRole('tab', { name: /Transfer/ }).click();
await page.getByLabel('Amount').fill('20k');
await pickAccount('From', 'Commercial Bank');
await pickAccount('To', 'Wallet cash');
await snap('3-transfer');
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.waitForTimeout(300);
s = await state();
check('transfer 20k: bank 430,150 → 410,150', bal(s, bank.id) === 410150);
check('transfer 20k: cash 12,500 → 32,500', bal(s, cash.id) === 32500);
const outTxt = await page.locator('.worth-io').innerText();
check('transfer not counted as money out (out = Rs 4,850)', /Rs 4,850/.test(outTxt), outTxt.replace(/\n/g, ' '));
const worthTxt = await page.locator('.worth-total').innerText();
check('net worth = 410,150 + 32,500 = Rs 442,650', worthTxt.includes('442,650'), worthTxt);

// ── 6. Edit a transaction amount re-computes balance ──
await page.getByRole('tab', { name: 'Transactions' }).click();
await page.waitForTimeout(300);
await page.locator('.tx-row', { hasText: 'Keells' }).click();
await page.waitForTimeout(300);
await page.getByLabel('Amount').fill('5000');
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.waitForTimeout(300);
s = await state();
check('editing expense 4,850 → 5,000 updates bank to 410,000', bal(s, bank.id) === 410000);

// ── 7. Delete + undo ──
await page.locator('.tx-row', { hasText: 'Keells' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Delete' }).click();
await page.waitForTimeout(250);
s = await state();
check('delete expense restores bank to 415,000', bal(s, bank.id) === 415000);
await page.getByRole('button', { name: 'Undo' }).click();
await page.waitForTimeout(250);
s = await state();
check('undo brings it back (410,000)', bal(s, bank.id) === 410000);

// ── 8. Set balance by hand → adjustment, history kept ──
await page.getByRole('tab', { name: 'Accounts' }).click();
await page.waitForTimeout(300);
await page.locator('.acct-card', { hasText: 'Commercial Bank' }).getByRole('button', { name: 'Edit' }).click();
await page.waitForTimeout(300);
await page.locator('.money-field input').fill('408,200');
await page.getByRole('button', { name: 'Save', exact: true }).click();
await page.waitForTimeout(300);
s = await state();
const adj = s.transactions.find((t) => t.kind === 'adjustment');
check('setting balance to 408,200 records a −1,800 adjustment', bal(s, bank.id) === 408200 && adj?.amount === -1800);
const out2 = await page.locator('.worth-io').innerText();
check('adjustment not counted as spending', /Rs 5,000/.test(out2), out2.replace(/\n/g, ' '));

// ── 9. Account filter shows running balance ──
await page.locator('.acct-card', { hasText: 'Commercial Bank' }).locator('.acct-card-main').click();
await page.waitForTimeout(400);
const runs = await page.locator('.tx-running').allInnerTexts();
check('account view shows running balance per row', runs.length >= 3 && runs[0].includes('408,200'), runs.join(' | '));
await snap('4-account-statement');

// ── 10. Persistence across reload ──
await page.reload();
await page.waitForTimeout(700);
s = await state();
check('balances persist after reload', bal(s, bank.id) === 408200 && bal(s, cash.id) === 32500);

// ── 11. Demo data renders ──
await page.goto(base + '#/settings');
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Load demo data' }).click();
await page.getByRole('button', { name: 'Replace' }).click();
await page.waitForTimeout(300);
await page.evaluate(() => localStorage.setItem('nexus-fin-tab', 'overview'));
await page.goto(base + '#/finance');
await page.waitForTimeout(800);
await snap('5-overview');
await page.getByRole('tab', { name: 'Accounts' }).click();
await page.waitForTimeout(300);
await snap('6-accounts');
await page.getByRole('tab', { name: 'Transactions' }).click();
await page.waitForTimeout(300);
await snap('7-transactions');
await page.getByRole('tab', { name: 'Budgets' }).click();
await page.waitForTimeout(300);
await snap('8-budgets');
await page.goto(base + '#/dashboard');
await page.waitForTimeout(600);
const dash = await page.locator('section.card', { hasText: 'Net worth' }).innerText().catch(() => '');
check('dashboard shows net worth in Rs', /Net worth/.test(dash) && /Rs /.test(dash));

check('no console/page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
console.log(failures ? `\n${failures} check(s) failed` : '\nAll finance checks passed');
await browser.close();
srv.close();
process.exit(failures ? 1 : 0);
