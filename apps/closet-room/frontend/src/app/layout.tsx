import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'closet-room',
  description: 'closet-room application',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
