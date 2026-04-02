import type { Metadata } from 'next';
import './globals.css';
import EscalationProvider from '@/components/EscalationProvider';

export const metadata: Metadata = {
  title: 'Avalanche Forecast Dashboard',
  description: 'Colorado & Utah avalanche forecast visualization',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <EscalationProvider>{children}</EscalationProvider>
      </body>
    </html>
  );
}
