import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AppShell from "@/components/app-shell";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Gepeto — Dispatcher",
  description: "Dental lab delivery & driver tracking platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex h-full">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
