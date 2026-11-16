import type { Metadata } from 'next';
import { InfoPage } from '@/components/info/InfoPage';
import { RETURNS, UPDATED } from '@/lib/legal-content';

export const metadata: Metadata = { title: RETURNS.title.en, alternates: { canonical: '/returns-policy' } };
export default function Page() { return <InfoPage title={RETURNS.title} intro={RETURNS.intro} sections={RETURNS.sections} updated={UPDATED} />; }
