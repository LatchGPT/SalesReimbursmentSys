'use client';

import dynamic from 'next/dynamic';

const ReimbursementApp = dynamic(() => import('../App'), {
  ssr: false,
});

export function AppClient() {
  return <ReimbursementApp />;
}
