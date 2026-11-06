// Safe for client code: shapes only. The articles themselves live in
// content.ts, which is server-only so help stays behind the login.

export type HelpArticle = {
  slug: string;
  title: string;
  summary: string;
  /** Slugs of articles to suggest at the end of this one. */
  related: string[];
  /**
   * Plain text with a small set of Markdown: "## " headings, "- " bullets,
   * "1. " steps, "> " callouts, **bold** and [links](/help/slug#heading).
   */
  body: string;
};

export type HelpSection = {
  title: string;
  articles: HelpArticle[];
};

export type HelpManual = {
  sections: HelpSection[];
};
