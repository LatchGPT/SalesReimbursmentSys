import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/hanken-grotesk/wght.css';
import '@fontsource-variable/hanken-grotesk/wght-italic.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource-variable/jetbrains-mono/wght-italic.css';
import '@fontsource/material-symbols-outlined/400.css';
import '../index.css';

export const metadata: Metadata = {
  title: 'Sales Reimbursement System',
  description: 'Sales reimbursements, approvals, advances, and liquidations',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
