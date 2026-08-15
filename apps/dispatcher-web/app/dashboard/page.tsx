"use client";

import { useEffect, useState, lazy, Suspense, useCallback } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useAuth } from "@/context/auth";
import { useRealtimeDashboard } from "@/hooks/use-realtime-dashboard";
import type { ApiResponse } from "@gepeto/types";

const LiveMap = lazy(() => import("@/components/live-map"));

type ApiJob = {
  id: string; caseId: string; officeName: string; driverName: string | null;
  priority: "stat" | "standard"; status: "pending" | "assigned" | "picked_up" | "in_transit" | "arrived" | "delivered";
  updatedAt: string; deliveryLat: number | null; deliveryLng: number | null;
};
type ApiDriver = {
  id: string; name: string; status: string; activeJobs: number; currentLocation: { lat: number; lng: number } | null;
};

export default function DashboardPage() {
  const bp = useBreakpoint();
  const { apiFetch, session } = useAuth();
  const [jobs, setJobs]       = useState<ApiJob[]>([]);
  const [drivers, setDrivers] = useState<ApiDriver[]>([]);
  const [labName, setLabName] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    if (!session) return;
    Promise.all([
      apiFetch<ApiResponse<ApiJob[]>>("/api/jobs"),
      apiFetch<ApiResponse<ApiDriver[]>>("/api/drivers"),
      apiFetch<ApiResponse<{ lab: { name: string } }>>("/api/settings"),
    ]).then(([jobsRes, driversRes, settingsRes]) => {
      if (jobsRes.data)      setJobs(jobsRes.data);
      if (driversRes.data)   setDrivers(driversRes.data);
      if (settingsRes.data)  setLabName(settingsRes.data.lab.name);
    });
  }, [session]);

  // Upserts a single enriched job into state (used by Realtime hook)
  const refetchJob = useCallback(async (id: string) => {
    const res = await apiFetch<ApiResponse<ApiJob>>(`/api/jobs/${id}`);
    if (!res.data) return;
    setJobs((prev) => {
      const exists = prev.some((j) => j.id === id);
      return exists
        ? prev.map((j) => j.id === id ? res.data! : j)
        : [res.data!, ...prev];
    });
  }, [apiFetch]);

  // Live Realtime subscription
  useRealtimeDashboard({ session, setJobs, setDrivers, refetchJob });

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const today = now.toDateString();
  const metrics = {
    total:      jobs.length,
    inTransit:  jobs.filter((j) => j.status === "in_transit").length,
    delivered:  jobs.filter((j) => j.status === "delivered" && new Date(j.updatedAt).toDateString() === today).length,
    pending:    jobs.filter((j) => j.status === "pending").length,
  };
  const activeJobs = jobs.filter((j) => !["delivered", "rejected"].includes(j.status));
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F8F9FB" }}>
      {/* Top header bar */}
      <header
        style={{
          padding: "0 28px",
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#FFFFFF",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: 0, letterSpacing: "-0.01em" }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 11.5, color: "#5F5E5A", margin: 0, fontWeight: 400 }}>
            {now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}
            {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            {labName ? ` · ${labName}` : null}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Search */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "#F8F9FB",
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 7,
              padding: "5px 10px",
              width: 200,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ opacity: 0.4, flexShrink: 0 }}>
              <circle cx="5.5" cy="5.5" r="4" stroke="#1a1a1a" strokeWidth="1.3" />
              <path d="M8.5 8.5L11 11" stroke="#1a1a1a" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 12.5, color: "#9a9a9a", fontWeight: 400 }}>Search jobs, drivers…</span>
          </div>
          {/* New Job button */}
          <button
            style={{
              background: "#185FA5",
              color: "white",
              border: "none",
              borderRadius: 7,
              padding: "6px 14px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              letterSpacing: "-0.01em",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New Job
          </button>
        </div>
      </header>

      {/* Body: left panel + map panel */}
      <div style={{
        display: "flex",
        flex: 1,
        overflow: bp === "desktop" ? "hidden" : "auto",
        flexDirection: bp === "desktop" ? "row" : "column",
      }}>
        {/* LEFT PANEL */}
        <div style={{
          flex: bp === "desktop" ? "0 0 55%" : "none",
          overflowY: bp === "desktop" ? "auto" : "visible",
          padding: bp === "mobile" ? "12px" : bp === "tablet" ? "16px" : "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}>
          {/* Metrics row */}
          <div className="stats-grid">
            <MetricCard value={String(metrics.total)}     label="Total Jobs" />
            <MetricCard value={String(metrics.inTransit)} label="In Transit"     color="#185FA5" />
            <MetricCard value={String(metrics.delivered)} label="Delivered Today" color="#3B6D11" />
            <MetricCard value={String(metrics.pending)}   label="Pending"        color="#854F0B" />
          </div>

          {/* Active Jobs section */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
            }}
          >
            {/* Table header */}
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid rgba(0,0,0,0.07)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>Active Jobs</span>
                <span
                  style={{
                    background: "#185FA5",
                    color: "white",
                    fontSize: 10,
                    fontWeight: 500,
                    borderRadius: 20,
                    padding: "1px 7px",
                  }}
                >
                  {activeJobs.length}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <FilterChip active>All</FilterChip>
                <FilterChip>STAT</FilterChip>
                <FilterChip>In Transit</FilterChip>
                <FilterChip>Pending</FilterChip>
              </div>
            </div>

            {/* Column headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "100px 1fr 110px 80px 110px 80px",
                padding: "6px 16px",
                background: "#FAFAFA",
                borderBottom: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              {["Case ID", "Office", "Driver", "Priority", "Status", "Updated"].map((col) => (
                <span
                  key={col}
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    color: "#5F5E5A",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {col}
                </span>
              ))}
            </div>

            {/* Job rows */}
            {activeJobs.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "#9a9a9a", fontSize: 13 }}>
                No active jobs.
              </div>
            ) : (
              activeJobs.map((job, i) => (
                <JobRow key={job.id} job={job} isLast={i === activeJobs.length - 1} />
              ))
            )}
          </div>

          {/* Driver roster */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid rgba(0,0,0,0.07)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>Drivers On Shift</span>
              <span style={{ fontSize: 12, color: "#185FA5", fontWeight: 500, cursor: "pointer" }}>View all →</span>
            </div>
            <div style={{ padding: "8px 0" }}>
              {drivers.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: "#9a9a9a", fontSize: 13 }}>No drivers.</div>
              ) : (
                drivers.map((d) => <DriverRow key={d.id} driver={d} />)
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Live Map */}
        <div style={{
          flex: bp === "desktop" ? "0 0 45%" : "none",
          padding: bp === "mobile" ? "0 12px 12px" : bp === "tablet" ? "0 16px 16px" : "20px 24px 20px 0",
          display: "flex",
          flexDirection: "column",
          height: bp === "mobile" ? 280 : bp === "tablet" ? 340 : undefined,
        }}>
          <div
            style={{
              background: "#1a2535",
              borderRadius: 12,
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.12)",
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
              position: "relative",
            }}
          >
            {/* Map header */}
            <div
              style={{
                padding: "10px 14px",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#3B6D11",
                    boxShadow: "0 0 6px #3B6D11",
                  }}
                />
                <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.9)" }}>Live Map</span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>{drivers.filter((d) => d.status === "on_delivery").length} drivers active</span>
                <button
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "none",
                    borderRadius: 5,
                    padding: "3px 8px",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  ⟨ Collapse
                </button>
              </div>
            </div>

            {/* Map body */}
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
              <Suspense fallback={
                <div style={{ width: "100%", height: "100%", background: "#1a2535", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading map…</span>
                </div>
              }>
                <LiveMap
                  drivers={drivers}
                  jobs={activeJobs.map((j) => ({
                    id: j.id,
                    caseId: j.caseId,
                    officeName: j.officeName,
                    status: j.status,
                    deliveryLat: j.deliveryLat,
                    deliveryLng: j.deliveryLng,
                  }))}
                />
              </Suspense>
            </div>

            {/* Map legend */}
            <div
              style={{
                padding: "8px 14px",
                borderTop: "1px solid rgba(255,255,255,0.07)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", gap: 12 }}>
                <LegendItem color="#185FA5" label="In Transit" />
                <LegendItem color="#3B6D11" label="Delivered" />
                <LegendItem color="#854F0B" label="STAT" />
              </div>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                Map powered by OpenStreetMap
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({
  value,
  label,
  color = "#1a1a1a",
}: {
  value: string;
  label: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
        padding: "14px 16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
      }}
    >
      <div
        style={{
          fontSize: 26,
          fontWeight: 600,
          color,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: "#5F5E5A",
          fontWeight: 400,
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function FilterChip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button
      style={{
        fontSize: 11.5,
        fontWeight: active ? 500 : 400,
        color: active ? "#185FA5" : "#5F5E5A",
        background: active ? "#EBF2FA" : "transparent",
        border: `1px solid ${active ? "#185FA5" : "rgba(0,0,0,0.10)"}`,
        borderRadius: 6,
        padding: "3px 9px",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

type Job = {
  id: string;
  caseId: string;
  officeName: string;
  driverName: string | null;
  priority: "stat" | "standard";
  status: "pending" | "assigned" | "picked_up" | "in_transit" | "arrived" | "delivered";
  updatedAt: string;
};

const STATUS_CONFIG: Record<Job["status"], { label: string; bg: string; text: string }> = {
  pending:    { label: "Pending",    bg: "rgba(95,94,90,0.10)",  text: "#5F5E5A" },
  assigned:   { label: "Assigned",   bg: "rgba(24,95,165,0.08)", text: "#185FA5" },
  picked_up:  { label: "Picked Up",  bg: "rgba(24,95,165,0.10)", text: "#185FA5" },
  in_transit: { label: "In Transit", bg: "rgba(24,95,165,0.10)", text: "#185FA5" },
  arrived:    { label: "Arrived",    bg: "rgba(133,79,11,0.10)", text: "#854F0B" },
  delivered:  { label: "Delivered",  bg: "rgba(59,109,17,0.10)", text: "#3B6D11" },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function JobRow({ job, isLast }: { job: Job; isLast: boolean }) {
  const status = STATUS_CONFIG[job.status];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "100px 1fr 110px 80px 110px 80px",
        padding: "9px 16px",
        borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.05)",
        alignItems: "center",
        cursor: "pointer",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "#185FA5", fontFamily: "monospace" }}>
        {job.caseId}
      </span>
      <span style={{ fontSize: 13, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
        {job.officeName}
      </span>
      <span style={{ fontSize: 13, color: "#3a3a3a" }}>{job.driverName ?? "—"}</span>
      <span>
        {job.priority === "stat" ? (
          <span style={{ fontSize: 10.5, fontWeight: 500, background: "rgba(133,79,11,0.10)", color: "#854F0B", borderRadius: 20, padding: "2px 8px", letterSpacing: "0.03em", textTransform: "uppercase" }}>
            STAT
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "#9a9a9a" }}>Standard</span>
        )}
      </span>
      <span>
        <span style={{ fontSize: 11.5, fontWeight: 500, background: status.bg, color: status.text, borderRadius: 20, padding: "2.5px 9px" }}>
          {status.label}
        </span>
      </span>
      <span style={{ fontSize: 12, color: "#9a9a9a" }}>{timeAgo(job.updatedAt)}</span>
    </div>
  );
}

const DRIVER_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  available:    { label: "Available",    color: "#3B6D11", bg: "rgba(59,109,17,0.10)"  },
  on_delivery:  { label: "On Delivery",  color: "#185FA5", bg: "rgba(24,95,165,0.10)"  },
  off_duty:     { label: "Off Duty",     color: "#5F5E5A", bg: "rgba(95,94,90,0.10)"   },
};

function DriverRow({ driver }: { driver: ApiDriver }) {
  const s = DRIVER_STATUS_CONFIG[driver.status] ?? DRIVER_STATUS_CONFIG.off_duty;
  const initials = driver.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 16px", cursor: "pointer", transition: "background 0.1s" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#185FA5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "white", flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{driver.name}</div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 500, background: s.bg, color: s.color, borderRadius: 20, padding: "2px 9px", flexShrink: 0 }}>
        {s.label}
      </span>
      {driver.activeJobs > 0 && (
        <span style={{ fontSize: 12, color: "#5F5E5A", flexShrink: 0 }}>
          {driver.activeJobs} job{driver.activeJobs !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
        }}
      />
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 400 }}>
        {label}
      </span>
    </div>
  );
}
