// ─────────────────────────────────────────────────────────────
//  WhatsApp Business Cloud API (Meta)
//  Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
//
//  Required .env vars:
//    WHATSAPP_ACCESS_TOKEN      → from Meta Business Manager → System Users
//    WHATSAPP_PHONE_NUMBER_ID   → from Meta → WhatsApp → Getting Started
//    WHATSAPP_BUSINESS_ACCOUNT_ID (optional, for template management)
//
//  Messages are sent as FREE-FORM text within 24h customer-initiated windows,
//  or as approved TEMPLATES for business-initiated messages.
//  We use text messages here since this is triggered by customer actions.
// ─────────────────────────────────────────────────────────────

import type { Order } from '@/types';

const WA_TOKEN    = process.env.WHATSAPP_ACCESS_TOKEN;
const WA_PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WA_API_URL  = `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`;

// Normalise a Kuwait/international phone number to E.164 format
function normalisePhone(phone: string): string | null {
  // Strip everything that isn't a digit or leading +
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) return null;

  // Kuwait numbers: 8 digits starting with 5,6,9 → prefix 965
  if (digits.length === 8 && /^[569]/.test(digits)) return `965${digits}`;

  // Already has country code (10+ digits)
  if (digits.length >= 10) return digits;

  return null;
}

async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    // WhatsApp not configured — log and skip silently
    console.log('[WhatsApp] Not configured — skipping. Add WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID to .env');
    return false;
  }

  const normPhone = normalisePhone(to);
  if (!normPhone) {
    console.warn(`[WhatsApp] Invalid phone number: ${to}`);
    return false;
  }

  try {
    const res = await fetch(WA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WA_TOKEN}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type:    'individual',
        to:                normPhone,
        type:              'text',
        text: { preview_url: false, body: message },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('[WhatsApp] Send failed:', JSON.stringify(err));
      return false;
    }

    console.log(`[WhatsApp] ✅ Sent to ${normPhone}`);
    return true;
  } catch (err) {
    console.error('[WhatsApp] Network error:', err);
    return false;
  }
}

// ── ORDER CONFIRMATION ───────────────────────────────────────
export async function sendWhatsAppOrderConfirmation(order: Order): Promise<void> {
  const phone = order.userPhone || order.shippingAddress?.phone;
  if (!phone) return;

  const itemLines = order.items
    .slice(0, 5)
    .map(i => `  • ${i.productName} × ${i.quantity}`)
    .join('\n');
  const more = order.items.length > 5 ? `\n  • ...and ${order.items.length - 5} more item(s)` : '';

  const msg = [
    `🛒 *Order Confirmed!* — Florida Kuwait`,
    ``,
    `Hello ${order.userName.split(' ')[0]}! Your order has been received.`,
    ``,
    `📦 *Order:* #${order.orderNumber}`,
    `💰 *Total:* KWD ${order.total.toFixed(3)}`,
    ``,
    `*Items:*`,
    itemLines + more,
    ``,
    `📍 *Delivering to:* ${order.shippingAddress.city}, Kuwait`,
    ``,
    `You'll receive updates as your order is processed.`,
    `Track your order: ${process.env.NEXT_PUBLIC_APP_URL}/order-tracking?q=${order.orderNumber}`,
    ``,
    `Questions? Reply to this message or call us 📞 +965 2222 5050`,
  ].join('\n');

  await sendWhatsApp(phone, msg);
}

// ── STATUS UPDATE ────────────────────────────────────────────
export async function sendWhatsAppStatusUpdate(order: Order, newStatus: string): Promise<void> {
  const phone = order.userPhone || order.shippingAddress?.phone;
  if (!phone) return;

  const STATUS_MESSAGES: Record<string, { emoji: string; line: string }> = {
    confirmed:   { emoji: '✅', line: 'Your order has been confirmed and is being prepared.' },
    processing:  { emoji: '⚙️', line: 'We\'re now processing and packing your order.' },
    shipped:     { emoji: '🚚', line: 'Your order is on its way!' },
    delivered:   { emoji: '🎉', line: 'Your order has been delivered. Enjoy!' },
    cancelled:   { emoji: '❌', line: 'Your order has been cancelled.' },
    refunded:    { emoji: '💸', line: 'Your refund has been processed.' },
    return_approved: { emoji: '📦', line: 'Your return request has been approved.' },
  };

  const statusInfo = STATUS_MESSAGES[newStatus];
  if (!statusInfo) return; // Don't send for unknown statuses

  const trackingLine = order.trackingNumber
    ? `\n🔍 *Tracking:* ${order.trackingNumber} via ${order.shippingCarrier}`
    : '';

  const msg = [
    `${statusInfo.emoji} *Order Update* — Florida Kuwait`,
    ``,
    `Hi ${order.userName.split(' ')[0]}!`,
    statusInfo.line,
    ``,
    `📦 *Order:* #${order.orderNumber}` + trackingLine,
    ``,
    `Track your order: ${process.env.NEXT_PUBLIC_APP_URL}/order-tracking?q=${order.orderNumber}`,
    ``,
    `Questions? Reply here or call 📞 +965 2222 5050`,
  ].join('\n');

  await sendWhatsApp(phone, msg);
}
