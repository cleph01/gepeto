"use client";

import { useEffect } from "react";

// Shown when the tracking page can't load, e.g. the database is unreachable.
// The link itself is fine, so this asks the office to retry, not to get a new one.
export default function TrackingError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[tracking page]", error);
  }, [error]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#F8F9FB",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: 24,
    }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{
          width: 56, height: 56, background: "#fff", borderRadius: 13, padding: 5, boxSizing: "border-box",
          border: "1px solid rgba(0,0,0,0.08)", margin: "0 auto 20px",
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/gepeto-icon.png" alt="Gepeto" style={{ width: "100%", height: "100%" }} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1a1a1a", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
          We couldn&apos;t load your deliveries
        </h1>
        <p style={{ fontSize: 14, color: "#5F5E5A", margin: "0 0 24px", lineHeight: 1.6 }}>
          Your link is fine. This is a problem on our end and usually clears up quickly.
        </p>
        <button
          onClick={() => unstable_retry()}
          style={{
            background: "#185FA5",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
