// Renders brand assets (app icons + social share image) into public/.
// Usage: node scripts/brand.mjs   (run after scripts/shots.mjs so the OG image uses fresh screenshots)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_REQUIRE || '/root/.nvm/versions/node/v22.23.3/lib/node_modules/@playwright/mcp/');
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/playwright';
const { chromium } = require('playwright');

const pub = path.resolve('public');
const iconsDir = path.join(pub, 'icons');
fs.mkdirSync(iconsDir, { recursive: true });

const inter = fs.readFileSync(path.resolve('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2')).toString('base64');
const fontFace = `@font-face{font-family:Inter;src:url(data:font/woff2;base64,${inter}) format('woff2');font-weight:100 900;}`;

// The mark: ink tile, geometric N, a single blue "focus" dot.
const mark = (size, { pad = 0, radius = 0.234, bleed = false } = {}) => {
  const inner = size - pad * 2;
  const s = inner / 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${bleed ? 0 : size * radius}" fill="#1d1d1f"/>
    <g transform="translate(${pad} ${pad}) scale(${s})">
      <path d="M22 45V24l20 21V24" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="42" cy="14.6" r="3.3" fill="#2997ff"/>
    </g></svg>`;
};

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const render = async (html, w, h, file, transparent = false) => {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>${fontFace}html,body{margin:0;background:${transparent ? 'transparent' : '#fff'}}</style></head><body>${html}</body></html>`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: file, omitBackground: transparent, type: 'png' });
  await page.close();
  console.log('wrote', path.relative(process.cwd(), file));
};

await render(mark(192), 192, 192, path.join(iconsDir, 'icon-192.png'), true);
await render(mark(512), 512, 512, path.join(iconsDir, 'icon-512.png'), true);
// Maskable: full bleed, glyph kept inside the 80% safe zone.
await render(mark(512, { pad: 72, bleed: true }), 512, 512, path.join(iconsDir, 'maskable-512.png'));
// iOS applies its own rounding, so no radius.
await render(mark(180, { pad: 14, bleed: true }), 180, 180, path.join(pub, 'apple-touch-icon.png'));
await render(mark(32), 32, 32, path.join(pub, 'favicon-32.png'), true);

// Social share image (1200×630).
const shot = fs.readFileSync(path.join(pub, 'shots/dashboard.jpg')).toString('base64');
const og = `
<div style="width:1200px;height:630px;position:relative;overflow:hidden;font-family:Inter;background:#fbfbfd;">
  <div style="position:absolute;left:-120px;top:360px;width:520px;height:520px;border-radius:50%;background:#f7934c;filter:blur(110px);opacity:.28"></div>
  <div style="position:absolute;right:-160px;top:-180px;width:640px;height:520px;border-radius:50%;background:#9aa2d6;filter:blur(110px);opacity:.35"></div>
  <div style="position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:14px;">
    ${mark(44)}
    <span style="font-weight:700;font-size:20px;letter-spacing:.26em;color:#1d1d1f">NEXUS</span>
  </div>
  <div style="position:absolute;left:72px;top:170px;width:560px;">
    <div style="font-size:60px;line-height:1.05;font-weight:700;letter-spacing:-0.045em;color:#111827">Your whole day,<br><span style="color:#334155">in one quiet place.</span></div>
    <div style="margin-top:26px;font-size:23px;line-height:1.45;color:#6b7280;letter-spacing:-0.01em">Tasks, notes, calendar, habits, focus and money — private, offline, on your device.</div>
    <div style="margin-top:36px;display:inline-flex;align-items:center;height:52px;padding:0 28px;border-radius:999px;background:#111827;color:#fff;font-size:18px;font-weight:600;">Open Nexus&nbsp;›</div>
  </div>
  <div style="position:absolute;left:640px;top:96px;width:720px;border-radius:18px;padding:10px;background:#0b0b0c;box-shadow:0 40px 80px -20px rgba(0,0,0,.35),0 0 0 1px #9b9ba0;">
    <img src="data:image/jpeg;base64,${shot}" style="display:block;width:100%;border-radius:9px"/>
  </div>
</div>`;
await render(og, 1200, 630, path.join(pub, 'og-image.png'));

await browser.close();
