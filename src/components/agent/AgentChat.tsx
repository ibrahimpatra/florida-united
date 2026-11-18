'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, X, Send, Loader2, Check, Ban } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Pending { name: string; args: any; summary: string }
interface Msg { role: 'user' | 'assistant'; text: string; pending?: Pending[]; done?: boolean }

export function AgentChat() {
  const { isArabic, lang } = useLanguage();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const tx = (en: string, ar: string) => (isArabic ? ar : en);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy, open]);
  if (path?.startsWith('/checkout')) return null;

  const send = async (text: string) => {
    const t = text.trim(); if (!t || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', text: t }];
    setMsgs(next); setInput(''); setBusy(true);
    try {
      const r = await fetch('/api/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, messages: next.map(m => ({ role: m.role, text: m.text })) }) });
      const d = await r.json();
      setMsgs([...next, { role: 'assistant', text: d.reply || tx('Sorry, something went wrong.', 'عذراً، حدث خطأ ما.'), pending: d.pending?.length ? d.pending : undefined }]);
    } catch { setMsgs([...next, { role: 'assistant', text: tx('Connection problem. Please try again.', 'مشكلة في الاتصال، حاول مرة أخرى.') }]); }
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

  const hints = [tx('Do you have cable 2.5mm?', 'هل يوجد كيبل 2.5 مم؟'), tx('Shipping cost and delivery?', 'ما تكلفة الشحن والتوصيل؟'), tx('Where is my order?', 'أين طلبي؟')];

  if (path?.startsWith('/checkout')) return null; // never cover the Place order button
  return (
    <>
      <button onClick={() => setOpen(o => !o)} aria-label={tx('Chat assistant', 'مساعد المحادثة')}
        className="fixed bottom-4 end-3 sm:end-4 z-40 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg flex items-center justify-center">
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>
      {open && (
        <div className="fixed z-40 bottom-20 end-4 start-4 sm:start-auto sm:w-96 h-[70vh] max-h-[34rem] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-brand-600 text-white font-bold text-sm">{tx('Florida assistant', 'مساعد فلوريدا')}</div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm bg-gray-50">
            {!msgs.length && (
              <div className="space-y-2">
                <p className="text-gray-500">{tx('Ask about products, prices, delivery or your orders.', 'اسأل عن المنتجات والأسعار والتوصيل وطلباتك.')}</p>
                {hints.map(h => <button key={h} onClick={() => send(h)} className="block w-full text-start px-3 py-2 rounded-xl bg-white border border-gray-200 hover:border-brand-400">{h}</button>)}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap ${m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
                  {m.text}
                  {m.pending && !m.done && m.pending.map((p, k) => (
                    <div key={k} className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                      <p className="mb-2">{p.summary}</p>
                      <div className="flex gap-2">
                        <button onClick={() => decide(i, p, true)} className="flex-1 py-1.5 rounded-lg bg-green-600 text-white font-semibold flex items-center justify-center gap-1"><Check className="w-3.5 h-3.5" />{tx('Confirm', 'تأكيد')}</button>
                        <button onClick={() => decide(i, p, false)} className="flex-1 py-1.5 rounded-lg bg-gray-200 text-gray-700 font-semibold flex items-center justify-center gap-1"><Ban className="w-3.5 h-3.5" />{tx('Cancel', 'إلغاء')}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {busy && <div className="flex justify-start"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>}
            <div ref={end} />
          </div>
          <form onSubmit={e => { e.preventDefault(); send(input); }} className="p-2 border-t border-gray-200 flex gap-2 bg-white">
            <input value={input} onChange={e => setInput(e.target.value)} maxLength={500} placeholder={tx('Type your question...', 'اكتب سؤالك...')}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-brand-500" />
            <button disabled={busy || !input.trim()} className="px-3 rounded-xl bg-brand-600 text-white disabled:opacity-50" aria-label={tx('Send', 'إرسال')}><Send className="w-4 h-4 rtl:rotate-180" /></button>
          </form>
        </div>
      )}
    </>
  );
}
