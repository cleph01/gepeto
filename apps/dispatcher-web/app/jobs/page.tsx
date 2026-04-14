"use client";

import { useEffect, useState } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useAuth } from "@/context/auth";
import type { ApiResponse } from "@gepeto/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type JobStatus =
  | "pending"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "arrived"
  | "delivered";

type JobPriority = "stat" | "standard";
type ItemFlag = "fragile" | "temperature_sensitive" | "rush" | "biohazard";

interface Job {
  id: string;
  caseId: string;
  office: string;
  deliveryAddress: string;
  driver: string | null;
  priority: JobPriority;
  status: JobStatus;
  itemDescription: string;
  flags: ItemFlag[];
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string }> = {
  pending:    { label: "Pending",    color: "#5F5E5A", bg: "rgba(95,94,90,0.10)"  },
  assigned:   { label: "Assigned",   color: "#185FA5", bg: "rgba(24,95,165,0.08)" },
  picked_up:  { label: "Picked Up",  color: "#185FA5", bg: "rgba(24,95,165,0.10)" },
  in_transit: { label: "In Transit", color: "#185FA5", bg: "rgba(24,95,165,0.10)" },
  arrived:    { label: "Arrived",    color: "#854F0B", bg: "rgba(133,79,11,0.10)" },
  delivered:  { label: "Delivered",  color: "#3B6D11", bg: "rgba(59,109,17,0.10)" },
};

const STATUS_ORDER: JobStatus[] = [
  "pending", "assigned", "picked_up", "in_transit", "arrived", "delivered",
];

const FLAG_CONFIG: Record<ItemFlag, { label: string; color: string; bg: string }> = {
  fragile:              { label: "Fragile",       color: "#854F0B", bg: "rgba(133,79,11,0.10)" },
  temperature_sensitive:{ label: "Temp Sensitive", color: "#185FA5", bg: "rgba(24,95,165,0.10)" },
  rush:                 { label: "Rush",           color: "#A32D2D", bg: "rgba(163,45,45,0.10)" },
  biohazard:            { label: "Biohazard",      color: "#5F5E5A", bg: "rgba(95,94,90,0.10)"  },
};

type OfficeOption  = { id: string; name: string; address: string };
type DriverOption  = { id: string; name: string };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Seed data ────────────────────────────────────────────────────────────────


type FilterTab = "all" | JobStatus;

// ─── New Job Modal ────────────────────────────────────────────────────────────

interface NewJobModalProps {
  onClose: () => void;
  offices: OfficeOption[];
  drivers: DriverOption[];
  onSave: (data: { caseId: string; officeId: string; driverId: string | null; deliveryAddress: string; priority: JobPriority; itemDescription: string; flags: ItemFlag[] }) => void;
}

