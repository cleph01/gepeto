"use client";

import { useEffect, useState } from "react";

/** "12:10", or "Nov 3, 12:10" for a break that started on an earlier day. */
function startedAt(since: Date, now: Date) {
  const time = since.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(/\s?[AP]M$/, "");
  if (since.toDateString() === now.toDateString()) return time;
  return `${since.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

function length(mins: number) {
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
}

/**
 * Stands in for a driver's status during a break. Turns amber with the running
 * time once it passes the lab's limit (flagAfterMins is null when that's off).
 */
export function BreakPill({ since, flagAfterMins }: { since: string; flagAfterMins?: number | null }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(since);
  const mins = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 60_000));
  const flagged = flagAfterMins != null && mins >= flagAfterMins;

  return (
    <span style={{
      display: "inline-block",
      fontSize: 11.5,
      fontWeight: 500,
      lineHeight: 1.35,
      borderRadius: 10,
      padding: "2.5px 9px",
      background: flagged ? "rgba(133,79,11,0.14)" : "rgba(95,94,90,0.10)",
      color: flagged ? "#854F0B" : "#5F5E5A",
    }}>
      On break since {startedAt(start, now)}
      {flagged && <> · {length(mins)}</>}
    </span>
  );
}
