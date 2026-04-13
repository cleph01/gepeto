import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Gepeto — Dental Lab Delivery, Simplified",
  description:
    "Replace the group texts and phone calls with a purpose-built dispatch platform. Real-time driver tracking, proof of delivery, and live status updates for every dental office you serve.",
  openGraph: {
    title: "Gepeto — Dental Lab Delivery, Simplified",
    description:
      "Purpose-built dispatch and delivery tracking for dental labs. Real-time visibility from your bench to the dental office.",
    siteName: "Gepeto",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
