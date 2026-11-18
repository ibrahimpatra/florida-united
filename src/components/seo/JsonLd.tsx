/** Renders one or more schema.org objects as JSON-LD for search engines. */
export function JsonLd({ data }: { data: object | object[] }) {
  const safe = JSON.stringify(data).replace(/</g, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safe }} />;
}

export const breadcrumb = (base: string, trail: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: trail.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, item: `${base}${t.path}` })),
});

export const organization = (b: { fullName: string; fullNameAr?: string; phone?: string; email?: string; addressFull?: string; logoUrl?: string }, base: string) => ({
  '@context': 'https://schema.org', '@type': ['Organization', 'HardwareStore'],
  name: b.fullName, ...(b.fullNameAr ? { alternateName: b.fullNameAr } : {}), url: base,
  logo: b.logoUrl ? (b.logoUrl.startsWith('http') ? b.logoUrl : `${base}${b.logoUrl}`) : `${base}/icon-512.png`,
  ...(b.phone ? { telephone: b.phone } : {}), ...(b.email ? { email: b.email } : {}),
  ...(b.addressFull ? { address: { '@type': 'PostalAddress', streetAddress: b.addressFull, addressCountry: 'KW' } } : {}),
  areaServed: { '@type': 'Country', name: 'Kuwait' }, priceRange: 'KWD',
});
