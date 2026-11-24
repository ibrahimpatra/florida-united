'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, X, Send, Loader2, Check, Ban, Plus, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Pending { name: string; args: any; summary: string }
interface Msg { role: 'user' | 'assistant'; text: string; pending?: Pending[]; done?: boolean; followUps?: string[] }
const KEY = 'fk-chat-v1';

/**
 * Chat assistant. The round button opens a full-screen chat (like a normal AI chat): history is kept in this browser,
 * "New chat" starts over, Enter sends, and every answer offers two follow-up questions to tap.
 */
export function AgentChat() {
  const { isArabic, lang } = useLanguage();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const tx = (en: string, ar: string) => (isArabic ? ar : en);

  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(v)) setMsgs(v.slice(-40)); } catch { /* no saved chat */ } }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40))); } catch { /* private mode */ } }, [msgs]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy, open]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    setTimeout(() => box.current?.focus(), 50);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc); };
  }, [open]);
  if (path?.startsWith('/checkout')) return null; // never cover the Place order button

  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return;
    const next: Msg[] = [...msgs.map(m => ({ ...m, followUps: undefined })), { role: 'user', text: t }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const r = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, messages: next.slice(-12).map(m => ({ role: m.role, text: m.text })) }) });
      const raw = await r.text();
      let d: any = null; try { d = JSON.parse(raw); } catch { /* not JSON */ }
      if (!d) {
        // Vercel answers with an HTML page when the function times out (504) or crashes: say so instead of "connection problem".
        const why = r.status === 504 || r.status === 408 ? tx('That took too long. Please ask again, maybe with a shorter question.', 'استغرق الأمر وقتاً طويلاً. أعد السؤال بشكل أقصر.')
          : tx(`The server answered with an error (${r.status}). Please try again in a moment.`, `رد الخادم بخطأ (${r.status}). حاول بعد قليل.`);
        setMsgs([...next, { role: 'assistant', text: why }]);
      } else {
        setMsgs([...next, { role: 'assistant', text: d.reply || tx('Sorry, something went wrong.', 'عذراً، حدث خطأ ما.'), pending: d.pending?.length ? d.pending : undefined, followUps: Array.isArray(d.followUps) ? d.followUps.slice(0, 2) : undefined }]);
      }
    } catch { setMsgs([...next, { role: 'assistant', text: tx('No internet connection. Please check your network and try again.', 'لا يوجد اتصال بالإنترنت. تحقق من الشبكة وحاول مرة أخرى.') }]); }
    setBusy(false);
  };

  const decide = async (i: number, p: Pending, ok: boolean) => {
    setMsgs(m => m.map((x, k) => (k === i ? { ...x, done: true } : x)));
    if (!ok) { setMsgs(m => [...m, { role: 'assistant', text: tx('Cancelled. Nothing was changed.', 'تم الإلغاء، لم يتم تغيير شيء.') }]); return; }
    setBusy(true);
    try {
      const r = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: p }) });
      const d = await r.json();
      setMsgs(m => [...m, { role: 'assistant', text: d.reply }]);
    } catch { setMsgs(m => [...m, { role: 'assistant', text: tx('Could not complete the action.', 'تعذر تنفيذ الإجراء.') }]); }
    setBusy(false);
  };

  const hints = [tx('Do you have cable 2.5mm?', 'هل يوجد كيبل 2.5 مم؟'), tx('Track my last order', 'تتبع آخر طلب لي'), tx('Shipping cost and delivery?', 'ما تكلفة الشحن والتوصيل؟'), tx('Help me choose a power tool', 'ساعدني في اختيار عدة كهربائية')];
  const lastAssistant = (() => { for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === 'assistant') return i; return -1; })();

  return (
    <>
      <button onClick={() => setOpen(o => !o)} aria-label={tx('Chat assistant', 'مساعد المحادثة')}
        className="fixed bottom-24 md:bottom-4 end-3 sm:end-4 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg flex items-center justify-center">
        <MessageSquare className="w-6 h-6" />
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col" role="dialog" aria-label={tx('Florida assistant', 'مساعد فلوريدا')}>
          <header className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center"><Sparkles className="w-4 h-4" /></div>
            <h2 className="font-bold text-gray-900 flex-1">{tx('Florida assistant', 'مساعد فلوريدا')}</h2>
            <button onClick={() => { setMsgs([]); setInput(''); }} disabled={!msgs.length}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"><Plus className="w-4 h-4" />{tx('New chat', 'محادثة جديدة')}</button>
            <button onClick={() => setOpen(false)} aria-label={tx('Close', 'إغلاق')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"><X className="w-5 h-5" /></button>
          </header>

          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-5 text-[15px]">
              {!msgs.length && (
                <div className="pt-10 text-center space-y-5">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-600 text-white flex items-center justify-center"><Sparkles className="w-7 h-7" /></div>
                  <h3 className="text-xl font-bold text-gray-900">{tx('How can I help today?', 'كيف أستطيع مساعدتك اليوم؟')}</h3>
                  <p className="text-gray-500">{tx('Ask about products, prices, delivery or your orders.', 'اسأل عن المنتجات والأسعار والتوصيل وطلباتك.')}</p>
                  <div className="grid sm:grid-cols-2 gap-2 text-start">
                    {hints.map(h => <button key={h} onClick={() => send(h)} className="px-4 py-3 rounded-xl bg-white border border-gray-200 hover:border-brand-400 text-gray-700">{h}</button>)}
                  </div>
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 ${m.role === 'user' ? 'bg-brand-600 text-white whitespace-pre-wrap' : 'bg-white border border-gray-200 text-gray-800'}`}>
                    {m.role === 'user' ? m.text : <Rich text={m.text} />}
                    {m.pending && !m.done && m.pending.map((p, k) => (
                      <div key={k} className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm">
                        <p className="mb-2">{p.summary}</p>
                        <div className="flex gap-2">
                          <button onClick={() => decide(i, p, true)} className="flex-1 py-2 rounded-lg bg-green-600 text-white font-semibold flex items-center justify-center gap-1"><Check className="w-4 h-4" />{tx('Confirm', 'تأكيد')}</button>
                          <button onClick={() => decide(i, p, false)} className="flex-1 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold flex items-center justify-center gap-1"><Ban className="w-4 h-4" />{tx('Cancel', 'إلغاء')}</button>
                        </div>
                      </div>
                    ))}
                    {i === lastAssistant && !busy && m.followUps?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.followUps.map(f => <button key={f} onClick={() => send(f)} className="px-3 py-1.5 rounded-full border border-brand-200 bg-brand-50 text-brand-800 text-sm hover:bg-brand-100 text-start">{f}</button>)}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
              {busy && <div className="flex justify-start"><div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-gray-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" />{tx('Thinking...', 'جارٍ التفكير...')}</div></div>}
              <div ref={end} />
            </div>
          </div>

          <form onSubmit={e => { e.preventDefault(); send(input); }} className="border-t border-gray-200 bg-white p-3">
            <div className="max-w-3xl mx-auto flex items-end gap-2">
              <textarea ref={box} value={input} rows={1} maxLength={500} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }}
                placeholder={tx('Type your question...', 'اكتب سؤالك...')}
                className="flex-1 min-w-0 max-h-32 resize-none px-4 py-3 rounded-2xl border border-gray-300 text-[15px] focus:outline-none focus:border-brand-500" />
              <button disabled={busy || !input.trim()} className="h-12 w-12 rounded-2xl bg-brand-600 text-white disabled:opacity-50 flex items-center justify-center" aria-label={tx('Send', 'إرسال')}><Send className="w-5 h-5 rtl:rotate-180" /></button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

/** Light markdown: paragraphs, "- " bullets, **bold** and links. */
function Rich({ text }: { text: string }) {
  const lines = text.split('\n');
  const out: any[] = []; let bullets: string[] = [];
  const flush = (k: number) => { if (bullets.length) { out.push(<ul key={`u${k}`} className="list-disc ps-5 my-1 space-y-0.5">{bullets.map((b, j) => <li key={j}>{inline(b)}</li>)}</ul>); bullets = []; } };
  lines.forEach((ln, i) => {
    const b = ln.match(/^\s*[-*•]\s+(.*)$/);
    if (b) { bullets.push(b[1]); return; }
    flush(i);
    if (ln.trim()) out.push(<p key={i} className="my-1">{inline(ln)}</p>);
  });
  flush(lines.length);
  return <div className="leading-relaxed">{out}</div>;
}
function inline(t: string) {
  return t.split(/(\*\*[^*]+\*\*)/g).map((part, i) => /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{linkify(part.slice(2, -2), false)}</strong> : <span key={i}>{linkify(part, false)}</span>);
}

/** Turns [name](/shop/products/slug) and bare /shop/products/slug paths in a reply into real links, so every product the assistant mentions is one tap away. */
function linkify(text: string, plain: boolean) {
  if (plain) return text;
  const re = /\[([^\]]+)\]\((\/[^)\s]*)\)|(\/(?:shop\/products|bundles|deals|shop)[A-Za-z0-9\-_/%?=&]*)/g;
  const out: any[] = []; let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const href = m[2] || m[3]; const label = m[1] || href.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') || href;
    out.push(<a key={k++} href={href} className="underline font-semibold text-brand-700 hover:text-brand-900">{label}</a>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
