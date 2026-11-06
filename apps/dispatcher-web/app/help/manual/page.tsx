"use client";

import { useEffect } from "react";
import { BackToHelp, HelpPage, PrintButton } from "@/components/help/help-page";
import { HelpBody, type HelpLinkTarget } from "@/components/help/markdown";
import type { HelpManual } from "@/lib/help/types";

const TITLE = "Gepeto Dispatcher Manual";

// Numbers each article (2.1) so cross-references still work on paper.
function articleNumbers(manual: HelpManual) {
  const numbers = new Map<string, string>();
  manual.sections.forEach((section, s) =>
    section.articles.forEach((article, a) => numbers.set(article.slug, `${s + 1}.${a + 1}`))
  );
  return numbers;
}

function ManualContents({ manual }: { manual: HelpManual }) {
  const numbers = articleNumbers(manual);

  // Links between articles jump within this page. Links to app screens stay as they are.
  const resolveFrom = (currentSlug: string) => (href: string): HelpLinkTarget => {
    const match = href.match(/^\/help\/([^#]+)(?:#(.+))?$/);
    if (!match) return { href };
    const [, slug, heading] = match;
    return {
      href: heading ? `#${slug}--${heading}` : `#${slug}`,
      samePage: true,
      // No "(see 3.1)" on a link that stays inside article 3.1.
      ref: slug === currentSlug ? undefined : numbers.get(slug),
    };
  };

  return (
    <div className="help-manual">
      <BackToHelp />
      <div className="help-manual-title">
        <h1>{TITLE}</h1>
        <p>How to use Gepeto as a dispatcher</p>
      </div>

      <nav aria-label="Contents" className="help-manual-contents">
        <h2>Contents</h2>
        {manual.sections.map((section, s) => (
          <div key={section.title}>
            <h3>{s + 1}. {section.title}</h3>
            <ul>
              {section.articles.map((article) => (
                <li key={article.slug}>
                  <a href={`#${article.slug}`}>{numbers.get(article.slug)} {article.title}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {manual.sections.flatMap((section) =>
        section.articles.map((article) => (
          <article key={article.slug} id={article.slug} className="help-prose help-manual-article">
            <p className="help-manual-section">{section.title}</p>
            <h1>{numbers.get(article.slug)} {article.title}</h1>
            <HelpBody body={article.body} idPrefix={`${article.slug}--`} resolve={resolveFrom(article.slug)} />
          </article>
        ))
      )}
    </div>
  );
}

export default function HelpManualPage() {
  // Browsers suggest the page title as the PDF's file name.
  useEffect(() => {
    const previous = document.title;
    document.title = TITLE;
    return () => { document.title = previous; };
  }, []);

  return (
    <HelpPage
      title="Printable manual"
      subtitle="Every help topic on one page"
      action={<PrintButton label="Print or save as PDF" />}
    >
      {(manual) => <ManualContents manual={manual} />}
    </HelpPage>
  );
}
