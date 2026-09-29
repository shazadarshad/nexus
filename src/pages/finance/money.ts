/** Parse what someone types into a money field: "185,000", "Rs 2,500.50", "1.5k". Returns null if empty/invalid. */
export function parseAmount(raw: string): number | null {
  const s = raw.replace(/rs\.?|lkr|,|\s/gi, '').toLowerCase();
  if (!s) return null;
  const m = s.match(/^(-?\d*\.?\d+)(k|m)?$/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  if (m[2] === 'k') n *= 1_000;
  if (m[2] === 'm') n *= 1_000_000;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
