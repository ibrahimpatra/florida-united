/**
 * Every assistant answer ends with two short follow-up questions the shopper can tap, like a normal AI chat.
 * The model is told to finish with a line:  FOLLOWUPS: question one | question two
 * This splits that line off the answer. If the model forgot it, sensible defaults are used.
 */
export const FOLLOWUP_RULE = `After your answer, add ONE final line exactly in this form: FOLLOWUPS: <short question 1> | <short question 2>. They must be things the customer might ask next (max 8 words each, written as the customer would say them, in the same language as the chat). Never skip this line.`;

export function splitFollowUps(raw: string, lang: string): { text: string; followUps: string[] } {
  const m = String(raw || '').match(/\n?\s*\**FOLLOW-?UPS?\**\s*:\s*(.+)\s*$/i);
  let followUps: string[] = [];
  let text = String(raw || '');
  if (m) {
    text = text.slice(0, m.index).trim();
    followUps = m[1].split('|').map(s => s.replace(/^[\s\-*"“]+|[\s"”]+$/g, '').trim()).filter(s => s && s.length <= 90).slice(0, 2);
  }
  if (followUps.length < 2 && text) {
    const d = lang === 'ar' ? ['ما هي خيارات التوصيل؟', 'هل يوجد منتجات مشابهة؟'] : ['What are the delivery options?', 'Do you have similar products?'];
    followUps = [...followUps, ...d.filter(x => !followUps.includes(x))].slice(0, 2);
  }
  return { text, followUps };
}
