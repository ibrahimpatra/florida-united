import type { Metadata } from 'next';
import { InfoPage } from '@/components/info/InfoPage';
import { ABOUT } from '@/lib/legal-content';

export const metadata: Metadata = { title: ABOUT.title.en, alternates: { canonical: '/about' } };
export default function Page() { return <InfoPage title={ABOUT.title} intro={ABOUT.intro} sections={ABOUT.sections} />; }
