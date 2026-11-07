"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth";
import type { ApiResponse } from "@gepeto/types";

const day = (iso: string) => new Date(iso).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" });

// Shown on every page once a lab's subscription has ended and it's read-only.
export default function ReadOnlyBanner() {
  const { apiFetch, session } = useAuth();
  const [status, setStatus] = useState<{ readOnly: boolean; dataDeletedOn: string | null; isOwner: boolean } | null>(null);

  useEffect(() => {
    if (!session) return;
    apiFetch<ApiResponse<{ readOnly: boolean; dataDeletedOn: string | null; isOwner: boolean }>>("/api/lab-status")
      .then((res) => { if (res.data) setStatus(res.data); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  if (!status?.readOnly) return null;
  return (
    <div role="status" style={{ background: "#FFF8F0", borderBottom: "1px solid #F5D9B5", color: "#6B3F08", fontSize: 13, lineHeight: 1.45, padding: "9px 20px" }}>
      <strong>Your subscription has ended, so Gepeto is read-only.</strong>{" "}
      {status.dataDeletedOn && <>You can view your records until {day(status.dataDeletedOn)}. </>}
      {status.isOwner
        ? <Link href="/settings?section=billing" style={{ color: "#6B3F08", fontWeight: 600 }}>Start a plan</Link>
        : "Ask your lab owner to start a plan."}
    </div>
  );
}
