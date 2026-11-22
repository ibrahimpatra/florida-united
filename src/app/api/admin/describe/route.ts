import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { aiConfigured, explainAi } from '@/lib/ai';
import { writeProductCopy } from '@/lib/product-copy';
import { log, withLog } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;


/**
 * Admin product form: POST { name, nameAr?, brand?, category?, sku?, specs?, tags?, existing? }
 * -> { fields: { description, shortDescription, descriptionAr, shortDescriptionAr, metaTitle, metaDesc }, tags, provider }
 * Only facts the admin typed are used; the model is told not to invent specifications.
 */
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!aiConfigured()) return NextResponse.json({ error: 'Writing needs GEMINI_API_KEY or OPENAI_API_KEY in the server environment.' }, { status: 503 });

  const b = await req.json().catch(() => ({}));
  const str = (v: any, n = 600) => String(v ?? '').trim().slice(0, n);
  const name = str(b.name, 200);
  if (name.length < 3) return NextResponse.json({ error: 'Enter the product name first.' }, { status: 400 });
  try {
    const { fields, tags, provider, raw } = await writeProductCopy({ name, nameAr: b.nameAr, brand: b.brand, category: b.category, sku: b.sku, specs: b.specs, tags: Array.isArray(b.tags) ? b.tags : [], existing: b.existing });
    if (!fields.description && !fields.shortDescription) {
      log.error('describe', 'model returned no usable JSON', { raw: raw.slice(0, 200) });
      return NextResponse.json({ error: 'The writer returned an unexpected answer. Please try again.' }, { status: 502 });
    }
    return NextResponse.json({ fields, tags, provider });
  } catch (e: any) {
    return NextResponse.json({ error: explainAi(e) }, { status: 502 });
  }
}

export const POST = withLog('POST', '/api/admin/describe', __POST);
