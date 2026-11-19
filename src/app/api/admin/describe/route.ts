import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { aiText, aiConfigured, explainAi, parseJsonLoose } from '@/lib/ai';
import { log, withLog } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const FIELDS = ['description', 'shortDescription', 'descriptionAr', 'shortDescriptionAr', 'metaTitle', 'metaDesc'] as const;

/**
 * Admin product form: POST { name, nameAr?, brand?, category?, sku?, specs?, tags?, existing? }
 * -> { fields: { description, shortDescription, descriptionAr, shortDescriptionAr, metaTitle, metaDesc }, tags, provider }
 * Only facts the admin typed are used; the model is told not to invent specifications.
 */
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!aiConfigured()) return NextResponse.json({ error: 'Writing needs ANTHROPIC_API_KEY (Claude) or GEMINI_API_KEY in the server environment.' }, { status: 503 });

  const b = await req.json().catch(() => ({}));
  const str = (v: any, n = 600) => String(v ?? '').trim().slice(0, n);
  const name = str(b.name, 200);
  if (name.length < 3) return NextResponse.json({ error: 'Enter the product name first.' }, { status: 400 });
  const facts = [
    `Name: ${name}`, b.nameAr && `Arabic name: ${str(b.nameAr, 200)}`, b.brand && `Brand: ${str(b.brand, 80)}`, b.category && `Category: ${str(b.category, 120)}`,
    b.sku && `SKU: ${str(b.sku, 60)}`, b.specs && `Specifications / notes from the owner: ${str(b.specs, 1500)}`,
    Array.isArray(b.tags) && b.tags.length && `Tags: ${b.tags.slice(0, 15).map((t: any) => str(t, 30)).join(', ')}`,
    b.existing && `Current description (improve it, keep the facts): ${str(b.existing, 1500)}`,
  ].filter(Boolean).join('\n');

  try {
    const { text, provider } = await aiText({
      system:
        `You write product pages for an online hardware and electrical supplies store in Kuwait (prices in KWD). ` +
        `Use ONLY the facts provided. Never invent specifications, certifications, warranty, dimensions or numbers; if something is not given, leave it out. ` +
        `Style: clear, practical and honest, aimed at contractors and home owners; no hype, no emojis, no ALL CAPS. ` +
        `Return a JSON object with these keys: ` +
        `"shortDescription" (English, one line under 110 characters), "description" (English, 60-120 words, short paragraphs), ` +
        `"shortDescriptionAr" and "descriptionAr" (the same in natural Modern Standard Arabic with trade terms Kuwaiti customers use; keep brand names, model numbers, sizes and units like mm, V, A, W in Latin characters), ` +
        `"metaTitle" (English, max 60 characters, include the product name), "metaDesc" (English, 140-160 characters), ` +
        `"tags" (array of up to 8 short lowercase English search keywords).`,
      user: facts, json: true, maxTokens: 2500,
    });
    const out = parseJsonLoose(text);
    const fields: Record<string, string> = {};
    for (const k of FIELDS) if (typeof out[k] === 'string' && out[k].trim()) fields[k] = out[k].trim();
    const tags = Array.isArray(out.tags) ? out.tags.map((t: any) => str(t, 30).toLowerCase()).filter(Boolean).slice(0, 8) : [];
    if (!fields.description && !fields.shortDescription) {
      log.error('describe', 'model returned no usable JSON', { raw: text.slice(0, 200) });
      return NextResponse.json({ error: 'The writer returned an unexpected answer. Please try again.' }, { status: 502 });
    }
    return NextResponse.json({ fields, tags, provider });
  } catch (e: any) {
    return NextResponse.json({ error: explainAi(e) }, { status: 502 });
  }
}

export const POST = withLog('POST', '/api/admin/describe', __POST);
