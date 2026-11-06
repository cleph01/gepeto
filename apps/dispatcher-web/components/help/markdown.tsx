"use client";

import Link from "next/link";
import type { ReactNode } from "react";

// Renders the small Markdown subset described in lib/help/types.ts.

export function headingId(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function articleHeadings(body: string) {
  return body
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => ({ text: line.slice(3).trim(), id: headingId(line.slice(3)) }));
}

export type HelpLinkTarget = { href: string; samePage?: boolean; ref?: string };

function renderInline(text: string, resolve: (href: string) => HelpLinkTarget): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (!link) return part;
    const target = resolve(link[2]);
    return target.samePage ? (
      <a key={i} href={target.href} data-ref={target.ref}>{link[1]}</a>
    ) : (
      <Link key={i} href={target.href} data-ref={target.ref}>{link[1]}</Link>
    );
  });
}

export function HelpBody({
  body,
  idPrefix = "",
  resolve = (href) => ({ href }),
}: {
  body: string;
  idPrefix?: string;
  resolve?: (href: string) => HelpLinkTarget;
}) {
  const lines = body.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  const inline = (text: string) => renderInline(text, resolve);

  // Collects consecutive lines of a list and strips each one's marker.
  const takeList = (marker: RegExp) => {
    const items: string[] = [];
    while (i < lines.length && marker.test(lines[i])) items.push(lines[i++].replace(marker, ""));
    return items;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (line.startsWith("## ")) {
      const text = line.slice(3).trim();
      blocks.push(<h2 key={i} id={idPrefix + headingId(text)}>{text}</h2>);
      i++;
    } else if (/^\d+\. /.test(line)) {
      const start = i;
      blocks.push(<ol key={start}>{takeList(/^\d+\. /).map((item, n) => <li key={n}>{inline(item)}</li>)}</ol>);
    } else if (line.startsWith("- ")) {
      const start = i;
      blocks.push(<ul key={start}>{takeList(/^- /).map((item, n) => <li key={n}>{inline(item)}</li>)}</ul>);
    } else if (line.startsWith("> ")) {
      blocks.push(<aside key={i} className="help-note">{inline(line.slice(2))}</aside>);
      i++;
    } else {
      blocks.push(<p key={i}>{inline(line)}</p>);
      i++;
    }
  }

  return <>{blocks}</>;
}
