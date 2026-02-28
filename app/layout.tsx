import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Venice Knowledge Graph Chat',
  description: 'AI-powered chatbot using Venice embeddings and knowledge graphs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}