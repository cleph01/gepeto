"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/context/auth";
import { MessageNotificationsProvider } from "@/context/message-notifications";
import Sidebar from "@/components/sidebar";

const isPublicRoute = (pathname: string) =>
  pathname === "/login" || pathname.startsWith("/signup");

// /accept-invite is a special case: Supabase's invite link establishes a real
// session (via detectSessionInUrl), so `session` is truthy there — but unlike
// /login or /signup, being signed in is exactly the expected state and must
// NOT bounce to /dashboard until the user has actually set a password.
const isInviteRoute = (pathname: string) => pathname === "/accept-invite";

// Same lookup as requireAuth() on the server: app_metadata first, user_metadata for seeded users.
function sessionRole(session: ReturnType<typeof useAuth>["session"]) {
  const meta = session?.user.app_metadata?.role ? session.user.app_metadata : session?.user.user_metadata;
  return meta?.role as string | undefined;
}

// Drivers have valid logins but belong in the driver app, not the dispatcher console.
function DriverRedirect({ email, onSignOut }: { email?: string; onSignOut: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#F8F9FB", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, maxWidth: 380, width: "100%", padding: "28px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", border: "1px solid rgba(0,0,0,0.08)", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 600, color: "#1a1a1a" }}>Use the Gepeto driver app</h1>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#5F5E5A", lineHeight: 1.5 }}>
          This website is for dispatchers. Open the Gepeto driver app on your phone and log in{email ? <> with <strong>{email}</strong></> : null}.
        </p>
        <button
          onClick={onSignOut}
          style={{ background: "#185FA5", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function Guard({ children }: { children: React.ReactNode }) {
  const { session, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (isInviteRoute(pathname)) return;
    if (!session && !isPublicRoute(pathname)) {
      router.replace("/login");
    }
    if (session && isPublicRoute(pathname)) {
      router.replace("/dashboard");
    }
  }, [session, loading, pathname, router]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#F8F9FB" }}>
        <div style={{ width: 24, height: 24, border: "2.5px solid #185FA5", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (session && sessionRole(session) === "driver" && !isPublicRoute(pathname) && !isInviteRoute(pathname)) {
    return <DriverRedirect email={session.user.email} onSignOut={() => { signOut(); }} />;
  }

  return <>{children}</>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = isPublicRoute(pathname) || isInviteRoute(pathname);

  return (
    <AuthProvider>
      <Guard>
        {isPublic ? (
          <>{children}</>
        ) : (
          <MessageNotificationsProvider>
            <Sidebar />
            <main className="main-content">{children}</main>
          </MessageNotificationsProvider>
        )}
      </Guard>
    </AuthProvider>
  );
}
