import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Gepeto — Dispatcher",
  description: "Dental lab delivery & driver tracking platform",
};

const navLinks = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.9" />
        <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.4" />
        <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.4" />
        <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.4" />
      </svg>
    ),
  },
  {
    href: "/jobs",
    label: "Jobs",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v9A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z" stroke="currentColor" strokeWidth="1.25" fill="none" />
        <path d="M5 6h6M5 8.5h4M5 11h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/drivers",
    label: "Drivers",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.25" fill="none" />
        <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.25" fill="none" />
        <path d="M8 1.5v1.75M8 12.75V14.5M14.5 8h-1.75M3.25 8H1.5M12.364 3.636l-1.237 1.237M4.873 11.127l-1.237 1.237M12.364 12.364l-1.237-1.237M4.873 4.873L3.636 3.636" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex h-full">
        {/* Sidebar */}
        <aside
          style={{
            width: 240,
            minWidth: 240,
            background: "#FFFFFF",
            borderRight: "1px solid rgba(0,0,0,0.08)",
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 40,
          }}
        >
          {/* Logo */}
          <div
            style={{
              padding: "20px 20px 16px",
              borderBottom: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* Tooth icon */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: "#185FA5",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M9 2C7.2 2 5.5 2.9 4.5 4.3c-.7 1-1 2.1-.8 3.3l1 5.8c.2 1 1 1.6 1.9 1.6.8 0 1.5-.5 1.8-1.2L9 11.5l1.6 2.3c.3.7 1 1.2 1.8 1.2.9 0 1.7-.6 1.9-1.6l1-5.8c.2-1.2-.1-2.3-.8-3.3C13.5 2.9 11.8 2 10 2H9z"
                    fill="white"
                    opacity="0.95"
                  />
                </svg>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#185FA5",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                  }}
                >
                  Gepeto
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#5F5E5A",
                    fontWeight: 400,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  Dispatcher
                </div>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ padding: "12px 10px", flex: 1 }}>
            {navLinks.map((link) => (
              <NavLink key={link.href} href={link.href} icon={link.icon}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Bottom user area */}
          <div
            style={{
              padding: "12px 16px",
              borderTop: "1px solid rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "#185FA5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 600,
                color: "white",
                flexShrink: 0,
              }}
            >
              JR
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#1a1a1a",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Jamie Rivera
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#5F5E5A",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Dispatcher
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main
          style={{
            marginLeft: 240,
            flex: 1,
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}

// NavLink is server-rendered; active state is handled via pathname
// For MVP we hardcode /dashboard as active — in production use usePathname in a client component
function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  // Hardcode dashboard as active for static render
  const isActive = href === "/dashboard";

  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "7px 10px",
        borderRadius: 7,
        fontSize: 13.5,
        fontWeight: isActive ? 500 : 400,
        color: isActive ? "#185FA5" : "#3a3a3a",
        background: isActive ? "#EBF2FA" : "transparent",
        marginBottom: 2,
        textDecoration: "none",
        borderLeft: isActive ? "2px solid #185FA5" : "2px solid transparent",
        transition: "background 0.12s, color 0.12s",
      }}
    >
      <span style={{ opacity: isActive ? 1 : 0.55, flexShrink: 0 }}>{icon}</span>
      {children}
    </Link>
  );
}
