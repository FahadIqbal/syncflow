import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from 'sonner';
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SyncFlow | Global Ticketing Engine",
  description: "A high-concurrency ticket drop engine built with Vercel and Amazon Aurora DSQL.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col">
        <div className="bg-grain" />
        {children}
        <Toaster theme="dark" position="top-center" />
      </body>
    </html>
  );
}
