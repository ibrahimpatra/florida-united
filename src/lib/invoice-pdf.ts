import PDFDocument from 'pdfkit';
import { SITE_CONFIG } from '@/lib/siteConfig';
import { registerFonts, drawBidiLine, wrapLines, hasAr } from '@/lib/pdf-bidi';

const kd = (n: number) => `KWD ${(Number(n) || 0).toFixed(3)}`;
const clean = (s: any) => String(s ?? '').replace(/\s+/g, ' ').trim();
const asDate = (v: any) => {
  const d = v?.toDate ? v.toDate() : new Date(v);
  if (isNaN(+d)) return '';
  const k = new Date(+d + 3 * 3600e3); // Kuwait time
  return `${String(k.getUTCDate()).padStart(2, '0')}/${String(k.getUTCMonth() + 1).padStart(2, '0')}/${k.getUTCFullYear()}`;
};

const PAY_METHOD: Record<string, [string, string]> = {
  cod: ['Cash on Delivery', 'الدفع عند الاستلام'],
  card: ['Card (Stripe)', 'بطاقة (Stripe)'], tap: ['Online payment', 'دفع إلكتروني'], stripe: ['Online payment', 'دفع إلكتروني'],
};
const PAY_STATUS: Record<string, [string, string]> = {
  paid: ['Paid', 'مدفوع'], pending: ['Pending', 'قيد الانتظار'], failed: ['Failed', 'فشل'],
  refunded: ['Refunded', 'مسترد'], refund_pending: ['Refund pending', 'استرداد قيد المعالجة'],
};


