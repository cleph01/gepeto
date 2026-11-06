import Link from "next/link";

// The small "?" beside a page title, linking to the article for that page.
export default function HelpLink({ slug, topic }: { slug: string; topic: string }) {
  return (
    <Link
      href={`/help/${slug}`}
      title={`Help: ${topic}`}
      aria-label={`Help: ${topic}`}
      className="help-link"
    >
      ?
    </Link>
  );
}
