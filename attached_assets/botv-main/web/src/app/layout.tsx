import type { Metadata } from 'next';
import './globals.css';
import { WebSocketProvider } from '@/contexts/WebSocketContext';

export const metadata: Metadata = {
  title: 'LangSense Control Panel',
  description: 'Real-time notification system for agents and affiliates',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <WebSocketProvider>{children}</WebSocketProvider>
      </body>
    </html>
  );
}
