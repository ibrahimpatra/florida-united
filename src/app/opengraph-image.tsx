import { ImageResponse } from 'next/og';
import { SITE_CONFIG } from '@/lib/siteConfig';

// Default share picture (WhatsApp, Facebook, X, Google Discover) for any page without its own image.
export const alt = SITE_CONFIG.fullName;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: 80, background: '#234b63', color: '#fff' }}>
        <div style={{ display: 'flex', width: 220, height: 220, borderRadius: 48, background: '#fff', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ fontSize: 170, fontWeight: 800, color: '#234b63', marginRight: 24 }}>F</div>
          <svg width="70" height="100" viewBox="0 0 30 44" style={{ position: 'absolute', right: 30, bottom: 26 }}><path d="M18 0 0 26h11L8 44 30 16H19z" fill="#f5b800" /></svg>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 60 }}>
          <div style={{ fontSize: 76, fontWeight: 800 }}>Florida United Kuwait</div>
          <div style={{ fontSize: 38, marginTop: 16, color: '#f5b800' }}>{SITE_CONFIG.tagline}</div>
        </div>
      </div>
    ),
    size,
  );
}
