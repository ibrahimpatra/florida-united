// ============================================================
//  SITE CONFIG — Edit THIS file to update contact info,
//  branding, and store settings everywhere at once.
//  Changes here automatically reflect in:
//    • Header, Footer, Contact page
//    • All outgoing emails (order confirmations, welcome, etc.)
//    • Admin sidebar, login/register pages
//    • Cart free-shipping bar
// ============================================================

export const SITE_CONFIG = {
  // ── Branding ───────────────────────────────────────────────
  name:       'Florida Kuwait',
  fullName:   'Florida Kuwait Company',
  tagline:    'Hardware & Electrical Supplies',
  logoText:   'FK',
  foundedYear: 2005,

  // ── Contact ────────────────────────────────────────────────
  phone:          '+965 2222 5050',
  phoneTel:       '+96522225050',           // for tel: links (no spaces)
  whatsapp:       '96522225050',            // for wa.me links (no +)
  email:          'info@floridakuwait.com',
  emailOrders:    'orders@floridakuwait.com',
  emailReturns:   'returns@floridakuwait.com',
  emailNoReply:   'noreply@floridakuwait.com',
  emailAdmin:     'admin@floridakuwait.com',

  // ── Location ───────────────────────────────────────────────
  addressLine1:   'Block 12, Street 5',
  addressLine2:   'Salmiya, Kuwait',
  addressFull:    'Block 12, Street 5, Salmiya, Kuwait',
  googleMapsUrl:  'https://maps.google.com/?q=Salmiya+Kuwait',

  // ── Business Hours ─────────────────────────────────────────
  hoursWeekdays: 'Sun–Thu: 9:00 AM – 6:00 PM',
  hoursSaturday: 'Saturday: 10:00 AM – 4:00 PM',
  hoursSunday:   'Friday: Closed',

  // ── Store Settings ─────────────────────────────────────────
  currency:               'KWD',
  currencySymbol:         'KWD',
  locale:                 'en-KW',

  // Free shipping threshold in KWD. Set to 0 to always offer free shipping.
  // This is the FALLBACK — if admin sets it in Firestore it overrides this.
  freeShippingThreshold:  15,       // KWD 15.000
  defaultShippingCost:    1.500,    // KWD 1.500 flat fee under threshold

  taxRate:                0,        // Kuwait has no VAT (0%)
  defaultReturnDays:      14,

  // ── Social Media ───────────────────────────────────────────
  socialFacebook:   '#',
  socialInstagram:  '#',
  socialTwitter:    '#',
  socialYoutube:    '#',

  // ── SEO Defaults ───────────────────────────────────────────
  siteUrl:    process.env.NEXT_PUBLIC_APP_URL || 'https://floridakuwait.com',
  metaTitle:  'Florida Kuwait | Hardware & Electrical Supplies',
  metaDesc:   "Kuwait's trusted supplier of hardware, electrical, safety, and industrial products. Serving contractors and homeowners across Kuwait.",
} as const;

// Helper — format a KWD price to 3 decimal places
export function fmtKWD(amount: number): string {
  return `KWD ${amount.toFixed(3)}`;
}
