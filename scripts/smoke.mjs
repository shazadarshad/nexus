import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire('/root/.nvm/versions/node/v22.23.3/lib/node_modules/@playwright/mcp/');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/playwright';
const { chromium } = require('playwright');

const root = '/projects/sandbox/nexus/dist';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.setHeader('content-type', types[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => srv.listen(0, r));
const base = `http://127.0.0.1:${srv.address().port}/`;
const out = '/projects/sandbox/.kiro/artifacts/screenshots';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));

const routes = (process.argv[2] || 'dashboard,tasks,notes,calendar,habits,focus,goals,journal,finance,analytics,settings').split(',');
await page.goto(base);
await page.waitForTimeout(600);
for (const r of routes) {
  await page.goto(base + '#/' + r);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${r}.png`, fullPage: false });
  const crash = await page.$('.crash');
  console.log(r, crash ? 'CRASH ' + (await crash.innerText()) : 'ok');
}

// interactions
if (!process.argv[3]) {
  await page.goto(base + '#/tasks');
  await page.waitForTimeout(400);
  await page.keyboard.press('n');
  await page.waitForTimeout(200);
  await page.keyboard.type('Call dentist tomorrow 4pm !high #health +Health ~15m');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/quickadd.png` });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const found = await page.locator('.task-title', { hasText: 'Call dentist' }).count();
  console.log('quickadd task created:', found);
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(200);
  await page.keyboard.type('brand');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/palette.png` });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  console.log('palette navigated to:', page.url(), await page.locator('.note-title').inputValue().catch(() => 'n/a'));
  await page.goto(base + '#/tasks');
  await page.waitForTimeout(300);
  await page.locator('.task-row').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/taskmodal.png` });
  await page.keyboard.press('Escape');
  await page.locator('.segmented button', { hasText: 'Board' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/board.png` });
  await page.goto(base + '#/calendar');
  await page.waitForTimeout(300);
  await page.locator('.segmented button', { hasText: 'Week' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/week.png` });
  await page.goto(base + '#/focus');
  await page.waitForTimeout(300);
  await page.locator('.play-btn').click();
  await page.waitForTimeout(2200);
  console.log('timer digits:', await page.locator('.timer-digits').innerText(), 'title:', await page.title());
  await page.goto(base + '#/settings');
  await page.waitForTimeout(300);
  await page.locator('.segmented button', { hasText: 'Light' }).click();
  await page.goto(base + '#/dashboard');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/dashboard-light.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/mobile.png` });
}
console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
await browser.close();
srv.close();
