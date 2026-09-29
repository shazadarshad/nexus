// Regenerates the product screenshots used on the landing page (public/shots).
// Usage: npm run build && node scripts/shots.mjs && npm run build
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_REQUIRE || '/root/.nvm/versions/node/v22.23.3/lib/node_modules/@playwright/mcp/');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/playwright';
const { chromium } = require('playwright');

const root = path.resolve('dist');
const out = path.resolve('public/shots');
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(root, 'index.html');
  res.setHeader('content-type', types[path.extname(p)] || 'application/octet-stream');
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => srv.listen(0, r));
const base = `http://127.0.0.1:${srv.address().port}/`;

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
await page.goto(base + '#/dashboard');
await page.waitForTimeout(800);
// Persistence is lazy; toggle the theme twice so the store is written to localStorage.
await page.click('[aria-label="Toggle theme"]');
await page.click('[aria-label="Toggle theme"]');

const setTheme = async (theme) => {
  await page.evaluate((t) => {
    const raw = JSON.parse(localStorage.getItem('nexus-data'));
    raw.state.settings.theme = t;
    localStorage.setItem('nexus-data', JSON.stringify(raw));
  }, theme);
};
const snap = async (route, file, prep) => {
  await page.goto(base + '#/' + route);
  await page.reload();
  await page.waitForTimeout(900);
  if (prep) await prep();
  await page.mouse.move(1430, 890);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, file), type: 'jpeg', quality: 80 });
  console.log('saved', file);
};

await setTheme('light');
await snap('dashboard', 'dashboard.jpg');
await snap('tasks', 'board.jpg', async () => {
  await page.locator('.segmented button', { hasText: 'Board' }).click();
  await page.waitForTimeout(400);
});
await snap('finance', 'finance.jpg');
await setTheme('dark');
await snap('notes', 'notes-dark.jpg');
await snap('focus', 'focus-dark.jpg');
await setTheme('light');
await page.evaluate(() => localStorage.setItem('nexus-task-view', 'list'));
await browser.close();
srv.close();
