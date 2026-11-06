import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { isUnlocked, officeFromToken } from "@/lib/access";
import { officeGuide } from "@/lib/help-content";
import PrintButton from "./print-button";

export const metadata: Metadata = {
  title: "Help — Delivery Tracker",
  robots: { index: false, follow: false },
};

function headingId(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    return link ? <a key={i} href={link[2]}>{link[1]}</a> : part;
  });
}

function GuideBody({ body }: { body: string }) {
  const lines = body.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  const takeList = (marker: RegExp) => {
    const items: string[] = [];
    while (i < lines.length && marker.test(lines[i])) items.push(lines[i++].replace(marker, ""));
    return items.map((item, n) => <li key={n}>{renderInline(item)}</li>);
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (line.startsWith("## ")) {
      const text = line.slice(3).trim();
      blocks.push(<h2 key={i} id={headingId(text)}>{text}</h2>);
      i++;
    } else if (/^\d+\. /.test(line)) {
      const start = i;
      blocks.push(<ol key={start}>{takeList(/^\d+\. /)}</ol>);
    } else if (line.startsWith("- ")) {
      const start = i;
      blocks.push(<ul key={start}>{takeList(/^- /)}</ul>);
    } else if (line.startsWith("> ")) {
      blocks.push(<aside key={i} className="office-help-note">{renderInline(line.slice(2))}</aside>);
      i++;
    } else {
      blocks.push(<p key={i}>{renderInline(line)}</p>);
      i++;
    }
  }
  return <>{blocks}</>;
}

// Rendered on the server after the same access check as the tracking page, so
// the guide's text never reaches someone who hasn't entered the code.
export default async function OfficeHelpPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const office = await officeFromToken(token);
  if (!office) notFound();
  if (!(await isUnlocked(token, office))) redirect(`/t/${token}`);

  const headings = officeGuide
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim());

  return (
    <div className="office-help">
      <header className="office-help-header">
        <Link href={`/t/${token}`}>← Back to your deliveries</Link>
        <PrintButton />
      </header>
      <main>
        <h1>How to use your tracking page</h1>
        <nav aria-label="On this page" className="office-help-toc">
          <strong>On this page</strong>
          <ul>
            {headings.map((text) => (
              <li key={text}><a href={`#${headingId(text)}`}>{text}</a></li>
            ))}
          </ul>
        </nav>
        <GuideBody body={officeGuide} />
      </main>
    </div>
  );
}
