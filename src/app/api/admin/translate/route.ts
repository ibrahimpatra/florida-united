import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { aiText, aiConfigured, explainAi, parseJsonLoose } from '@/lib/ai';
import { log, withLog } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Admin form helper: POST { texts: { fieldName: "English text", ... }, context?: "hardware store product" }
 * -> { translations: { fieldName: "النص العربي", ... } }. Only the fields sent are translated.
 */
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!aiConfigured()) return NextResponse.json({ error: 'Translation needs ANTHROPIC_API_KEY or GEMINI_API_KEY in the server environment.' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const texts: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.texts || {})) {
    const t = String(v ?? '').trim();
    if (t && /[A-Za-z0-9]/.test(t)) texts[String(k).slice(0, 40)] = t.slice(0, 2000);
  }
  if (!Object.keys(texts).length) return NextResponse.json({ error: 'Nothing to translate. Fill in the English fields first.' }, { status: 400 });

  try {
    const { text: raw } = await aiText({
      system: `You translate text for an online hardware and electrical supplies store in Kuwait from English to Modern Standard Arabic. ` +
        `Context: ${String(body.context || 'store content').slice(0, 120)}. Rules: keep brand names, model numbers, SKUs, sizes and units (mm, V, A, W, KWD) in Latin characters exactly as written; ` +
        `use natural trade terminology Kuwaiti customers use; keep it short like the original; no emojis; do not add explanations. ` +
        `Return ONLY a JSON object with exactly the same keys as the input and the Arabic translations as values.`,
      user: JSON.stringify(texts), json: true, fast: true, maxTokens: 4096,
    });
    const out: any = parseJsonLoose(raw);
    const translations: Record<string, string> = {};
    for (const k of Object.keys(texts)) if (typeof out?.[k] === 'string' && out[k].trim()) translations[k] = out[k].trim();
    if (!Object.keys(translations).length) {
      log.error('translate', 'model returned no usable JSON', { raw: raw.slice(0, 200) });
      return NextResponse.json({ error: 'The translator returned an unexpected answer. Please try again.' }, { status: 502 });
    }
    return NextResponse.json({ translations });
  } catch (e: any) {
    return NextResponse.json({ error: explainAi(e) }, { status: 502 });
  }
}

export const POST = withLog('POST', '/api/admin/translate', __POST);
