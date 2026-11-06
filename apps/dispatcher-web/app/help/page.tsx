"use client";

import Link from "next/link";
import { HelpPage } from "@/components/help/help-page";

export default function HelpHome() {
  return (
    <HelpPage
      title="Help"
      subtitle="How to use Gepeto as a dispatcher"
      action={<Link href="/help/manual" className="help-button">Printable manual</Link>}
    >
      {(manual) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {manual.sections.map((section) => (
            <section key={section.title}>
              <h2 className="help-section-title">{section.title}</h2>
              <div className="help-card">
                {section.articles.map((article) => (
                  <Link key={article.slug} href={`/help/${article.slug}`} className="help-card-row">
                    <strong>{article.title}</strong>
                    <span>{article.summary}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </HelpPage>
  );
}
