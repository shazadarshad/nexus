export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 12)
    : Math.random().toString(36).slice(2, 14);

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/** Subsequence fuzzy match. Returns score (higher = better) or -1. */
export function fuzzy(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 0;
  const idx = t.indexOf(q);
  if (idx >= 0) return 1000 - idx * 2 - (t.length - q.length) * 0.1;
  let score = 0;
  let ti = 0;
  let streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return -1;
    streak = found === ti ? streak + 1 : 0;
    score += 10 + streak * 5 - (found - ti);
    ti = found + 1;
  }
  return score;
}

export const groupBy = <T, K extends string | number>(arr: T[], fn: (x: T) => K): Record<K, T[]> =>
  arr.reduce((acc, x) => {
    const k = fn(x);
    (acc[k] ||= []).push(x);
    return acc;
  }, {} as Record<K, T[]>);

export const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

export const download = (filename: string, content: string, type = 'application/json') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Money formatting. LKR renders the local way ("Rs 185,000"); others use Intl. */
export const fmtMoney = (n: number, currency = 'LKR', opts: { sign?: boolean; decimals?: boolean } = {}) => {
  const neg = n < 0;
  const abs = Math.abs(n);
  const hasCents = Math.round(abs * 100) % 100 !== 0;
  const digits = opts.decimals || hasCents ? 2 : 0;
  let body: string;
  if (currency === 'LKR') {
    body = `Rs ${abs.toLocaleString('en-LK', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  } else {
    try {
      body = new Intl.NumberFormat(undefined, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(abs);
    } catch {
      body = `${currency} ${abs.toFixed(digits)}`;
    }
  }
  if (neg) return `−${body}`;
  return opts.sign && n > 0 ? `+${body}` : body;
};
