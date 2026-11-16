import type { Metadata } from 'next';
import { InfoPage } from '@/components/info/InfoPage';
import { PRIVACY, UPDATED } from '@/lib/legal-content';

export const metadata: Metadata = { title: PRIVACY.title.en, alternates: { canonical: '/privacy' } };
export default function Page() { return <InfoPage title={PRIVACY.title} intro={PRIVACY.intro} sections={PRIVACY.sections} updated={UPDATED} />; }
