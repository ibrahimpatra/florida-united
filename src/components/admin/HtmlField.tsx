'use client';
import { useRef, useState } from 'react';
import { Bold, Italic, List, Heading3, Link2, Pilcrow, Eye, Code2 } from 'lucide-react';
import { renderDescription } from '@/lib/sanitize-html';

/**
 * Text box for long descriptions that accepts plain text or simple HTML. The toolbar wraps the selected text in tags;
 * "Preview" shows exactly what shoppers will see (unsafe tags are removed there too).
 */
export function HtmlField({ value, onChange, rows = 8, dir, placeholder }: { value: string; onChange: (v: string) => void; rows?: number; dir?: 'rtl' | 'ltr'; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  const wrap = (open: string, close: string, fallback = '') => {
    const el = ref.current; if (!el) return;
    const a = el.selectionStart, b = el.selectionEnd; const sel = value.slice(a, b) || fallback;
    onChange(value.slice(0, a) + open + sel + close + value.slice(b));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + open.length, a + open.length + sel.length); });
  };
  const list = () => {
    const el = ref.current; if (!el) return;
    const a = el.selectionStart, b = el.selectionEnd; const sel = (value.slice(a, b) || 'First point\nSecond point').split('\n').filter(Boolean);
    onChange(value.slice(0, a) + '<ul>\n' + sel.map(l => `  <li>${l.replace(/^\s*[-*•]\s*/, '')}</li>`).join('\n') + '\n</ul>' + value.slice(b));
  };
  const link = () => { const u = window.prompt('Link address (https://... or /shop/...)'); if (u) wrap(`<a href="${u.replace(/"/g, '')}">`, '</a>', 'link text'); };
  const Btn = ({ onClick, title, children }: any) => (
    <button type="button" title={title} aria-label={title} onClick={onClick} className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 hover:text-gray-900">{children}</button>
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white focus-within:border-brand-400">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 px-2 py-1">
        <Btn title="Bold" onClick={() => wrap('<strong>', '</strong>', 'bold text')}><Bold className="w-4 h-4" /></Btn>
        <Btn title="Italic" onClick={() => wrap('<em>', '</em>', 'text')}><Italic className="w-4 h-4" /></Btn>
        <Btn title="Heading" onClick={() => wrap('<h3>', '</h3>', 'Heading')}><Heading3 className="w-4 h-4" /></Btn>
        <Btn title="Paragraph" onClick={() => wrap('<p>', '</p>', 'text')}><Pilcrow className="w-4 h-4" /></Btn>
        <Btn title="Bulleted list" onClick={list}><List className="w-4 h-4" /></Btn>
        <Btn title="Link" onClick={link}><Link2 className="w-4 h-4" /></Btn>
        <span className="flex-1" />
        <button type="button" onClick={() => setPreview(p => !p)} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 hover:text-brand-700 px-2 py-1">
          {preview ? <><Code2 className="w-4 h-4" />HTML</> : <><Eye className="w-4 h-4" />Preview</>}
        </button>
      </div>
      {preview
        ? <div dir={dir} className="prose prose-sm max-w-none p-3 min-h-[8rem] text-gray-700" dangerouslySetInnerHTML={{ __html: renderDescription(value) || '<p style="color:#9ca3af">Nothing to preview yet.</p>' }} />
        : <textarea ref={ref} dir={dir} lang={dir === 'rtl' ? 'ar' : undefined} value={value || ''} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
            className="w-full rounded-b-xl p-3 text-sm font-mono leading-relaxed resize-y focus:outline-none" />}
    </div>
  );
}
