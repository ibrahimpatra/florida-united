import { CAIRO_REGULAR_B64, CAIRO_BOLD_B64 } from './pdf-fonts';
/**
 * Minimal bidirectional text drawing for pdfkit (which has no bidi support).
 * Arabic letters are shaped by fontkit, but pdfkit lays text out left-to-right, so a
 * line mixing Arabic with digits/Latin comes out scrambled. This splits a string into
 * Arabic runs and non-Arabic runs and places them right-to-left (Arabic base direction).
 */

export const FONT_AR = 'FK-Cairo';
export const FONT_AR_BOLD = 'FK-Cairo-Bold';
const AR = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
export const hasAr = (s: string) => AR.test(s || '');

export function registerFonts(doc: any) {
  doc.registerFont(FONT_AR, Buffer.from(CAIRO_REGULAR_B64, 'base64'));
  doc.registerFont(FONT_AR_BOLD, Buffer.from(CAIRO_BOLD_B64, 'base64'));
}

type Run = { text: string; rtl: boolean };

function runsOf(text: string): Run[] {
  const strong: Array<'A' | 'L' | 'N'> = [...text].map(c => (AR.test(c) ? 'A' : /[A-Za-z0-9]/.test(c) ? 'L' : 'N'));
  const chars = [...text];
  const types: Array<'A' | 'L'> = [];
  for (let i = 0; i < chars.length; i++) {
    if (strong[i] !== 'N') { types.push(strong[i] as 'A' | 'L'); continue; }
    // neutral: take the type of both neighbours when they agree, else the base direction (Arabic)
    let p = i - 1; while (p >= 0 && strong[p] === 'N') p--;
    let n = i + 1; while (n < chars.length && strong[n] === 'N') n++;
    const prev = p >= 0 ? strong[p] : null, next = n < chars.length ? strong[n] : null;
    types.push(prev && prev === next ? (prev as 'A' | 'L') : 'A');
  }
  const runs: Run[] = [];
  chars.forEach((c, i) => {
    const rtl = types[i] === 'A';
    const last = runs[runs.length - 1];
    if (last && last.rtl === rtl) last.text += c; else runs.push({ text: c, rtl });
  });
  return runs;
}

/** Width of a (possibly mixed) string in the current font size. */
export function bidiWidth(doc: any, text: string): number {
  return runsOf(text).reduce((w, r) => {
    doc.font(FONT_AR); // Cairo covers Latin + Arabic
    return w + doc.widthOfString(r.text, r.rtl ? { features: ['rtla'] } : {});
  }, 0);
}

/** Draw one line of mixed text so that its RIGHT edge sits at `rightX` (Arabic base direction). */
export function drawBidiLine(doc: any, text: string, rightX: number, y: number, bold = false) {
  let x = rightX;
  for (const r of runsOf(text)) { // logical order: first run is the right-most
    doc.font(bold ? FONT_AR_BOLD : FONT_AR);
    const opts = r.rtl ? { features: ['rtla'] } : {};
    x -= doc.widthOfString(r.text, opts);
    doc.text(r.text, x, y, { ...opts, lineBreak: false });
  }
}

/** Wrap by words to `width`, return lines (logical order). */
export function wrapLines(doc: any, text: string, width: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = []; let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    doc.font(FONT_AR);
    if (bidiWidth(doc, t) > width && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
