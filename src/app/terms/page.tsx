import type { Metadata } from 'next';
import { InfoPage } from '@/components/info/InfoPage';
import { TERMS, UPDATED } from '@/lib/legal-content';

export const metadata: Metadata = { title: TERMS.title.en, alternates: { canonical: '/terms' } };
export default function Page() { return <InfoPage title={TERMS.title} intro={TERMS.intro} sections={TERMS.sections} updated={UPDATED} />; }
