/**
 * Product descriptions may contain simple HTML (headings, lists, bold, links, tables, pictures). This keeps ONLY a safe allow-list and drops
 * everything else (scripts, styles, event handlers, javascript: links, iframes), so admin-typed or AI-written HTML can never run code in a shopper's browser.
 * Works on the server and in the browser (no DOM needed).
 */
const ALLOWED = new Set(['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'h4', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'blockquote', 'hr']);
const VOID = new Set(['br', 'img', 'hr']);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function safeUrl(v: string, kind: 'href' | 'src'): string {
  const u = unesc(v).replace(/[\u0000- ]+/g, '').trim();
  if (!u) return '';
  if (u.startsWith('/') && !u.startsWith('//')) return u;
  if (/^https:\/\//i.test(u) || (kind === 'href' && /^(http:\/\/|mailto:|tel:)/i.test(u))) return u;
  return '';
}

function attrsOf(tag: string, raw: string): string {
  const out: string[] = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase(); const val = m[2] ?? m[3] ?? m[4] ?? '';
    if (tag === 'a' && name === 'href') { const u = safeUrl(val, 'href'); if (u) out.push(`href="${esc(u)}"`); }
    else if (tag === 'img' && name === 'src') { const u = safeUrl(val, 'src'); if (u) out.push(`src="${esc(u)}"`); }
    else if (tag === 'img' && (name === 'alt' || name === 'title')) out.push(`${name}="${esc(unesc(val)).slice(0, 200)}"`);
    else if (tag === 'a' && name === 'title') out.push(`title="${esc(unesc(val)).slice(0, 200)}"`);
    else if ((tag === 'td' || tag === 'th') && (name === 'colspan' || name === 'rowspan') && /^\d{1,2}$/.test(val)) out.push(`${name}="${val}"`);
  }
  if (tag === 'a') out.push('rel="noopener noreferrer nofollow"', 'target="_blank"');
  if (tag === 'img') out.push('loading="lazy"');
  return out.length ? ' ' + out.join(' ') : '';
}

export function sanitizeHtml(input: string): string {
  let s = String(input ?? '').replace(/<!--[\s\S]*?-->/g, '').replace(DROP_WITH_CONTENT, '');
  let out = ''; let last = 0; const open: string[] = [];
  const re = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let m: RegExpExecArray | null;
  const text = (t: string) => { out += t.replace(/<|>/g, c => (c === '<' ? '&lt;' : '&gt;')); };
  while ((m = re.exec(s))) {
    text(s.slice(last, m.index)); last = m.index + m[0].length;
    const closing = !!m[1]; const tag = m[2].toLowerCase();
    if (!ALLOWED.has(tag)) continue;
    if (closing) { const i = open.lastIndexOf(tag); if (i >= 0) { while (open.length > i) out += `</${open.pop()}>`; } continue; }
    out += `<${tag}${attrsOf(tag, m[3] || '')}>`;
    if (!VOID.has(tag)) open.push(tag);
  }
  text(s.slice(last));
  while (open.length) out += `</${open.pop()}>`;
  return out;
}

/** What shoppers see: old plain-text descriptions (no tags) become paragraphs; everything goes through the allow-list. */
export function renderDescription(text: string): string {
  const t = String(text ?? '').trim();
  if (!t) return '';
  if (!/<\s*[a-zA-Z]/.test(t)) return t.split(/\n{2,}/).map(p => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');
  return sanitizeHtml(t);
}

/** Plain text for meta tags and JSON-LD. */
export const stripHtml = (t: string) => unesc(String(t ?? '').replace(DROP_WITH_CONTENT, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')).replace(/\s+/g, ' ').trim();
