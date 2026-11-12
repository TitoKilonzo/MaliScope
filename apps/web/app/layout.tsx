import type { Metadata, Viewport } from 'next';
import './globals.css';
import PWARegister from '@/components/pwa-register';
export const metadata: Metadata = {
  title: { default: 'MaliScope — Understand money. Read the markets.', template: '%s | MaliScope' },
  description: 'A financial literacy and market intelligence platform built for curious learners and informed investors.',
  applicationName: 'MaliScope',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
};
export const viewport: Viewport = { themeColor: '#7554F6', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<PWARegister /></body></html>;
}
