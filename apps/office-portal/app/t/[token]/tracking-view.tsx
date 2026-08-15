"use client";

import { useEffect, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type JobStatus = "pending" | "assigned" | "picked_up" | "in_transit" | "arrived" | "delivered";

interface TrackingJob {
  id: string;
  caseId: string;
  status: JobStatus;
  priority: "stat" | "standard";
  deliveryAddress: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  createdAt: string;
  updatedAt: string;
  driverName: string | null;
  driverLocation: { lat: number; lng: number } | null;
}

interface RecentJob {
  id: string;
  caseId: string;
  status: "delivered";
  priority: "stat" | "standard";
  deliveryAddress: string;
  updatedAt: string;
}

interface Office {
  id: string;
  name: string;
  address: string;
  phone: string;
  contactName: string;
  labName: string;
}

interface TrackingData {
  office: Office;
  jobs: TrackingJob[];
  recentDelivered: RecentJob[];
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_STEPS: JobStatus[] = ["pending", "assigned", "picked_up", "in_transit", "arrived", "delivered"];

const STATUS_LABEL: Record<JobStatus, string> = {
  pending:    "Awaiting Pickup",
  assigned:   "Driver Assigned",
  picked_up:  "Package Picked Up",
  in_transit: "In Transit",
  arrived:    "Arrived",
  delivered:  "Delivered",
};

const STATUS_COLOR: Record<JobStatus, { bg: string; text: string; border: string }> = {
  pending:    { bg: "#FFF8F0", text: "#854F0B", border: "#F5D9B5" },
  assigned:   { bg: "#EBF2FA", text: "#185FA5", border: "#C0D9F0" },
  picked_up:  { bg: "#EBF2FA", text: "#185FA5", border: "#C0D9F0" },
  in_transit: { bg: "#EBF2FA", text: "#185FA5", border: "#C0D9F0" },
  arrived:    { bg: "#F0FAF0", text: "#3B6D11", border: "#C0E0C0" },
  delivered:  { bg: "#F0FAF0", text: "#3B6D11", border: "#C0E0C0" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function stepIndex(status: JobStatus): number {
  return STATUS_STEPS.indexOf(status);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TrackingView({
  token,
  initial,
}: {
  token: string;
  initial: TrackingData;
}) {
  const [data, setData] = useState<TrackingData>(initial);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${token}`);
      if (!res.ok) return;
      const json = await res.json();
      if (json.data) {
        setData(json.data);
        setLastUpdated(new Date());
      }
    } catch {
      // silent — stale data is fine
    }
  }, [token]);

  // Poll every 30 seconds
  useEffect(() => {
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const { office, jobs, recentDelivered } = data;

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FB", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* Header */}
      <header style={{
        background: "#FFFFFF",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        padding: "0 24px",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, background: "#185FA5", borderRadius: 8,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2C7.2 2 5.5 2.9 4.5 4.3c-.7 1-1 2.1-.8 3.3l1 5.8c.2 1 1 1.6 1.9 1.6.8 0 1.5-.5 1.8-1.2L9 11.5l1.6 2.3c.3.7 1 1.2 1.8 1.2.9 0 1.7-.6 1.9-1.6l1-5.8c.2-1.2-.1-2.3-.8-3.3C13.5 2.9 11.8 2 10 2H9z" fill="white" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#185FA5", letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              {office.labName}
            </div>
            <div style={{ fontSize: 10.5, color: "#5F5E5A", letterSpacing: "0.03em" }}>
              Delivery Tracker
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: "#9a9a9a" }}>
          Updated {timeAgo(lastUpdated.toISOString())}
        </div>
      </header>

      {/* Body */}
      <main style={{ maxWidth: 680, margin: "0 auto", padding: "28px 20px 48px" }}>

        {/* Office greeting */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
            {office.name}
          </h1>
          <p style={{ fontSize: 13.5, color: "#5F5E5A", margin: 0 }}>
            {jobs.length === 0
              ? "No active deliveries right now."
              : `${jobs.length} active deliver${jobs.length === 1 ? "y" : "ies"} on the way.`}
          </p>
        </div>

        {/* Active jobs */}
        {jobs.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
              Active Deliveries
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </section>
        )}

        {/* Recent delivered */}
        {recentDelivered.length > 0 && (
          <section>
            <div style={{ fontSize: 11, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
              Recent Deliveries
            </div>
            <div style={{
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              overflow: "hidden",
            }}>
              {recentDelivered.map((job, i) => (
                <div
                  key={job.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderBottom: i < recentDelivered.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{job.caseId}</div>
                    <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 2 }}>{job.deliveryAddress}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                    <div style={{
                      display: "inline-block",
                      background: "#F0FAF0",
                      color: "#3B6D11",
                      fontSize: 11,
                      fontWeight: 500,
                      borderRadius: 20,
                      padding: "2px 10px",
                      border: "1px solid #C0E0C0",
                      marginBottom: 4,
                    }}>
                      Delivered
                    </div>
                    <div style={{ fontSize: 11, color: "#9a9a9a" }}>{timeAgo(job.updatedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {jobs.length === 0 && recentDelivered.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "48px 24px",
            background: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a", marginBottom: 6 }}>No deliveries yet</div>
            <div style={{ fontSize: 13, color: "#5F5E5A" }}>
              Your deliveries will appear here once your lab dispatches them.
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: "center",
        padding: "20px",
        fontSize: 12,
        color: "#9a9a9a",
        borderTop: "1px solid rgba(0,0,0,0.06)",
      }}>
        Powered by <span style={{ color: "#185FA5", fontWeight: 500 }}>Gepeto</span> · Updates automatically every 30 seconds
      </footer>
    </div>
  );
}

// ── Job card ──────────────────────────────────────────────────────────────────

function JobCard({ job }: { job: TrackingJob }) {
  const colors = STATUS_COLOR[job.status];
  const currentStep = stepIndex(job.status);

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
    }}>
      {/* Card header */}
      <div style={{
        padding: "14px 16px 12px",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>{job.caseId}</span>
            {job.priority === "stat" && (
              <span style={{
                background: "#FFF0EB",
                color: "#C53B0A",
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 4,
                padding: "1px 6px",
                letterSpacing: "0.03em",
              }}>
                STAT
              </span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: "#5F5E5A" }}>{job.deliveryAddress}</div>
        </div>
        <div style={{
          background: colors.bg,
          color: colors.text,
          border: `1px solid ${colors.border}`,
          fontSize: 11.5,
          fontWeight: 500,
          borderRadius: 20,
          padding: "3px 10px",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {STATUS_LABEL[job.status]}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: 3, marginBottom: 10 }}>
          {STATUS_STEPS.slice(0, 5).map((step, i) => (
            <div
              key={step}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i <= currentStep ? "#185FA5" : "rgba(0,0,0,0.08)",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>

        {/* Step labels */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: "#9a9a9a" }}>Pending</span>
          <span style={{ fontSize: 10, color: "#9a9a9a" }}>In Transit</span>
          <span style={{ fontSize: 10, color: "#9a9a9a" }}>Arrived</span>
        </div>
      </div>

      {/* Driver info */}
      {job.driverName && (
        <div style={{
          padding: "10px 16px",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "6px 8px",
          background: "#FAFAFA",
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            background: "#185FA5",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 600, color: "white", flexShrink: 0,
          }}>
            {job.driverName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontSize: 12.5, color: "#3a3a3a", fontWeight: 500 }}>{job.driverName}</span>
            <span style={{ fontSize: 12, color: "#9a9a9a", marginLeft: 6 }}>· your driver</span>
          </div>
          {job.driverLocation && (
            <span style={{ fontSize: 11, color: "#5F5E5A", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="4" stroke="#3B6D11" strokeWidth="1.5" />
                <circle cx="5" cy="5" r="1.5" fill="#3B6D11" />
              </svg>
              Live location
            </span>
          )}
        </div>
      )}

      {/* Footer meta */}
      <div style={{
        padding: "8px 16px",
        borderTop: "1px solid rgba(0,0,0,0.05)",
        display: "flex",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 11, color: "#9a9a9a" }}>
          Created {timeAgo(job.createdAt)}
        </span>
        <span style={{ fontSize: 11, color: "#9a9a9a" }}>
          Updated {timeAgo(job.updatedAt)}
        </span>
      </div>
    </div>
  );
}