function NewJobModal({ onClose, offices, drivers, onSave }: NewJobModalProps) {
  const [caseId, setCaseId]         = useState("");
  const [officeId, setOfficeId]     = useState("");
  const [driverId, setDriverId]     = useState<string | null>(null);
  const [priority, setPriority]     = useState<JobPriority>("standard");
  const [itemDesc, setItemDesc]     = useState("");
  const [flags, setFlags]           = useState<ItemFlag[]>([]);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  const toggleFlag = (f: ItemFlag) =>
    setFlags((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!caseId.trim())   e.caseId   = "Case ID is required.";
    if (!officeId)        e.office   = "Please select an office.";
    if (!itemDesc.trim()) e.itemDesc = "Item description is required.";
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    const selectedOffice = offices.find((o) => o.id === officeId);
    onSave({
      caseId: caseId.trim().toUpperCase(),
      officeId,
      deliveryAddress: selectedOffice?.address ?? "",
      driverId: driverId || null,
      priority,
      itemDescription: itemDesc.trim(),
      flags,
    });
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "#fff", borderRadius: 14, width: "100%", maxWidth: 480,
          margin: "0 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.07)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
              New Job
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5F5E5A" }}>
              Job will be created and appear in the queue immediately.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#9a9a9a", padding: 4, borderRadius: 6,
              display: "flex", alignItems: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}
        >
          {/* Case ID */}
          <div>
            <label style={labelStyle}>Case ID <Required /></label>
            <input
              type="text"
              value={caseId}
              onChange={(e) => { setCaseId(e.target.value); clearError("caseId"); }}
              placeholder="e.g. LAB-2042"
              style={inputStyle(!!errors.caseId)}
              onFocus={focusStyle}
              onBlur={(e) => blurStyle(e, !!errors.caseId)}
            />
            {errors.caseId && <FieldError msg={errors.caseId} />}
          </div>

          {/* Office */}
          <div>
            <label style={labelStyle}>Dental Office <Required /></label>
            <select
              value={officeId}
              onChange={(e) => { setOfficeId(e.target.value); clearError("office"); }}
              style={{ ...inputStyle(!!errors.office), color: officeId ? "#1a1a1a" : "#9a9a9a" }}
              onFocus={focusStyle}
              onBlur={(e) => blurStyle(e, !!errors.office)}
            >
              <option value="" disabled>Select an office…</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            {errors.office && <FieldError msg={errors.office} />}
          </div>

          {/* Driver */}
          <div>
            <label style={labelStyle}>Assign Driver <span style={{ color: "#9a9a9a", fontWeight: 400 }}>(optional)</span></label>
            <select
              value={driverId ?? ""}
              onChange={(e) => setDriverId(e.target.value || null)}
              style={{ ...inputStyle(false), color: driverId ? "#1a1a1a" : "#9a9a9a" }}
              onFocus={focusStyle}
              onBlur={(e) => blurStyle(e, false)}
            >
              <option value="">Unassigned</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label style={labelStyle}>Priority</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["standard", "stat"] as JobPriority[]).map((p) => {
                const selected = priority === p;
                const color = p === "stat" ? "#854F0B" : "#185FA5";
                const bg    = p === "stat" ? "rgba(133,79,11,0.10)" : "rgba(24,95,165,0.08)";
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    style={{
                      flex: 1, padding: "7px 12px", borderRadius: 8, cursor: "pointer",
                      fontSize: 12.5, fontWeight: 500,
                      border: `1.5px solid ${selected ? color : "rgba(0,0,0,0.12)"}`,
                      background: selected ? bg : "transparent",
                      color: selected ? color : "#5F5E5A",
                      transition: "all 0.12s",
                      textTransform: p === "stat" ? "uppercase" : "none",
                      letterSpacing: p === "stat" ? "0.04em" : "normal",
                    }}
                  >
                    {p === "stat" ? "STAT" : "Standard"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Item description */}
          <div>
            <label style={labelStyle}>Item Description <Required /></label>
            <input
              type="text"
              value={itemDesc}
              onChange={(e) => { setItemDesc(e.target.value); clearError("itemDesc"); }}
              placeholder="e.g. PFM Crown — Upper Right Molar"
              style={inputStyle(!!errors.itemDesc)}
              onFocus={focusStyle}
              onBlur={(e) => blurStyle(e, !!errors.itemDesc)}
            />
            {errors.itemDesc && <FieldError msg={errors.itemDesc} />}
          </div>

          {/* Flags */}
          <div>
            <label style={labelStyle}>Handling Flags</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {(Object.keys(FLAG_CONFIG) as ItemFlag[]).map((f) => {
                const cfg = FLAG_CONFIG[f];
                const active = flags.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFlag(f)}
                    style={{
                      padding: "5px 11px", borderRadius: 20, cursor: "pointer",
                      fontSize: 12, fontWeight: 500,
                      border: `1.5px solid ${active ? cfg.color : "rgba(0,0,0,0.12)"}`,
                      background: active ? cfg.bg : "transparent",
                      color: active ? cfg.color : "#5F5E5A",
                      transition: "all 0.12s",
                    }}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: "9px", fontSize: 13.5, fontWeight: 500,
                border: "1px solid rgba(0,0,0,0.13)", borderRadius: 8,
                background: "#fff", color: "#3a3a3a", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              style={{
                flex: 2, padding: "9px", fontSize: 13.5, fontWeight: 600,
                border: "none", borderRadius: 8,
                background: "#185FA5", color: "white", cursor: "pointer",
              }}
            >
              Create Job
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  function clearError(field: string) {
    setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; });
  }
}

// ─── Status Update Modal ──────────────────────────────────────────────────────

function StatusModal({
  job,
  onClose,
  onSave,
}: {
  job: Job;
  onClose: () => void;
  onSave: (status: JobStatus) => void;
}) {
  const [selected, setSelected] = useState<JobStatus>(job.status);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "#fff", borderRadius: 14, width: "100%", maxWidth: 380,
          margin: "0 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.07)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
              Update Status
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5F5E5A" }}>
              {job.caseId} · {job.office}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9a9a", padding: 4, borderRadius: 6, display: "flex" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
          {STATUS_ORDER.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const active = selected === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSelected(s)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 12px", borderRadius: 8, cursor: "pointer",
                  border: `1.5px solid ${active ? cfg.color : "rgba(0,0,0,0.09)"}`,
                  background: active ? cfg.bg : "transparent",
                  transition: "all 0.1s",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: active ? cfg.color : "#3a3a3a" }}>
                  {cfg.label}
                </span>
                {active && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7l3 3 6-6" stroke={cfg.color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "0 20px 20px", display: "flex", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: "9px", fontSize: 13.5, fontWeight: 500,
              border: "1px solid rgba(0,0,0,0.13)", borderRadius: 8,
              background: "#fff", color: "#3a3a3a", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(selected)}
            style={{
              flex: 2, padding: "9px", fontSize: 13.5, fontWeight: 600,
              border: "none", borderRadius: 8,
              background: "#185FA5", color: "white", cursor: "pointer",
            }}
          >
            Save Status
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Job Detail Row ───────────────────────────────────────────────────────────

function JobDetailRow({ job }: { job: Job }) {
  return (
    <div
      style={{
        padding: "12px 16px 14px 56px",
        background: "#FAFBFD",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 16,
      }}
    >
      <DetailField label="Delivery Address" value={job.deliveryAddress} />
      <DetailField label="Item" value={job.itemDescription} />
      <div>
        <p style={{ margin: "0 0 4px", fontSize: 10.5, fontWeight: 500, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Handling Flags
        </p>
        {job.flags.length === 0 ? (
          <span style={{ fontSize: 12.5, color: "#9a9a9a" }}>None</span>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {job.flags.map((f) => {
              const cfg = FLAG_CONFIG[f];
              return (
                <span
                  key={f}
                  style={{
                    fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 20,
                    background: cfg.bg, color: cfg.color,
                  }}
                >
                  {cfg.label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: "0 0 3px", fontSize: 10.5, fontWeight: 500, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </p>
      <p style={{ margin: 0, fontSize: 12.5, color: "#3a3a3a", lineHeight: 1.4 }}>{value}</p>
    </div>
  );
}

// ─── Job Row ──────────────────────────────────────────────────────────────────

function JobRow({
  job,
  bp,
  isLast,
  expanded,
  onToggleExpand,
  onUpdateStatus,
}: {
  job: Job;
  bp: "tablet" | "desktop";
  isLast: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdateStatus: () => void;
}) {
  const status = STATUS_CONFIG[job.status];
  const cols = bp === "tablet"
    ? "32px 100px 1fr 120px 100px"
    : "32px 110px 1fr 130px 80px 120px 90px 110px";

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: cols,
          padding: "9px 16px",
          borderBottom: !isLast || expanded ? "1px solid rgba(0,0,0,0.05)" : "none",
          alignItems: "center",
          cursor: "pointer",
          transition: "background 0.1s",
          background: expanded ? "rgba(24,95,165,0.025)" : "transparent",
        }}
        onMouseEnter={(e) => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
        onMouseLeave={(e) => { if (!expanded) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        {/* Expand toggle */}
        <button
          onClick={onToggleExpand}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#9a9a9a", padding: 2, borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Case ID */}
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "#185FA5", fontFamily: "monospace" }}>
          {job.caseId}
        </span>

        {/* Office */}
        <span style={{ fontSize: 13, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
          {job.office}
        </span>

        {/* Driver — desktop only */}
        {bp === "desktop" && (
          <span style={{ fontSize: 12.5, color: job.driver ? "#3a3a3a" : "#9a9a9a" }}>
            {job.driver ?? "Unassigned"}
          </span>
        )}

        {/* Priority — desktop only */}
        {bp === "desktop" && (
          <span>
            {job.priority === "stat" ? (
              <span style={{ fontSize: 10.5, fontWeight: 500, background: "rgba(133,79,11,0.10)", color: "#854F0B", borderRadius: 20, padding: "2px 8px", letterSpacing: "0.03em", textTransform: "uppercase" }}>
                STAT
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "#9a9a9a" }}>Standard</span>
            )}
          </span>
        )}

        {/* Status */}
        <span>
          <span style={{ fontSize: 11.5, fontWeight: 500, background: status.bg, color: status.color, borderRadius: 20, padding: "2.5px 9px" }}>
            {status.label}
          </span>
        </span>

        {/* Updated — desktop only */}
        {bp === "desktop" && (
          <span style={{ fontSize: 12, color: "#9a9a9a" }}>{job.updatedAt}</span>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
          <ActionButton onClick={onUpdateStatus} title="Update status">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1.5A4.5 4.5 0 101 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M1 2.5V6h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 11.5 }}>Status</span>
          </ActionButton>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && <JobDetailRow job={job} />}
    </>
  );
}

// ─── Mobile Job Card ──────────────────────────────────────────────────────────

function JobCard({ job, onUpdateStatus }: { job: Job; onUpdateStatus: () => void }) {
  const status = STATUS_CONFIG[job.status];
  return (
    <div
      style={{
        padding: "12px 16px",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        background: "#fff",
      }}
    >
      {/* Top row: case ID + priority */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#185FA5", fontFamily: "monospace" }}>
          {job.caseId}
        </span>
        {job.priority === "stat" && (
          <span style={{ fontSize: 10, fontWeight: 500, background: "rgba(133,79,11,0.10)", color: "#854F0B", borderRadius: 20, padding: "2px 8px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
            STAT
          </span>
        )}
      </div>

      {/* Office */}
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "#1a1a1a", marginBottom: 2 }}>{job.office}</div>

      {/* Driver */}
      <div style={{ fontSize: 12, color: job.driver ? "#5F5E5A" : "#9a9a9a", marginBottom: 10 }}>
        {job.driver ? `Driver: ${job.driver}` : "Unassigned"}
      </div>

      {/* Bottom row: status + action + timestamp */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11.5, fontWeight: 500, background: status.bg, color: status.color, borderRadius: 20, padding: "3px 10px" }}>
          {status.label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#9a9a9a" }}>{job.updatedAt}</span>
          <ActionButton onClick={onUpdateStatus} title="Update status">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1.5A4.5 4.5 0 101 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M1 2.5V6h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 11.5 }}>Status</span>
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ApiJobFull = {
  id: string; caseId: string; officeName: string; driverName: string | null;
  priority: JobPriority; status: JobStatus; items: { description: string; flags: ItemFlag[] }[];
  deliveryAddress: string; createdAt: string; updatedAt: string;
};

function mapJob(j: ApiJobFull): Job {
  return {
    id: j.id,
    caseId: j.caseId,
    office: j.officeName,
    deliveryAddress: j.deliveryAddress,
    driver: j.driverName,
    priority: j.priority,
    status: j.status,
    itemDescription: j.items?.[0]?.description ?? "",
    flags: j.items?.[0]?.flags ?? [],
    createdAt: new Date(j.createdAt).toLocaleString(),
    updatedAt: timeAgo(j.updatedAt),
  };
}

export default function JobsPage() {
  const bp = useBreakpoint();
  const { apiFetch, session } = useAuth();
  const [jobs, setJobs]               = useState<Job[]>([]);
  const [offices, setOffices]         = useState<OfficeOption[]>([]);
  const [drivers, setDrivers]         = useState<DriverOption[]>([]);
  const [showNewJob, setShowNewJob]   = useState(false);
  const [statusJob, setStatusJob]     = useState<Job | null>(null);
  const [filter, setFilter]           = useState<FilterTab>("all");
  const [expandedId, setExpandedId]   = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      apiFetch<ApiResponse<ApiJobFull[]>>("/api/jobs"),
      apiFetch<ApiResponse<OfficeOption[]>>("/api/offices"),
      apiFetch<ApiResponse<DriverOption[]>>("/api/drivers"),
    ]).then(([jobsRes, officesRes, driversRes]) => {
      if (jobsRes.data)    setJobs(jobsRes.data.map(mapJob));
      if (officesRes.data) setOffices(officesRes.data);
      if (driversRes.data) setDrivers(driversRes.data);
    });
  }, [session]);

  const onCreateJob = async (data: { caseId: string; officeId: string; driverId: string | null; deliveryAddress: string; priority: JobPriority; itemDescription: string; flags: ItemFlag[] }) => {
    const res = await apiFetch<ApiResponse<ApiJobFull>>("/api/jobs", {
      method: "POST",
      body: JSON.stringify({
        caseId: data.caseId,
        officeId: data.officeId,
        driverId: data.driverId,
        priority: data.priority,
        pickupAddress: "Lab pickup",
        deliveryAddress: data.deliveryAddress,
        items: [{ description: data.itemDescription, quantity: 1, flags: data.flags }],
      }),
    });
    if (res.data) setJobs((prev) => [mapJob(res.data!), ...prev]);
    setShowNewJob(false);
  };

  const onUpdateStatus = async (jobId: string, status: JobStatus) => {
    const res = await apiFetch<ApiResponse<ApiJobFull>>(`/api/jobs/${jobId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (res.data) setJobs((prev) => prev.map((j) => j.id === jobId ? mapJob(res.data!) : j));
    setStatusJob(null);
  };

  const filtered = filter === "all" ? jobs : jobs.filter((j) => j.status === filter);

  const counts = {
    all:         jobs.length,
    pending:     jobs.filter((j) => j.status === "pending").length,
    assigned:    jobs.filter((j) => j.status === "assigned").length,
    picked_up:   jobs.filter((j) => j.status === "picked_up").length,
    in_transit:  jobs.filter((j) => j.status === "in_transit").length,
    arrived:     jobs.filter((j) => j.status === "arrived").length,
    delivered:   jobs.filter((j) => j.status === "delivered").length,
  };

  const activeCount = counts.assigned + counts.picked_up + counts.in_transit + counts.arrived;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F8F9FB" }}>

      {/* Header */}
      <header
        style={{
          padding: "0 28px", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#FFFFFF", borderBottom: "1px solid rgba(0,0,0,0.08)", flexShrink: 0,
        }}
      >
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: 0, letterSpacing: "-0.01em" }}>
            Jobs
          </h1>
          <p style={{ fontSize: 11.5, color: "#5F5E5A", margin: 0, fontWeight: 400 }}>
            {activeCount} active · {counts.pending} pending · {counts.delivered} delivered today
          </p>
        </div>
        <button
          onClick={() => setShowNewJob(true)}
          style={{
            background: "#185FA5", color: "white", border: "none",
            borderRadius: 7, padding: "6px 14px", fontSize: 13, fontWeight: 500,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            letterSpacing: "-0.01em",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          New Job
        </button>
      </header>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: bp === "mobile" ? "12px" : "20px 24px" }}>

        {/* Stats */}
        <div className="stats-grid">
          <StatCard label="Total Jobs"      value={counts.all}        />
          <StatCard label="Active"          value={activeCount}       color="#185FA5" />
          <StatCard label="Delivered Today" value={counts.delivered}  color="#3B6D11" />
          <StatCard label="Pending"         value={counts.pending}    color="#854F0B" />
        </div>

        {/* Table */}
        <div
          style={{
            background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 12, overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>All Jobs</span>
              <span style={{ background: "#185FA5", color: "white", fontSize: 10, fontWeight: 500, borderRadius: 20, padding: "1px 7px" }}>
                {filtered.length}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {([
                ["all",         "All"],
                ["pending",     "Pending"],
                ["in_transit",  "In Transit"],
                ["delivered",   "Delivered"],
              ] as [FilterTab, string][]).map(([f, label]) => {
                const active = filter === f;
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      fontSize: 11.5, fontWeight: active ? 500 : 400,
                      color: active ? "#185FA5" : "#5F5E5A",
                      background: active ? "#EBF2FA" : "transparent",
                      border: `1px solid ${active ? "#185FA5" : "rgba(0,0,0,0.10)"}`,
                      borderRadius: 6, padding: "3px 9px", cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column headers — hidden on mobile (cards have no header row) */}
          {bp !== "mobile" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: bp === "tablet"
                  ? "32px 100px 1fr 120px 100px"
                  : "32px 110px 1fr 130px 80px 120px 90px 110px",
                padding: "6px 16px",
                background: "#FAFAFA", borderBottom: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              {(bp === "tablet"
                ? ["", "Case ID", "Office", "Status", ""]
                : ["", "Case ID", "Office", "Driver", "Priority", "Status", "Updated", ""]
              ).map((col, i) => (
                <span key={i} style={{ fontSize: 11, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {col}
                </span>
              ))}
            </div>
          )}

          {/* Rows */}
          {filtered.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "#9a9a9a", fontSize: 13 }}>
              No jobs with this status.
            </div>
          ) : bp === "mobile" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {filtered.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onUpdateStatus={() => setStatusJob(job)}
                />
              ))}
            </div>
          ) : (
            filtered.map((job, i) => (
              <JobRow
                key={job.id}
                job={job}
                bp={bp}
                isLast={i === filtered.length - 1}
                expanded={expandedId === job.id}
                onToggleExpand={() => setExpandedId(expandedId === job.id ? null : job.id)}
                onUpdateStatus={() => setStatusJob(job)}
              />
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {showNewJob && (
        <NewJobModal onClose={() => setShowNewJob(false)} onSave={onCreateJob} offices={offices} drivers={drivers} />
      )}
      {statusJob && (
        <StatusModal
          job={statusJob}
          onClose={() => setStatusJob(null)}
          onSave={(status) => onUpdateStatus(statusJob.id, status)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color = "#1a1a1a" }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
      <div style={{ fontSize: 26, fontWeight: 600, color, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#5F5E5A", fontWeight: 400, marginTop: 4 }}>{label}</div>
    </div>
  );
}

function ActionButton({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: "none", border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 6, padding: "4px 8px", cursor: "pointer",
        color: "#5F5E5A", display: "flex", alignItems: "center", gap: 4,
        fontSize: 11.5, transition: "all 0.1s",
      }}
      onMouseEnter={(e) => { const el = e.currentTarget; el.style.background = "rgba(0,0,0,0.05)"; el.style.borderColor = "rgba(0,0,0,0.18)"; }}
      onMouseLeave={(e) => { const el = e.currentTarget; el.style.background = "none"; el.style.borderColor = "rgba(0,0,0,0.10)"; }}
    >
      {children}
    </button>
  );
}

function Required() {
  return <span style={{ color: "#A32D2D" }}>*</span>;
}

function FieldError({ msg }: { msg: string }) {
  return <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#A32D2D" }}>{msg}</p>;
}

// ─── Shared form styles ───────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: "#3a3a3a", display: "block", marginBottom: 5,
};

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "8px 11px", fontSize: 13.5,
    border: `1px solid ${hasError ? "#A32D2D" : "rgba(0,0,0,0.14)"}`,
    borderRadius: 8, outline: "none", color: "#1a1a1a",
    background: hasError ? "rgba(163,45,45,0.04)" : "#fff",
    boxSizing: "border-box",
    appearance: "none" as const,
  };
}

function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "#185FA5";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(24,95,165,0.10)";
}

function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>, hasError: boolean) {
  e.currentTarget.style.borderColor = hasError ? "#A32D2D" : "rgba(0,0,0,0.14)";
  e.currentTarget.style.boxShadow = "none";
}
