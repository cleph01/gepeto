"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { BackToHelp, HelpPage, PrintButton } from "@/components/help/help-page";
import { articleHeadings, HelpBody } from "@/components/help/markdown";
import { allArticles, useHelp } from "@/context/help";

export default function HelpArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { manual } = useHelp();
  const articles = manual ? allArticles(manual) : [];
  const article = articles.find((a) => a.slug === slug);

  // The article arrives after the page loads, too late for the browser's own
  // jump to a heading in the address.
  const loaded = !!article;
  useEffect(() => {
    if (!loaded || !window.location.hash) return;
    document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView();
  }, [loaded]);

  return (
    <HelpPage
      title="Help"
      subtitle={article?.title ?? "How to use Gepeto as a dispatcher"}
      action={article ? <PrintButton label="Print" /> : undefined}
    >
      {() =>
        article ? (
          <>
            <BackToHelp />
            <article className="help-prose">
              <h1>{article.title}</h1>
              <nav aria-label="On this page" className="help-toc no-print">
                <strong>On this page</strong>
                <ul>
                  {articleHeadings(article.body).map((h) => (
                    <li key={h.id}><a href={`#${h.id}`}>{h.text}</a></li>
                  ))}
                </ul>
              </nav>
              <HelpBody body={article.body} />
            </article>
            <nav aria-label="Related topics" className="help-related no-print">
              <strong>Related topics</strong>
              <ul>
                {article.related.map((relatedSlug) => {
                  const related = articles.find((a) => a.slug === relatedSlug);
                  return related ? (
                    <li key={relatedSlug}><Link href={`/help/${relatedSlug}`}>{related.title}</Link></li>
                  ) : null;
                })}
              </ul>
            </nav>
          </>
        ) : (
          <>
            <BackToHelp />
            <p>We couldn&apos;t find that help topic.</p>
          </>
        )
      }
    </HelpPage>
  );
}
