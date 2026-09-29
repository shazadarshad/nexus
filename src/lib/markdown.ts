/**
 * Small, safe Markdown renderer (HTML is escaped first).
 * Supports: headings, bold/italic/strike/highlight, inline & fenced code, links, autolinks,
 * [[wiki links]], #tags, blockquotes & callouts, ordered/unordered/task lists (toggleable),
 * tables, horizontal rules.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(src: string, existing: Set<string>): string {
  const codes: string[] = [];
  let s = src.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${c}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, t: string, alias?: string) => {
      const title = t.trim();
      const cls = existing.has(title.toLowerCase()) ? 'wikilink' : 'wikilink missing';
      return `<a class="${cls}" data-wiki="${title}">${alias || title}</a>`;
    })
    .replace(/!\[([^\]]*)\]\((https?:[^)\s]+)\)/g, '<img alt="$1" src="$2" loading="lazy"/>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+|mailto:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\s][^_]*)_/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>')
    .replace(/(^|\s)#([a-zA-Z][\w-]*)/g, '$1<span class="md-tag" data-tag="$2">#$2</span>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
}

export function renderMarkdown(md: string, existingTitles: string[] = []): string {
  const existing = new Set(existingTitles.map((t) => t.toLowerCase()));
  const lines = esc(md).split('\n');
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    const fence = line.match(/^```\s*(\w+)?/);
    if (fence) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      out.push(`<pre data-lang="${fence[1] || ''}"><code>${buf.join('\n')}</code></pre>`);
      continue;
    }

    // headings
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const id = h[2].toLowerCase().replace(/[^\w]+/g, '-');
      out.push(`<h${lvl} id="h-${id}">${inline(h[2], existing)}</h${lvl}>`);
      i++;
      continue;
    }

    // hr
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      out.push('<hr/>');
      i++;
      continue;
    }

    // blockquote / callout
    if (line.startsWith('&gt;')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith('&gt;')) buf.push(lines[i++].replace(/^&gt;\s?/, ''));
      const callout = buf[0]?.match(/^\[!(\w+)\]\s*(.*)$/);
      if (callout) {
        const kind = callout[1].toLowerCase();
        const body = buf.slice(1).map((l) => inline(l, existing)).join('<br/>');
        out.push(`<div class="callout callout-${kind}"><div class="callout-title">${callout[2] || kind}</div>${body}</div>`);
      } else {
        out.push(`<blockquote>${buf.map((l) => inline(l, existing)).join('<br/>')}</blockquote>`);
      }
      continue;
    }

    // table
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const split = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = split(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|')) rows.push(split(lines[i++]));
      out.push(
        `<table><thead><tr>${head.map((c) => `<th>${inline(c, existing)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c, existing)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`
      );
      continue;
    }

    // lists
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const l = lines[i];
        const indent = (l.match(/^\s*/)?.[0].length || 0) >= 2 ? ' class="nested"' : '';
        const task = l.match(/^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/);
        if (task) {
          const done = task[1].toLowerCase() === 'x';
          items.push(
            `<li class="task-item${done ? ' done' : ''}"${indent}><input type="checkbox" data-line="${i}" ${done ? 'checked' : ''}/> <span>${inline(task[2], existing)}</span></li>`
          );
        } else {
          items.push(`<li${indent}>${inline(l.replace(/^\s*([-*+]|\d+\.)\s+/, ''), existing)}</li>`);
        }
        i++;
      }
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    // paragraph
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|```|&gt;|\s*([-*+]|\d+\.)\s+|(\*{3,}|-{3,})\s*$)/.test(lines[i])
    )
      buf.push(lines[i++]);
    out.push(`<p>${buf.map((l) => inline(l, existing)).join('<br/>')}</p>`);
  }
  return out.join('\n');
}

/** Toggle the checkbox on a given source line. */
export function toggleTaskLine(md: string, lineNo: number): string {
  const lines = md.split('\n');
  const l = lines[lineNo];
  if (l === undefined) return md;
  lines[lineNo] = /\[ \]/.test(l) ? l.replace('[ ]', '[x]') : l.replace(/\[(x|X)\]/, '[ ]');
  return lines.join('\n');
}

export const extractWikiLinks = (md: string): string[] =>
  Array.from(md.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)).map((m) => m[1].trim());

export const extractTags = (md: string): string[] =>
  Array.from(new Set(Array.from(md.matchAll(/(?:^|\s)#([a-zA-Z][\w-]*)/g)).map((m) => m[1].toLowerCase())));

export const wordCount = (md: string) => (md.trim() ? md.trim().split(/\s+/).length : 0);

export const outline = (md: string) =>
  md
    .split('\n')
    .filter((l) => /^#{1,4}\s/.test(l))
    .map((l) => {
      const m = l.match(/^(#{1,4})\s+(.*)$/)!;
      return { level: m[1].length, text: m[2], id: 'h-' + esc(m[2]).toLowerCase().replace(/[^\w]+/g, '-') };
    });
