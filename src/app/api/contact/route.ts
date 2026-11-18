import { withLog } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { sendContactEmail } from '@/lib/email';
async function __POST(req: NextRequest) {
  const { name, email, subject, message } = await req.json();
  if (!name || !email || !message) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  try { await sendContactEmail(name, email, subject || 'Contact Form', message); return NextResponse.json({ success: true }); }
  catch { return NextResponse.json({ error: 'Failed to send' }, { status: 500 }); }
}

export const POST = withLog('POST', '/api/contact', __POST);
