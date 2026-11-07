import { PRIVACY_URL, TERMS_URL } from "@/lib/legal";

// The Privacy Policy and Terms open on the public site, in a new tab, so nobody
// loses what they were doing.
export function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 2 }}>{children}</a>;
}

export function LegalLinks({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 11.5, color: "#9a9a9a", ...style }}>
      <LegalLink href={PRIVACY_URL}>Privacy</LegalLink> · <LegalLink href={TERMS_URL}>Terms</LegalLink>
    </div>
  );
}
