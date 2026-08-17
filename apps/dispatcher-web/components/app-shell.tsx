"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/context/auth";
import Sidebar from "@/components/sidebar";

const isPublicRoute = (pathname: string) =>
  pathname === "/login" || pathname.startsWith("/signup");

// /accept-invite is a special case: Supabase's invite link establishes a real
// session (via detectSessionInUrl), so `session` is truthy there — but unlike
// /login or /signup, being signed in is exactly the expected state and must
// NOT bounce to /dashboard until the user has actually set a password.
const isInviteRoute = (pathname: string) => pathname === "/accept-invite";

function Guard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
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
          <>
            <Sidebar />
            <main className="main-content">{children}</main>
          </>
        )}
      </Guard>
    </AuthProvider>
  );
}