export async function buildInvoicePdf(o: any): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `Invoice ${o.orderNumber}`, Author: SITE_CONFIG.fullName } });
  registerFonts(doc);
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>(res => doc.on('end', () => res(Buffer.concat(chunks))));

  const L = 40, R = 555, navy = '#1e3a5f', grey = '#6b7280', ink = '#111827';
  // Latin text in Helvetica; anything containing Arabic goes through the bidi drawer (Cairo).
  const en = (t: string, x: number, y: number, o: any = {}) => doc.font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(o.size || 9).fillColor(o.color || ink).text(t, x, y, { lineBreak: false, ...o.opts });
  const ar = (t: string, rightX: number, y: number, o: any = {}) => { doc.fontSize(o.size || 9).fillColor(o.color || ink); drawBidiLine(doc, t, rightX, y, !!o.bold); };
  /** any string, left-aligned if Latin, right-aligned at rightX if it has Arabic */
  const any = (t: string, x: number, rightX: number, y: number, o: any = {}) => hasAr(t) ? ar(t, rightX, y, o) : en(t, x, y, o);

  // ── Letterhead ──
  doc.rect(0, 0, 595, 96).fill(navy);
  en(SITE_CONFIG.fullName, L, 22, { bold: true, size: 18, color: '#fff' });
  en(SITE_CONFIG.tagline, L, 44, { size: 9, color: '#dbe5f1' });
  en(SITE_CONFIG.addressFull, L, 60, { size: 8.5, color: '#dbe5f1' });
  en(`${SITE_CONFIG.phone}   |   ${SITE_CONFIG.email}`, L, 73, { size: 8.5, color: '#dbe5f1' });
  ar(SITE_CONFIG.fullNameAr, R, 18, { bold: true, size: 18, color: '#fff' });
  ar(SITE_CONFIG.taglineAr, R, 44, { size: 9, color: '#dbe5f1' });
  ar(SITE_CONFIG.addressFullAr, R, 60, { size: 8.5, color: '#dbe5f1' });

  // ── Title ──
  en('INVOICE', L, 110, { bold: true, size: 20, color: navy });
  ar('فاتورة', R, 106, { bold: true, size: 20, color: navy });

  // ── Meta (left) & Bill-to (right) ──
  const meta: Array<[string, string, string]> = [
    ['Invoice No.', clean(o.orderNumber), 'رقم الفاتورة'],
    ['Date', asDate(o.createdAt), 'التاريخ'],
    ['Payment', (PAY_METHOD[String(o.paymentMethod).toLowerCase()] || [clean(o.paymentMethod).toUpperCase(), ''])[0], 'طريقة الدفع'],
    ['Status', (PAY_STATUS[o.paymentStatus] || [clean(o.paymentStatus), ''])[0], 'حالة الدفع'],
  ];
  let y = 142;
  meta.forEach(([l, v, a]) => {
    en(l, L, y, { bold: true, color: grey, size: 8.5 }); en(v, L + 72, y, { size: 9.5, bold: l === 'Invoice No.' });
    ar(a, 290, y - 1, { color: grey, size: 8.5 });
    y += 16;
  });
  const sa = o.shippingAddress || {};
  const name = clean(sa.name || `${sa.firstName || ''} ${sa.lastName || ''}` || o.userName);
  const addrParts = [sa.block && `Block ${sa.block}`, sa.street || sa.address1, sa.building && `Bldg ${sa.building}`, sa.floor && `Floor ${sa.floor}`, sa.apartment && `Apt ${sa.apartment}`, sa.area, sa.city, sa.governorate].filter(Boolean).map(clean);
  const lines = [name, ...wrapLines(doc, addrParts.join(', '), 215), clean(sa.phone || o.userPhone), clean(o.userEmail)].filter(Boolean);
  en('Bill / Ship To', 320, 138, { bold: true, color: navy, size: 9 }); ar('العميل / عنوان الشحن', R, 137, { bold: true, color: navy, size: 9 });
  let by = 155;
  lines.forEach((ln, i) => { any(ln, 320, R, by, { size: 9, bold: i === 0 }); by += 13; });

  // ── Items table ──
  y = Math.max(y, by) + 14;
  const colQty = 340, colUnit = 385, colTot = 470;
  const head = () => {
    doc.rect(L, y, R - L, 26).fill(navy);
    en('#', L + 6, y + 8, { bold: true, color: '#fff', size: 8.5 });
    en('Item', L + 28, y + 4, { bold: true, color: '#fff', size: 8.5 }); ar('الصنف', 330, y + 12, { bold: true, color: '#fff', size: 8 });
    const col = (e: string, a: string, x: number, w: number) => {
      en(e, x, y + 4, { bold: true, color: '#fff', size: 8.5, opts: { width: w, align: 'right', lineBreak: false } });
      ar(a, x + w, y + 12, { bold: true, color: '#fff', size: 8 });
    };
    col('Qty', 'الكمية', colQty, 36); col('Unit price', 'سعر الوحدة', colUnit, 78); col('Total', 'الإجمالي', colTot, R - colTot - 6);
    y += 30;
  };
  head();
  (o.items || []).forEach((it: any, i: number) => {
    const nameEn = clean(it.productName || it.name) + (it.variantName ? ` (${clean(it.variantName)})` : '');
    const nameAr = clean(it.productNameAr) + (it.variantNameAr ? ` (${clean(it.variantNameAr)})` : '');
    const nameLines = wrapLines(doc, nameEn, 285);
    const rowH = nameLines.length * 12 + (nameAr ? 15 : 0) + 8;
    if (y + rowH > 760) { doc.addPage(); y = 50; head(); }
    en(String(i + 1), L + 6, y, { size: 9 });
    let ny = y;
    nameLines.forEach(l => { any(l, L + 28, 330, ny, { size: 9 }); ny += 12; });
    if (nameAr) ar(nameAr, 330, ny, { size: 9, color: '#374151' });
    en(String(it.quantity), colQty, y, { opts: { width: 36, align: 'right', lineBreak: false } });
    en(kd(it.price), colUnit, y, { opts: { width: 78, align: 'right', lineBreak: false } });
    en(kd(it.total), colTot, y, { opts: { width: R - colTot - 6, align: 'right', lineBreak: false } });
    y += rowH;
    doc.moveTo(L, y - 3).lineTo(R, y - 3).strokeColor('#e5e7eb').lineWidth(0.5).stroke();
  });

  // ── Totals ──
  if (y > 640) { doc.addPage(); y = 50; }
  y += 8;
  const row = (e: string, a: string, val: string, bold = false) => {
    en(e, 300, y, { bold, size: bold ? 11 : 9.5 }); ar(a, 465, y - 1, { bold, size: bold ? 11 : 9, color: bold ? ink : grey });
    en(val, 470, y, { bold, size: bold ? 11 : 9.5, opts: { width: R - 476, align: 'right', lineBreak: false } });
    y += bold ? 22 : 16;
  };
  row('Subtotal', 'المجموع الفرعي', kd(o.subtotal));
  if (o.discount > 0) row(`Discount${o.couponCode ? ` (${clean(o.couponCode)})` : ''}`, 'الخصم', `- ${kd(o.discount)}`);
  row('Delivery', 'التوصيل', o.shippingCost > 0 ? kd(o.shippingCost) : 'FREE');
  if (o.codFee > 0) row('COD fee', 'رسوم الدفع عند الاستلام', kd(o.codFee));
  row('VAT (0%)', 'ضريبة القيمة المضافة', kd(0));
  doc.moveTo(300, y).lineTo(R, y).strokeColor(navy).lineWidth(1).stroke(); y += 7;
  row('TOTAL', 'الإجمالي', kd(o.total), true);

  // ── Notes ──
  y += 18;
  if (y > 740) { doc.addPage(); y = 50; }
  en('No VAT is charged: the State of Kuwait does not currently levy value-added tax. All amounts are in Kuwaiti Dinar (KWD).', L, y, { size: 8, color: grey, opts: { width: R - L, lineBreak: true } });
  ar('لا تُحتسب ضريبة القيمة المضافة لعدم فرضها حاليًا في دولة الكويت. جميع المبالغ بالدينار الكويتي.', R, y + 22, { size: 8.5, color: grey });
  en('This is a computer-generated invoice and does not require a signature.', L, y + 40, { size: 8, color: grey });
  ar('هذه فاتورة صادرة إلكترونيًا ولا تحتاج إلى توقيع.', R, y + 54, { size: 8.5, color: grey });
  doc.page.margins.bottom = 0; // footer sits inside the bottom margin; avoid an automatic blank page
  doc.rect(0, 806, 595, 36).fill('#f3f4f6');
  en(`${SITE_CONFIG.fullName}  |  ${SITE_CONFIG.email}  |  ${SITE_CONFIG.phone}`, L, 820, { size: 8, color: grey, opts: { width: R - L, align: 'center', lineBreak: false } });
  doc.end();

  return done;
}
