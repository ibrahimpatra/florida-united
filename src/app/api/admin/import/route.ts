import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { generateSlug } from '@/lib/utils';
import { FieldValue } from 'firebase-admin/firestore';

// Max 500 per Firestore batch
const BATCH_SIZE = 400;

// Expected CSV columns (case-insensitive header match)
const REQUIRED = ['name', 'sku', 'price', 'stock', 'categoryid'];

function normaliseHeader(h: string): string {
  return h.toLowerCase().replace(/[\s_-]+/g, '');
}

function mapRow(headers: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((h, i) => { obj[normaliseHeader(h)] = (row[i] || '').trim(); });
  return obj;
}

function parseNum(val: string, fallback = 0): number {
  const n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'admin')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { rows } = await req.json() as { rows: string[][] };

    if (!rows || rows.length < 2)
      return NextResponse.json({ error: 'No data rows found' }, { status: 400 });

    const rawHeaders = rows[0];
    const normHeaders = rawHeaders.map(normaliseHeader);

    // Validate required columns exist
    const missing = REQUIRED.filter(r => !normHeaders.includes(r));
    if (missing.length > 0)
      return NextResponse.json({ error: `Missing required columns: ${missing.join(', ')}` }, { status: 400 });

    const db = getAdminDb();
    const now = new Date().toISOString();

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Process in chunks of BATCH_SIZE
    const dataRows = rows.slice(1).filter(r => r.some(c => c.trim()));

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const chunk = dataRows.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const row of chunk) {
        const r = mapRow(rawHeaders, row);

        if (!r.name || !r.sku) { skipped++; continue; }

        const price = parseNum(r.price);
        if (price <= 0) { errors.push(`Row ${i+2}: Invalid price for "${r.name}"`); skipped++; continue; }

        const slug = generateSlug(r.name);
        const ref  = db.collection('products').doc();

        const productData = {
          name:             r.name,
          slug:             `${slug}-${ref.id.slice(0,6)}`, // ensure unique
          description:      r.description || r.name,
          shortDescription: r.shortdescription || '',
          sku:              r.sku,
          barcode:          r.barcode || '',
          price:            price,
          comparePrice:     parseNum(r.compareprice) || undefined,
          costPrice:        parseNum(r.costprice) || undefined,
          stock:            Math.round(parseNum(r.stock)),
          lowStockAlert:    Math.round(parseNum(r.lowstockalert, 5)),
          weight:           parseNum(r.weight) || undefined,
          categoryId:       r.categoryid || '',
          categoryName:     r.categoryname || '',
          brand:            r.brand || '',
          images:           r.image ? [r.image] : [],
          tags:             r.tags ? r.tags.split(/[,;|]/).map((t: string) => t.trim()).filter(Boolean) : [],
          isFeatured:       r.isfeatured?.toLowerCase() === 'true' || r.isfeatured === '1',
          isNewArrival:     r.isnewarrival?.toLowerCase() === 'true' || r.isnewarrival === '1',
          isOnSale:         r.isonsale?.toLowerCase() === 'true' || r.isonsale === '1',
          isActive:         r.isactive === undefined || r.isactive?.toLowerCase() !== 'false',
          isReturnable:     r.isreturnable === undefined || r.isreturnable?.toLowerCase() !== 'false',
          returnDays:       Math.round(parseNum(r.returndays, 14)),
          metaTitle:        r.metatitle || r.name,
          metaDesc:         r.metadesc || r.description || '',
          avgRating:        0,
          totalReviews:     0,
          totalSold:        0,
          createdAt:        now,
          updatedAt:        now,
        };

        batch.set(ref, productData);
        created++;
      }

      await batch.commit();
    }

    return NextResponse.json({ success: true, created, skipped, errors: errors.slice(0, 20) });
  } catch (err) {
    console.error('Bulk import error:', err);
    return NextResponse.json({ error: 'Import failed. Check your CSV format.' }, { status: 500 });
  }
}
