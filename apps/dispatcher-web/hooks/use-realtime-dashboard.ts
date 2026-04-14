"use client";

import { useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";

type JobStatus = "pending" | "assigned" | "picked_up" | "in_transit" | "arrived" | "delivered";

interface DashboardJob {
  id: string;
  caseId: string;
  officeName: string;
  driverName: string | null;
  priority: "stat" | "standard";
  status: JobStatus;
  updatedAt: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
}

interface DashboardDriver {
  id: string;
  name: string;
  status: string;
  activeJobs: number;
  currentLocation: { lat: number; lng: number } | null;
}

interface Props {
  session: Session | null;
  setJobs: React.Dispatch<React.SetStateAction<DashboardJob[]>>;
  setDrivers: React.Dispatch<React.SetStateAction<DashboardDriver[]>>;
  /** Fetches a single enriched job from the API and upserts it into state. */
  refetchJob: (id: string) => Promise<void>;
}

export function useRealtimeDashboard({ session, setJobs, setDrivers, refetchJob }: Props) {
  const labId = (session?.user.app_metadata as Record<string, string> | undefined)?.lab_id;

  useEffect(() => {
    if (!labId) return;

    const channel = supabaseBrowser
      .channel(`dashboard:${labId}`)

      // ── Jobs: INSERT and UPDATE ──────────────────────────────────────────────
      // Re-fetch the enriched job (with officeName + driverName) via the API.
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jobs", filter: `lab_id=eq.${labId}` },
        (payload) => { refetchJob(payload.new.id as string); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `lab_id=eq.${labId}` },
        (payload) => { refetchJob(payload.new.id as string); }
      )

      // ── Jobs: DELETE ─────────────────────────────────────────────────────────
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "jobs", filter: `lab_id=eq.${labId}` },
        (payload) => {
          setJobs((prev) => prev.filter((j) => j.id !== (payload.old as { id: string }).id));
        }
      )

      // ── Drivers: UPDATE (status + location changes) ──────────────────────────
      // Merge raw DB fields without a round-trip — joined fields (activeJobs) are
      // not affected by status/location changes so we keep the existing values.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "drivers", filter: `lab_id=eq.${labId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            status: string;
            current_location: { lat: number; lng: number } | null;
          };
          setDrivers((prev) =>
            prev.map((d) =>
              d.id === row.id
                ? { ...d, status: row.status, currentLocation: row.current_location }
                : d
            )
          );
        }
      )

      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, [labId]); // eslint-disable-line react-hooks/exhaustive-deps
}
