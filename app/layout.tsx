import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import ClientErrorReporter from '@/components/monitoring/ClientErrorReporter';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space', display: 'swap' });

export const metadata: Metadata = {
  title: 'Social Lounge TV',
  description: 'Professional Digital Signage & Social TV Platform',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body><AuthProvider><ClientErrorReporter />{children}</AuthProvider></body>
    </html>
  );
}
