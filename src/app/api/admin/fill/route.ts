import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { aiConfigured, explainAi } from '@/lib/ai';
import { SPECS, missingFields, fillEntity } from '@/lib/entity-fill';

export const dynamic = 'force-dynamic';
export const maxDuration = 45;

/**
 * Admin forms: POST { collection, doc, replace?: string[] } -> { patch, provider }
 * Writes the Arabic text and SEO text that are still EMPTY in the form (not saved yet). `replace` lists fields to rewrite even if filled.
 */
async function __POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || String(session.user.role).toLowerCase() !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!aiConfigured()) return NextResponse.json({ error: 'AI needs GEMINI_API_KEY or OPENAI_API_KEY in the server environment.' }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const spec = SPECS[String(b.collection || '')];
  if (!spec || typeof b.doc !== 'object' || !b.doc) return NextResponse.json({ error: 'Unknown item type.' }, { status: 400 });
  const replace: string[] = Array.isArray(b.replace) ? b.replace.map(String) : [];
  const doc = { ...b.doc }; for (const k of replace) delete doc[k];            // treat the chosen fields as empty so they are rewritten
  if (!String(doc[spec.nameField] || '').trim()) return NextResponse.json({ error: `Write the ${spec.nameField === 'name' ? 'name' : 'title'} first.` }, { status: 400 });
  const keys = missingFields(spec, doc);
  if (!keys.length) return NextResponse.json({ patch: {}, note: 'Everything is already filled in.' });
  try { return NextResponse.json(await fillEntity(spec, doc, keys, { job: 'live' })); }
  catch (e: any) { return NextResponse.json({ error: explainAi(e) }, { status: 502 }); }
}
export const POST = withLog('POST', '/api/admin/fill', __POST);
