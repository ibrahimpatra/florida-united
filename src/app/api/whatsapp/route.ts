import { NextRequest, NextResponse } from 'next/server';
import { getProductById } from '@/lib/firestore';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId');

  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });

  const product = await getProductById(productId);
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://floridaunited.com';
  const productUrl = `${siteUrl}/shop/products/${product.slug}`;
  const image = product.images[0] || '';

  const message = `🔧 *${product.name}*

💵 Price: $${product.price.toFixed(2)}${product.comparePrice ? ` ~~$${product.comparePrice.toFixed(2)}~~` : ''}
📦 SKU: ${product.sku}
${product.brand ? `🏷 Brand: ${product.brand}` : ''}

${product.shortDescription || ''}

🛒 Buy here: ${productUrl}

📞 Florida United Company — Hardware & Electrical
🌐 ${siteUrl}`;

  const whatsappNumber = process.env.WHATSAPP_NUMBER || '';
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  return NextResponse.json({
    whatsappUrl,
    productUrl,
    message,
    product: {
      name: product.name,
      price: product.price,
      image,
      slug: product.slug,
    },
  });
}
