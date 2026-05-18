import { NextRequest, NextResponse } from 'next/server';
import { SITE_CONFIG } from '@/lib/siteConfig';
import { adminGetProductById } from '@/lib/firestore-admin';

export async function GET(req: NextRequest) {
  const productId = new URL(req.url).searchParams.get('productId');
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });
  try {
    const product = await adminGetProductById(productId);
    if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const url = `${process.env.NEXT_PUBLIC_APP_URL}/shop/products/${product.slug}`;
    const fmtKWD = (n: number) => `KWD ${n.toFixed(3)}`;
    const msg = [`🔧 *${product.name}*`, ``, `💰 ${fmtKWD(product.price)}${product.comparePrice ? ` ~~${fmtKWD(product.comparePrice)}~~` : ''}`, `📦 SKU: ${product.sku}`, product.brand ? `🏷 ${product.brand}` : '', ``, `🛒 ${url}`, ``, `📞 ${SITE_CONFIG.fullName}`].filter(Boolean).join('\n');
    const waNum = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || SITE_CONFIG.whatsapp;
    return NextResponse.json({ whatsappUrl: `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}`, message: msg });
  } catch (e) { return NextResponse.json({ error: 'Failed' }, { status: 500 }); }
}
