import type { Metadata } from "next";

// Browsers suggest the page title as the PDF's file name.
export const metadata: Metadata = { title: "Gepeto Dispatcher Manual" };

export default function ManualLayout({ children }: { children: React.ReactNode }) {
  return children;
}
