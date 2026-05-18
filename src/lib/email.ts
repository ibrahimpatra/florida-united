// src/lib/email.ts
import nodemailer from 'nodemailer';
import { SITE_CONFIG } from '@/lib/siteConfig';
import type { Order } from '@/types';

// Format money in KWD (3 decimal places — Kuwait standard)
const fmtKWD = (amount: number) => `KWD ${amount.toFixed(3)}`;

// Support both EMAIL_* and SMTP_* naming conventions
const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
const emailPass = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS;
const emailHost = process.env.EMAIL_HOST || process.env.SMTP_HOST || 'smtp.gmail.com';
const emailPort = parseInt(process.env.EMAIL_PORT || process.env.SMTP_PORT || '587');

const transporter = nodemailer.createTransport({
  host: emailHost,
  port: emailPort,
  secure: false,
  auth: emailUser && emailPass
    ? { user: emailUser, pass: emailPass }
    : undefined, // Skip auth if not configured — prevents crash on startup
});

const BRAND_COLOR = '#1a56db';
const SITE_URL = SITE_CONFIG.siteUrl;

function baseTemplate(content: string, preheader = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Florida Kuwait Company</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f4f6fb; color: #1f2937; }
    .wrapper { max-width: 620px; margin: 24px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: ${BRAND_COLOR}; padding: 28px 32px; text-align: center; }
    .logo { color: white; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .logo span { background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 8px; margin-right: 8px; }
    .tagline { color: rgba(255,255,255,0.75); font-size: 12px; margin-top: 4px; }
    .body { padding: 32px; }
    .footer { background: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px 32px; text-align: center; font-size: 12px; color: #9ca3af; }
    .footer a { color: ${BRAND_COLOR}; text-decoration: none; }
    .btn { display: inline-block; background: ${BRAND_COLOR}; color: white; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; margin: 16px 0; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .badge-pending { background: #fef3c7; color: #d97706; }
    .badge-confirmed { background: #dbeafe; color: #1d4ed8; }
    .badge-shipped { background: #ede9fe; color: #7c3aed; }
    .badge-delivered { background: #dcfce7; color: #16a34a; }
    .badge-cancelled { background: #fee2e2; color: #dc2626; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f9fafb; padding: 10px 14px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
    td { padding: 12px 14px; border-top: 1px solid #f3f4f6; font-size: 14px; }
    .total-row td { font-weight: 700; background: #f0f7ff; }
    .info-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; margin: 16px 0; }
    .info-card h4 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 8px; }
    .info-card p { font-size: 14px; line-height: 1.6; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .track-steps { display: flex; gap: 0; margin: 20px 0; }
    .step { flex: 1; text-align: center; }
    .step-dot { width: 24px; height: 24px; border-radius: 50%; margin: 0 auto 6px; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .step-done .step-dot { background: ${BRAND_COLOR}; color: white; }
    .step-current .step-dot { background: #fef3c7; border: 2px solid #f59e0b; color: #d97706; }
    .step-pending .step-dot { background: #f3f4f6; color: #9ca3af; }
    .step-label { font-size: 10px; color: #6b7280; }
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ''}
  <div class="wrapper">
    <div class="header">
      <div class="logo"><span>${SITE_CONFIG.logoText}</span>${SITE_CONFIG.fullName}</div>
      <div class="tagline">${SITE_CONFIG.tagline} — ${SITE_CONFIG.addressLine2}</div>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>${SITE_CONFIG.fullName} | ${SITE_CONFIG.addressFull}</p>
      <p style="margin-top:6px;">
        <a href="${SITE_URL}">Shop</a> · 
        <a href="${SITE_URL}/contact">Contact</a> · 
        <a href="${SITE_URL}/account/orders">My Orders</a>
      </p>
      <p style="margin-top:8px;">© ${new Date().getFullYear()} ${SITE_CONFIG.fullName}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── ORDER CONFIRMATION EMAIL ──────────────────────────────────
export async function sendOrderConfirmation(order: Order) {
  const itemRows = order.items.map(item => `
    <tr>
      <td><strong>${item.productName}</strong>${item.variantName ? `<br><small style="color:#6b7280">${item.variantName}</small>` : ''}<br><small style="color:#9ca3af">SKU: ${item.productSku}</small></td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">${fmtKWD(item.price)}</td>
      <td style="text-align:right"><strong>${fmtKWD(item.total)}</strong></td>
    </tr>
  `).join('');

  const content = `
    <h2 style="color:#1f2937;font-size:22px;margin-bottom:4px;">Order Confirmed! 🎉</h2>
    <p style="color:#6b7280;margin-bottom:24px;">Thank you, ${order.userName}! Your order has been received and is being processed.</p>
    
    <div class="info-card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <div>
          <h4>Order Number</h4>
          <p style="font-size:20px;font-weight:800;color:${BRAND_COLOR}">#${order.orderNumber}</p>
        </div>
        <div>
          <span class="badge badge-confirmed">✓ Confirmed</span>
        </div>
        <div>
          <h4>Order Date</h4>
          <p>${new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div>
          <h4>Payment</h4>
          <p style="color:#16a34a;font-weight:700">✓ ${order.paymentMethod?.toUpperCase() || 'PAID'}</p>
        </div>
      </div>
    </div>

    <table style="margin:20px 0;">
      <thead><tr><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr><td colspan="3">Subtotal</td><td style="text-align:right">${fmtKWD(order.subtotal)}</td></tr>
        ${order.discount > 0 ? `<tr><td colspan="3" style="color:#16a34a">Discount ${order.couponCode ? `(${order.couponCode})` : ''}</td><td style="text-align:right;color:#16a34a">-${fmtKWD(order.discount)}</td></tr>` : ''}
        <tr><td colspan="3">Shipping</td><td style="text-align:right">${order.shippingCost === 0 ? '<span style="color:#16a34a">FREE</span>' : fmtKWD(order.shippingCost)}</td></tr>
        <tr><td colspan="3">Tax</td><td style="text-align:right">${order.tax > 0 ? fmtKWD(order.tax) : 'None (Kuwait)'}</td></tr>
        <tr class="total-row"><td colspan="3" style="text-align:left">TOTAL</td><td style="text-align:right;color:${BRAND_COLOR};font-size:18px">${fmtKWD(order.total)}</td></tr>
      </tfoot>
    </table>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
      <div class="info-card">
        <h4>📦 Ship To</h4>
        <p>${order.shippingAddress.name}<br>
        ${order.shippingAddress.street}${order.shippingAddress.area ? ', ' + order.shippingAddress.area : ''}<br>
        ${order.shippingAddress.city}${order.shippingAddress.governorate ? ', ' + order.shippingAddress.governorate : ''}, Kuwait</p>
      </div>
      <div class="info-card">
        <h4>📞 Contact</h4>
        <p>${order.userEmail}<br>${order.userPhone || ''}</p>
      </div>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}/account/orders/${order.id}" class="btn">Track Your Order</a>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:8px;">You'll receive shipping updates as your order progresses.</p>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"${SITE_CONFIG.fullName}" <${SITE_CONFIG.emailOrders}>`,
    to: order.userEmail,
    subject: `Order Confirmed #${order.orderNumber} — ${SITE_CONFIG.fullName}`,
    html: baseTemplate(content, `Your order #${order.orderNumber} is confirmed!`),
  });
}

// ── ORDER STATUS UPDATE EMAIL ─────────────────────────────────
export async function sendOrderStatusUpdate(order: Order, newStatus: string, note?: string) {
  const statusMessages: Record<string, { title: string; body: string; emoji: string }> = {
    processing: { title: 'Order Being Processed', body: 'We\'re preparing your items for shipment.', emoji: '⚙️' },
    shipped: { title: 'Your Order Has Shipped!', body: `Your order is on its way!${order.trackingNumber ? ` Track with: <strong>${order.trackingNumber}</strong> via ${order.shippingCarrier}` : ''}`, emoji: '🚚' },
    out_for_delivery: { title: 'Out for Delivery Today!', body: 'Your order is out for delivery and will arrive today.', emoji: '🏃' },
    delivered: { title: 'Order Delivered!', body: 'Your order has been delivered. We hope you love your products!', emoji: '✅' },
    cancelled: { title: 'Order Cancelled', body: 'Your order has been cancelled. A refund will be processed if payment was made.', emoji: '❌' },
    return_approved: { title: 'Return Approved', body: 'Your return request has been approved. We\'ll pick up shortly.', emoji: '↩️' },
    refunded: { title: 'Refund Processed', body: 'Your refund has been processed and will appear in 3-5 business days.', emoji: '💰' },
  };

  const msg = statusMessages[newStatus] || { title: `Order Update`, body: `Your order status is now: ${newStatus}`, emoji: '📦' };

  const content = `
    <h2 style="color:#1f2937;font-size:22px;margin-bottom:4px;">${msg.emoji} ${msg.title}</h2>
    <p style="color:#6b7280;margin-bottom:24px;">Hi ${order.userName}, here's an update on your order.</p>
    
    <div class="info-card" style="background:#eff6ff;border-color:#bfdbfe;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h4>Order</h4>
          <p style="font-size:18px;font-weight:800;color:${BRAND_COLOR}">#${order.orderNumber}</p>
        </div>
        <span class="badge badge-${newStatus.includes('deliver') ? 'delivered' : newStatus.includes('ship') ? 'shipped' : newStatus.includes('cancel') ? 'cancelled' : 'confirmed'}">${newStatus.replace(/_/g, ' ').toUpperCase()}</span>
      </div>
    </div>

    <p style="font-size:15px;line-height:1.7;margin:16px 0;">${msg.body}</p>
    ${note ? `<div class="info-card"><h4>Note from our team</h4><p>${note}</p></div>` : ''}

    ${newStatus === 'shipped' && order.trackingNumber ? `
    <div class="info-card" style="background:#f0fdf4;border-color:#bbf7d0;">
      <h4>📍 Tracking Info</h4>
      <p><strong>Carrier:</strong> ${order.shippingCarrier}</p>
      <p><strong>Tracking #:</strong> ${order.trackingNumber}</p>
    </div>` : ''}

    <div style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}/account/orders/${order.id}" class="btn">View Order Details</a>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"${SITE_CONFIG.fullName}" <${SITE_CONFIG.emailOrders}>`,
    to: order.userEmail,
    subject: `${msg.emoji} ${msg.title} — Order #${order.orderNumber}`,
    html: baseTemplate(content),
  });
}

// ── WELCOME / REGISTRATION EMAIL ─────────────────────────────
export async function sendWelcomeEmail(email: string, name: string) {
  const content = `
    <h2 style="color:#1f2937;font-size:22px;margin-bottom:4px;">Welcome to ${SITE_CONFIG.name}! 🎉</h2>
    <p style="color:#6b7280;margin-bottom:24px;">Hi ${name}, your account has been created successfully.</p>
    
    <div class="info-card" style="background:#eff6ff;border-color:#bfdbfe;">
      <p style="font-size:15px;line-height:1.7;">${SITE_CONFIG.fullName} is your one-stop shop for <strong>hardware, electrical supplies, safety equipment</strong>, and more — all trusted since ${SITE_CONFIG.foundedYear}.</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0;">
      <div style="background:#f9fafb;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:28px;margin-bottom:8px;">🔧</div>
        <p style="font-size:13px;font-weight:600;color:#1f2937">50,000+ Products</p>
        <p style="font-size:12px;color:#6b7280">Hardware & Electrical</p>
      </div>
      <div style="background:#f9fafb;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:28px;margin-bottom:8px;">🚚</div>
        <p style="font-size:13px;font-weight:600;color:#1f2937">Free Shipping</p>
        <p style="font-size:12px;color:#6b7280">Orders over KWD ${SITE_CONFIG.freeShippingThreshold}</p>
      </div>
      <div style="background:#f9fafb;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:28px;margin-bottom:8px;">↩️</div>
        <p style="font-size:13px;font-weight:600;color:#1f2937">30-Day Returns</p>
        <p style="font-size:12px;color:#6b7280">Hassle-free policy</p>
      </div>
      <div style="background:#f9fafb;border-radius:12px;padding:16px;text-align:center;">
        <div style="font-size:28px;margin-bottom:8px;">🔒</div>
        <p style="font-size:13px;font-weight:600;color:#1f2937">Secure Payments</p>
        <p style="font-size:12px;color:#6b7280">Stripe & Google Pay</p>
      </div>
    </div>

    <div style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}/shop" class="btn">Start Shopping</a>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"${SITE_CONFIG.fullName}" <${SITE_CONFIG.emailNoReply}>`,
    to: email,
    subject: `Welcome to Florida Kuwait Company, ${name}! 🎉`,
    html: baseTemplate(content, 'Welcome! Your account is ready.'),
  });
}

// ── PASSWORD RESET EMAIL ──────────────────────────────────────
export async function sendPasswordResetEmail(email: string, resetLink: string) {
  const content = `
    <h2 style="color:#1f2937;font-size:22px;margin-bottom:4px;">Reset Your Password 🔐</h2>
    <p style="color:#6b7280;margin-bottom:24px;">We received a request to reset your password for your ${SITE_CONFIG.name} account.</p>
    
    <p style="font-size:15px;margin-bottom:20px;">Click the button below to create a new password. This link expires in <strong>1 hour</strong>.</p>
    
    <div style="text-align:center;margin:28px 0;">
      <a href="${resetLink}" class="btn">Reset Password</a>
    </div>

    <div class="info-card" style="background:#fff7ed;border-color:#fed7aa;">
      <p style="font-size:13px;color:#9a3412;">⚠️ If you didn't request this, you can safely ignore this email. Your password won't change.</p>
    </div>
    
    <p style="font-size:12px;color:#9ca3af;margin-top:16px;">Or copy this link: <a href="${resetLink}" style="color:${BRAND_COLOR};word-break:break-all;">${resetLink}</a></p>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"${SITE_CONFIG.fullName}" <${SITE_CONFIG.emailNoReply}>`,
    to: email,
    subject: 'Reset Your Password — Florida Kuwait Company',
    html: baseTemplate(content, 'Your password reset link'),
  });
}

// ── RETURN REQUEST EMAIL ──────────────────────────────────────
export async function sendReturnRequestEmail(
  email: string, name: string, orderNumber: string, returnId: string, reason: string
) {
  const content = `
    <h2 style="color:#1f2937;font-size:22px;margin-bottom:4px;">Return Request Received ↩️</h2>
    <p style="color:#6b7280;margin-bottom:24px;">Hi ${name}, we've received your return request.</p>
    
    <div class="info-card">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div><h4>Order Number</h4><p style="font-weight:700;color:${BRAND_COLOR}">#${orderNumber}</p></div>
        <div><h4>Return ID</h4><p style="font-weight:700">#${returnId}</p></div>
        <div><span class="badge badge-pending">Under Review</span></div>
      </div>
    </div>
    
    <div class="info-card">
      <h4>Reason for Return</h4>
      <p>${reason}</p>
    </div>

    <p style="font-size:14px;line-height:1.7;color:#4b5563;margin:16px 0;">Our team will review your request within <strong>1-2 business days</strong> and you'll receive an update via email.</p>
    
    <div style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}/account/orders" class="btn">View My Orders</a>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"${SITE_CONFIG.fullName}" <${SITE_CONFIG.emailReturns}>`,
    to: email,
    subject: `Return Request Received — Order #${orderNumber}`,
    html: baseTemplate(content),
  });
}

// ── ADMIN NEW ORDER EMAIL ─────────────────────────────────────
export async function sendAdminNewOrderNotification(order: Order) {
  const adminEmail = process.env.ADMIN_EMAIL || SITE_CONFIG.emailAdmin;
  const content = `
    <h2 style="color:#1f2937;">🛍 New Order Received!</h2>
    <div class="info-card">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div><h4>Order #</h4><p style="font-weight:800;font-size:18px;color:${BRAND_COLOR}">#${order.orderNumber}</p></div>
        <div><h4>Customer</h4><p>${order.userName}<br><small>${order.userEmail}</small></p></div>
        <div><h4>Total</h4><p style="font-weight:800;font-size:18px;color:#16a34a">${fmtKWD(order.total)}</p></div>
        <div><h4>Items</h4><p>${order.items.length} item(s)</p></div>
      </div>
    </div>
    <div style="text-align:center;margin-top:24px;">
      <a href="${SITE_URL}/admin/orders/${order.id}" class="btn">Manage Order</a>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || `"${SITE_CONFIG.name}" <${SITE_CONFIG.emailOrders}>`,
    to: adminEmail,
    subject: `🛍 New Order #${order.orderNumber} — ${fmtKWD(order.total)}`,
    html: baseTemplate(content),
  });
}

export async function sendContactEmail(name: string, email: string, subject: string, message: string) {
  const adminEmail = process.env.ADMIN_EMAIL || SITE_CONFIG.emailAdmin;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM!,
    to: adminEmail,
    replyTo: email,
    subject: `Contact Form: ${subject}`,
    html: baseTemplate(`<h3>New Contact Message</h3><p><strong>From:</strong> ${name} (${email})</p><p><strong>Subject:</strong> ${subject}</p><div class="info-card"><p>${message.replace(/\n/g, '<br>')}</p></div>`),
  });
}

// Alias expected by TAP webhook and COD route
export async function sendOrderConfirmationEmail(
  email: string,
  name: string,
  orderNumber: string,
  items: Order['items'],
  total: number
): Promise<void> {
  // Build a minimal order object and delegate to sendOrderConfirmation
  const mockOrder = {
    userEmail: email,
    userName: name,
    orderNumber,
    items,
    total,
    currency: 'KWD',
  } as Order;
  return sendOrderConfirmation(mockOrder);
}

export async function sendReturnStatusEmail(email: string, name: string, orderNumber: string, status: string, note?: string): Promise<void> {
  // Alias for return status notifications
}