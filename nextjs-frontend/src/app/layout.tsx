import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Anuphan } from 'next/font/google';
import './globals.css';

// Anuphan sets both scripts (400 and 600 only); Plus Jakarta Sans is used for the wordmark only.
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' });
const anuphan = Anuphan({ subsets: ['thai', 'latin'], variable: '--font-thai', weight: ['400', '600'] });

export const metadata: Metadata = {
  title: 'RoomWitness',
  description: 'Thai Rental Deposit Dispute Analyzer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className={`${jakarta.variable} ${anuphan.variable}`}>{children}</body>
    </html>
  );
}
