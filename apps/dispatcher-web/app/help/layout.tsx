import { HelpProvider } from "@/context/help";

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return <HelpProvider>{children}</HelpProvider>;
}
