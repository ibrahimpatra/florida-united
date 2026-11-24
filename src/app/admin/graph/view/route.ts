import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { readFile } from 'fs/promises';
import path from 'path';
import { authOptions } from '@/lib/auth';
import { isSuperSession } from '@/lib/roles';

export const dynamic = 'force-dynamic';

/** The 3D codebase graph (built by graphify, see docs/graphify). Super admin only; read from the deployed files on the server. */
export async function GET() {
  if (!(await isSuperSession(await getServerSession(authOptions)))) return new NextResponse('Not allowed', { status: 403 });
  try {
    const html = await readFile(path.join(process.cwd(), 'docs', 'graphify', 'graph-3d.html'), 'utf8');
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });
  } catch { return new NextResponse('The graph file is missing (docs/graphify/graph-3d.html).', { status: 404 }); }
}
