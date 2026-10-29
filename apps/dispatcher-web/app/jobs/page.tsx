"use client";

import { useEffect, useState } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useAuth } from "@/context/auth";
import type { ApiResponse } from "@gepeto/types";
import { copyToClipboard, trackingUrl } from "@/lib/client-utils";
import { UnreadBadge, useMessageNotifications } from "@/context/message-notifications";

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
  officeId: string;
  officeTrackingToken: string | null;
  deliveryAddress: string;
  driver: string | null;
  driverId: string | null;
  priority: JobPriority;
  status: JobStatus;
  itemDescription: string;
  flags: ItemFlag[];
  createdAt: string;
  updatedAt: string;
  /** Expected delivery time (ISO). Older jobs created before it was required may have none. */
  scheduledAt: string | null;
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

// "Today 3:00 PM", "Tomorrow 9:00 AM", "Tue 10:30 AM" within the week, else "Oct 30, 3:00 PM".
function formatDue(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

function isOverdue(job: Job) {
  return !!job.scheduledAt && job.status !== "delivered" && new Date(job.scheduledAt).getTime() < Date.now();
}

function DueText({ job, fontSize = 12 }: { job: Job; fontSize?: number }) {
  if (!job.scheduledAt) return <span style={{ fontSize, color: "#9a9a9a" }}>—</span>;
  const overdue = isOverdue(job);
  return (
    <span style={{ fontSize, color: overdue ? "#A32D2D" : "#3a3a3a", fontWeight: overdue ? 500 : 400 }}>
      {formatDue(job.scheduledAt)}
    </span>
  );
}

// ─── Seed data ────────────────────────────────────────────────────────────────


type FilterTab = "all" | JobStatus;

// ─── New Job Modal ────────────────────────────────────────────────────────────

interface NewJobModalProps {
  onClose: () => void;
  offices: OfficeOption[];
  drivers: DriverOption[];
  onSave: (data: { caseId: string; officeId: string; driverId: string | null; deliveryAddress: string; priority: JobPriority; itemDescription: string; flags: ItemFlag[]; scheduledAt: string | null }) => void;
}

function NewJobModal({ onClose, offices, drivers, onSave }: NewJobModalProps) {
  const [caseId, setCaseId]         = useState("");
  const [officeId, setOfficeId]     = useState("");
  const [driverId, setDriverId]     = useState<string | null>(null);
  const [priority, setPriority]     = useState<JobPriority>("standard");
  const [itemDesc, setItemDesc]     = useState("");
  const [flags, setFlags]           = useState<ItemFlag[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [errors, setErrors]         = useState<Record<string, string>>({});

  const toggleFlag = (f: ItemFlag) =>
    setFlags((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!caseId.trim())   e.caseId   = "Case ID is required.";
    if (!officeId)        e.office   = "Please select an office.";
    if (!itemDesc.trim()) e.itemDesc = "Item description is required.";
    if (!scheduledAt)     e.scheduledAt = "Expected delivery time is required.";
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
      scheduledAt: new Date(scheduledAt).toISOString(),
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

          {/* Expected delivery time */}
          <div>
            <label style={labelStyle}>Expected Delivery Time <Required /></label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => { setScheduledAt(e.target.value); clearError("scheduledAt"); }}
              style={inputStyle(!!errors.scheduledAt)}
              onFocus={focusStyle}
              onBlur={(e) => blurStyle(e, !!errors.scheduledAt)}
            />
            {errors.scheduledAt && <FieldError msg={errors.scheduledAt} />}
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
  error,
}: {
  job: Job;
  onClose: () => void;
  onSave: (status: JobStatus) => void;
  error?: string | null;
}) {
  const [selected, setSelected] = useState<JobStatus>(job.status);
  // Mirrors PATCH /api/jobs/[id]/status: no driver, no leaving pending.
  const needsDriver = !job.driverId;

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
          {needsDriver && (
            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#854F0B", lineHeight: 1.4 }}>
              No driver assigned. Assign one (click &quot;Assign driver&quot; on the job) before moving it out of Pending.
            </p>
          )}
          {STATUS_ORDER.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const active = selected === s;
            const locked = needsDriver && s !== "pending";
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSelected(s)}
                disabled={locked}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 12px", borderRadius: 8, cursor: locked ? "not-allowed" : "pointer",
                  opacity: locked ? 0.4 : 1,
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

        {error && (
          <p style={{ margin: "0 20px 12px", fontSize: 12, color: "#A32D2D" }}>{error}</p>
        )}

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

// ─── Field Edit Modals ────────────────────────────────────────────────────────
// One small popup per field (case number, office, expected delivery), opened by
// clicking that field on a job, like the status pill. Saves via PATCH /api/jobs/[id].

type EditableField = "caseId" | "officeId" | "scheduledAt";

// datetime-local wants local "YYYY-MM-DDTHH:mm".
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function EditFieldModal({
  job,
  field,
  offices,
  onClose,
  onSave,
  error,
}: {
  job: Job;
  field: EditableField;
  offices: OfficeOption[];
  onClose: () => void;
  onSave: (changes: Partial<Record<EditableField, string>>) => Promise<void>;
  error?: string | null;
}) {
  const initial = field === "caseId" ? job.caseId : field === "officeId" ? job.officeId : toLocalInput(job.scheduledAt);
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);
  const delivered = job.status === "delivered";
  const lockedByDelivery = delivered && field !== "caseId";
  const onTheRoad = ["picked_up", "in_transit", "arrived"].includes(job.status);

  const title = { caseId: "Case Number", officeId: "Office", scheduledAt: "Expected Delivery" }[field];
  const unchanged = value.trim() === initial;
  const canSave = !saving && !lockedByDelivery && !unchanged && value.trim() !== "";

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    await onSave({ [field]: field === "scheduledAt" ? new Date(value).toISOString() : value.trim() });
    setSaving(false);
  };

  const hint =
    lockedByDelivery ? "This job has been delivered, so this can't change."
    : field === "officeId"
      ? onTheRoad
        ? "The driver is already on the way. They'll be alerted to the new destination. The delivery address changes to the new office's, and the new office won't see earlier messages."
        : "The delivery address changes to the new office's. The new office won't see messages from before the change."
    : field === "scheduledAt" && job.driver ? `${job.driver} will be alerted to the change.` : null;

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
              {title}
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

        <div style={{ padding: "16px 20px" }}>
          {field === "officeId" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={lockedByDelivery}
              style={{ ...inputStyle(false), cursor: lockedByDelivery ? "not-allowed" : "pointer" }}
              onFocus={focusStyle}
              onBlur={(e) => blurStyle(e, false)}
            >
              {offices.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          ) : (
            <input
              type={field === "scheduledAt" ? "datetime-local" : "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") save(); }}
              disabled={lockedByDelivery}
              autoFocus
              style={inputStyle(false)}
              onFocus={focusStyle}
              onBlur={(e) => blurStyle(e, false)}
            />
          )}
          {field === "officeId" && (
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#5F5E5A" }}>
              Delivers to: {offices.find((o) => o.id === value)?.address ?? "—"}
            </p>
          )}
          {hint && (
            <p style={{ margin: "8px 0 0", fontSize: 11.5, color: onTheRoad && field === "officeId" ? "#854F0B" : "#9a9a9a", lineHeight: 1.4 }}>
              {hint}
            </p>
          )}
        </div>

        {error && (
          <p style={{ margin: "0 20px 12px", fontSize: 12, color: "#A32D2D" }}>{error}</p>
        )}

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
            onClick={save}
            disabled={!canSave}
            style={{
              flex: 2, padding: "9px", fontSize: 13.5, fontWeight: 600,
              border: "none", borderRadius: 8,
              background: "#185FA5", color: "white",
              cursor: canSave ? "pointer" : "not-allowed",
              opacity: canSave ? 1 : 0.5,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// A job field shown as clickable text that opens its edit popup.
function EditableText({
  onClick,
  title,
  children,
  style,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
        font: "inherit", color: "inherit",
        textDecoration: "underline dotted rgba(0,0,0,0.25)", textUnderlineOffset: 3,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ─── Driver & Priority Modal ──────────────────────────────────────────────────

const PRIORITY_OPTIONS: { value: JobPriority; label: string; color: string; bg: string }[] = [
  { value: "standard", label: "Standard", color: "#3a3a3a", bg: "rgba(0,0,0,0.04)" },
  { value: "stat",     label: "STAT",     color: "#854F0B", bg: "rgba(133,79,11,0.10)" },
];

// Jobs a driver already has in hand can be handed over but not left unassigned
// (mirrors PATCH /api/jobs/[id]).
const CAN_UNASSIGN: JobStatus[] = ["pending", "assigned"];

function AssignModal({
  job,
  drivers,
  onClose,
  onSave,
  error,
}: {
  job: Job;
  drivers: DriverOption[];
  onClose: () => void;
  onSave: (changes: { driverId: string | null; priority: JobPriority }) => Promise<void>;
  error?: string | null;
}) {
  const [driverId, setDriverId] = useState<string>(job.driverId ?? "");
  const [priority, setPriority] = useState<JobPriority>(job.priority);
  const [saving, setSaving] = useState(false);
  const delivered = job.status === "delivered";
  const canUnassign = CAN_UNASSIGN.includes(job.status);

  const save = async () => {
    setSaving(true);
    await onSave({ driverId: driverId || null, priority });
    setSaving(false);
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
              Driver &amp; Priority
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

        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Driver</label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              disabled={delivered}
              style={{ ...inputStyle(false), cursor: delivered ? "not-allowed" : "pointer" }}
              onFocus={focusStyle}
              onBlur={(e) => blurStyle(e, false)}
            >
              <option value="" disabled={!canUnassign && !!job.driverId}>Unassigned</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#9a9a9a", lineHeight: 1.4 }}>
              {delivered
                ? "This job has been delivered, so its driver can't change."
                : job.status === "pending"
                  ? "Assigning a driver moves the job to Assigned. They'll be asked to accept or reject it."
                  : "The new driver will be asked to accept or reject it."}
            </p>
          </div>

          <div>
            <label style={labelStyle}>Priority</label>
            <div style={{ display: "flex", gap: 6 }}>
              {PRIORITY_OPTIONS.map((o) => {
                const active = priority === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setPriority(o.value)}
                    style={{
                      flex: 1, padding: "9px 12px", borderRadius: 8, cursor: "pointer",
                      border: `1.5px solid ${active ? o.color : "rgba(0,0,0,0.09)"}`,
                      background: active ? o.bg : "transparent",
                      fontSize: 13, fontWeight: active ? 600 : 400,
                      color: active ? o.color : "#3a3a3a", transition: "all 0.1s",
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <p style={{ margin: "0 20px 12px", fontSize: 12, color: "#A32D2D" }}>{error}</p>
        )}

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
            onClick={save}
            disabled={saving}
            style={{
              flex: 2, padding: "9px", fontSize: 13.5, fontWeight: 600,
              border: "none", borderRadius: 8,
              background: "#185FA5", color: "white", cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Driver name / priority shown as a clickable cell that opens the AssignModal,
// the same way the status pill opens the status modal.
function DriverButton({ job, onClick, fontSize = 12.5 }: { job: Job; onClick: () => void; fontSize?: number }) {
  return (
    <button
      onClick={onClick}
      title="Change driver or priority"
      style={{
        background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left",
        fontSize, color: job.driver ? "#3a3a3a" : "#185FA5", fontWeight: job.driver ? 400 : 500,
        textDecoration: "underline dotted rgba(0,0,0,0.25)", textUnderlineOffset: 3,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%",
      }}
    >
      {job.driver ?? "Assign driver"}
    </button>
  );
}

function PriorityButton({ priority, onClick, fontSize = 10.5 }: { priority: JobPriority; onClick: () => void; fontSize?: number }) {
  return (
    <button
      onClick={onClick}
      title="Change driver or priority"
      style={priority === "stat"
        ? { fontSize, fontWeight: 500, background: "rgba(133,79,11,0.10)", color: "#854F0B", borderRadius: 20, padding: "2px 8px", letterSpacing: "0.03em", textTransform: "uppercase", border: "none", cursor: "pointer" }
        : { fontSize: fontSize + 1.5, color: "#9a9a9a", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline dotted rgba(0,0,0,0.25)", textUnderlineOffset: 3 }}
    >
      {priority === "stat" ? "STAT" : "Standard"}
    </button>
  );
}

// ─── Messages Modal ───────────────────────────────────────────────────────────

type MessageSenderRole = "dispatcher" | "driver" | "office";

interface JobMessage {
  id: string;
  // @gepeto/db auto-camelCases every query result (see packages/db/db.js
  // postProcessResponse) — these fields are senderRole/createdAt over the
  // wire even though the DB column is sender_role/created_at.
  senderRole: MessageSenderRole;
  body: string;
  createdAt: string;
}

const SENDER_LABEL: Record<MessageSenderRole, string> = {
  dispatcher: "You (Dispatch)",
  driver: "Driver",
  office: "Office",
};

const SENDER_COLOR: Record<MessageSenderRole, string> = {
  dispatcher: "#185FA5",
  driver: "#3B6D11",
  office: "#854F0B",
};

const SENDER_BG: Record<MessageSenderRole, string> = {
  dispatcher: "rgba(24,95,165,0.10)",
  driver: "rgba(59,109,17,0.10)",
  office: "rgba(133,79,11,0.10)",
};

function RoleIcon({ role, color, size = 10 }: { role: MessageSenderRole; color: string; size?: number }) {
  if (role === "dispatcher") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
        <path d="M2.5 7V6a3.5 3.5 0 017 0v1" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
        <rect x="1.5" y="6.5" width="2" height="3" rx="1" fill={color} />
        <rect x="8.5" y="6.5" width="2" height="3" rx="1" fill={color} />
      </svg>
    );
  }
  if (role === "driver") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
        <rect x="1" y="4" width="7.5" height="4" rx="0.75" fill={color} />
        <path d="M8.5 5.5H10.5L11 7V8H8.5V5.5Z" fill={color} />
        <circle cx="3.25" cy="8.5" r="1" fill="white" stroke={color} strokeWidth="1" />
        <circle cx="9" cy="8.5" r="1" fill="white" stroke={color} strokeWidth="1" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <rect x="2" y="1.5" width="8" height="9" rx="0.5" stroke={color} strokeWidth="1.2" />
      <rect x="3.5" y="3" width="1.4" height="1.4" fill={color} />
      <rect x="7" y="3" width="1.4" height="1.4" fill={color} />
      <rect x="3.5" y="5.6" width="1.4" height="1.4" fill={color} />
      <rect x="7" y="5.6" width="1.4" height="1.4" fill={color} />
      <rect x="5" y="8.2" width="2" height="2.3" fill={color} />
    </svg>
  );
}

function MessageRoleLegend() {
  const roles: MessageSenderRole[] = ["dispatcher", "office", "driver"];
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "10px 20px 0" }}>
      {roles.map((r) => (
        <div key={r} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <RoleIcon role={r} color={SENDER_COLOR[r]} size={10} />
          <span style={{ fontSize: 10.5, color: "#5F5E5A" }}>
            {r === "dispatcher" ? "Dispatch (you)" : SENDER_LABEL[r]}
          </span>
        </div>
      ))}
    </div>
  );
}

function MessagesModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const { apiFetch } = useAuth();
  const { markRead, setActiveThread, messageArrived } = useMessageNotifications();
  const [messages, setMessages] = useState<JobMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => {
    apiFetch<ApiResponse<JobMessage[]>>(`/api/jobs/${job.id}/messages`).then((res) => {
      if (res.data) setMessages(res.data);
    });
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 8_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  // A new message on this job: show it now instead of on the next 8s check.
  useEffect(() => {
    if (messageArrived?.jobId === job.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageArrived]);

  useEffect(() => {
    setActiveThread(job.id);
    return () => setActiveThread(null);
  }, [job.id, setActiveThread]);

  // Everything rendered here has been seen — mark read up to the newest one.
  const newestAt = messages.length > 0 ? messages[messages.length - 1].createdAt : null;
  useEffect(() => {
    if (newestAt) markRead(job.id, newestAt);
  }, [job.id, newestAt, markRead]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = await apiFetch<ApiResponse<JobMessage>>(`/api/jobs/${job.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      if (res.data) {
        setMessages((prev) => [...prev, res.data!]);
        setDraft("");
      }
    } finally {
      setSending(false);
    }
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
          background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440,
          margin: "0 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          overflow: "hidden", maxHeight: "80vh", display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>Messages</h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5F5E5A" }}>{job.caseId} · {job.office}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9a9a", padding: 4, borderRadius: 6, display: "flex" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <MessageRoleLegend />

        <div style={{ flex: 1, overflowY: "auto", padding: "10px 20px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ fontSize: 12.5, color: "#9a9a9a", textAlign: "center", padding: "20px 0" }}>No messages yet.</div>
          )}
          {messages.map((m) => (
            <div key={m.id} style={{ alignSelf: m.senderRole === "dispatcher" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                justifyContent: m.senderRole === "dispatcher" ? "flex-end" : "flex-start",
                marginBottom: 2,
              }}>
                <RoleIcon role={m.senderRole} color={SENDER_COLOR[m.senderRole]} />
                <span style={{ fontSize: 10.5, fontWeight: 600, color: SENDER_COLOR[m.senderRole] }}>
                  {SENDER_LABEL[m.senderRole]}
                </span>
              </div>
              <div style={{
                background: SENDER_BG[m.senderRole],
                color: "#1a1a1a", borderRadius: 10, padding: "7px 11px", fontSize: 13, lineHeight: 1.4, wordBreak: "break-word",
              }}>
                {m.body}
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding: "12px 20px 18px", display: "flex", gap: 8, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder="Reply to office / driver…"
            style={inputStyle(false)}
            onFocus={focusStyle}
            onBlur={(e) => blurStyle(e, false)}
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 500, borderRadius: 8, border: "none",
              color: "white", background: sending || !draft.trim() ? "#9ab6d6" : "#185FA5",
              cursor: sending || !draft.trim() ? "default" : "pointer", flexShrink: 0,
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Job Detail Row ───────────────────────────────────────────────────────────

function JobDetailRow({
  job,
  onCopyLink,
  linkCopied,
  onEditAssignment,
  onEditDue,
}: {
  job: Job;
  onCopyLink: () => void;
  linkCopied: boolean;
  /** Set on tablet, where the Driver and Priority columns are hidden. */
  onEditAssignment?: () => void;
  onEditDue: () => void;
}) {
  return (
    <div
      style={{
        padding: "12px 16px 14px 56px",
        background: "#FAFBFD",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
        display: "grid",
        gridTemplateColumns: onEditAssignment ? "1fr 1fr 1fr 1fr 1fr 1.4fr" : "1fr 1fr 1fr 1fr 1.4fr",
        gap: 16,
      }}
    >
      <div>
        <p style={{ margin: "0 0 3px", fontSize: 10.5, fontWeight: 500, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Expected Delivery
        </p>
        <p style={{ margin: 0, lineHeight: 1.4 }}>
          <EditableText onClick={onEditDue} title="Change expected delivery">
            {job.scheduledAt ? (
              <span style={{ fontSize: 12.5, color: isOverdue(job) ? "#A32D2D" : "#3a3a3a", fontWeight: isOverdue(job) ? 500 : 400 }}>
                {new Date(job.scheduledAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {isOverdue(job) && " · Late"}
              </span>
            ) : (
              <span style={{ fontSize: 12.5, color: "#185FA5" }}>Set time</span>
            )}
          </EditableText>
        </p>
      </div>
      {onEditAssignment && (
        <div>
          <p style={{ margin: "0 0 3px", fontSize: 10.5, fontWeight: 500, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Driver · Priority
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <DriverButton job={job} onClick={onEditAssignment} />
            <PriorityButton priority={job.priority} onClick={onEditAssignment} />
          </div>
        </div>
      )}
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
      {job.officeTrackingToken && (
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 10.5, fontWeight: 500, color: "#9a9a9a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Office Tracking Link
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{
              flex: 1, background: "#F0F4F8", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 6,
              padding: "4px 8px", fontSize: 11, color: "#5F5E5A", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "monospace",
            }}>
              {trackingUrl(job.officeTrackingToken)}
            </div>
            <button
              onClick={onCopyLink}
              title="Copy office tracking link"
              style={{
                background: linkCopied ? "#EBF5E9" : "#185FA5",
                color: linkCopied ? "#3B6D11" : "white",
                border: "none", borderRadius: 6, padding: "4px 10px",
                fontSize: 11, fontWeight: 500, cursor: "pointer", flexShrink: 0,
              }}
            >
              {linkCopied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Status History ───────────────────────────────────────────────────────────

type StatusEvent = {
  id: string;
  kind: "status";
  fromStatus: string | null;
  toStatus: string;
  changedByRole: "dispatcher" | "driver";
  changedByName: string | null;
  createdAt: string;
};

type EditEvent = {
  id: string;
  kind: "edit";
  field: "case_id" | "office" | "scheduled_at" | "driver" | "priority";
  oldValue: string | null;
  newValue: string | null;
  changedByRole: "dispatcher";
  changedByName: string | null;
  createdAt: string;
};

type HistoryEvent = StatusEvent | EditEvent;

const FIELD_LABEL: Record<EditEvent["field"], string> = {
  case_id: "Case number",
  office: "Office",
  scheduled_at: "Expected delivery",
  driver: "Driver",
  priority: "Priority",
};

function editValue(field: EditEvent["field"], v: string | null) {
  if (v === null) return field === "driver" ? "Unassigned" : "None";
  if (field === "scheduled_at") return new Date(v).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  if (field === "priority") return v === "stat" ? "STAT" : "Standard";
  return v;
}

function statusLabel(s: string) {
  return STATUS_CONFIG[s as JobStatus]?.label ?? (s === "rejected" ? "Rejected" : s);
}

// A driver can only move a job back to pending by rejecting it
// (PATCH /api/jobs/[id]/response).
function isRejection(e: StatusEvent) {
  return e.changedByRole === "driver" && e.toStatus === "pending";
}

// Per-job status history, opened from the History button on a job row or card.
function HistoryModal({ job, onClose }: { job: Job; onClose: () => void }) {
  const { apiFetch } = useAuth();
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiFetch<ApiResponse<HistoryEvent[]>>(`/api/jobs/${job.id}/history`)
      .then((res) => {
        if (res.data) { setEvents(res.data); setFailed(false); }
        else setFailed(true);
      })
      .catch(() => setFailed(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

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
          background: "#fff", borderRadius: 14, width: "100%", maxWidth: 440,
          margin: "0 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          overflow: "hidden", maxHeight: "80vh", display: "flex", flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.07)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
              Job History
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

        <div style={{ padding: "14px 20px 20px", overflowY: "auto" }}>
          {failed ? (
            <span style={{ fontSize: 12.5, color: "#A32D2D" }}>Couldn&apos;t load history.</span>
          ) : events === null ? (
            <span style={{ fontSize: 12.5, color: "#9a9a9a" }}>Loading…</span>
          ) : events.length === 0 ? (
            <span style={{ fontSize: 12.5, color: "#9a9a9a" }}>No changes recorded yet. Jobs created before history tracking started only show changes made since.</span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {events.map((e) => (
                <div key={e.id} style={{ fontSize: 12.5, color: "#3a3a3a", lineHeight: 1.4 }}>
                  <div style={{ fontSize: 11.5, color: "#9a9a9a", marginBottom: 1 }}>
                    {new Date(e.createdAt).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                  {e.kind === "status" && isRejection(e) ? (
                    <div>
                      <strong style={{ color: "#A32D2D" }}>Rejected</strong>
                      <span style={{ color: "#5F5E5A" }}> by {e.changedByName ?? "Unknown"} (Driver)</span>
                      {" "}· back to <strong>{statusLabel(e.toStatus)}</strong>, unassigned
                    </div>
                  ) : e.kind === "edit" ? (
                    <div>
                      {FIELD_LABEL[e.field]} changed: {editValue(e.field, e.oldValue)} → <strong>{editValue(e.field, e.newValue)}</strong>
                      <span style={{ color: "#5F5E5A" }}> by {e.changedByName ?? "Unknown"} (Dispatcher)</span>
                    </div>
                  ) : (
                    <div>
                      {e.fromStatus === null
                        ? <>Created as <strong>{statusLabel(e.toStatus)}</strong></>
                        : <>{statusLabel(e.fromStatus)} → <strong>{statusLabel(e.toStatus)}</strong></>}
                      <span style={{ color: "#5F5E5A" }}>
                        {" "}by {e.changedByName ?? "Unknown"} ({e.changedByRole === "driver" ? "Driver" : "Dispatcher"})
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Status pill that opens the Update Status modal. The ▾ and hover tint show it's clickable.
function StatusBubble({ status, onClick, padding = "2.5px 9px" }: { status: JobStatus; onClick: () => void; padding?: string }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title="Change status"
      style={{
        fontSize: 11.5, fontWeight: 500, background: cfg.bg, color: cfg.color,
        borderRadius: 20, padding, border: "1px solid transparent", cursor: "pointer",
        display: "inline-flex", alignItems: "center", gap: 4, transition: "border-color 0.1s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = cfg.color; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
    >
      {cfg.label}
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
        <path d="M1.5 3l2.5 2.5L6.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

const HistoryIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="6" cy="6" r="4.75" stroke="currentColor" strokeWidth="1.3" />
    <path d="M6 3.5V6l1.75 1.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
  onEditAssignment,
  onEditField,
  onOpenHistory,
  onOpenMessages,
  onCopyLink,
  linkCopied,
  unread,
}: {
  job: Job;
  bp: "tablet" | "desktop";
  isLast: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdateStatus: () => void;
  onEditAssignment: () => void;
  onEditField: (field: EditableField) => void;
  onOpenHistory: () => void;
  onOpenMessages: () => void;
  onCopyLink: () => void;
  linkCopied: boolean;
  unread: number;
}) {
  const cols = bp === "tablet"
    ? "32px 100px 1fr 120px 100px"
    : "32px 110px 1fr 130px 80px 120px 130px 90px 170px";

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
        <span style={{ fontSize: 12.5, fontWeight: 500, color: "#185FA5", fontFamily: "monospace", overflow: "hidden" }}>
          <EditableText onClick={() => onEditField("caseId")} title="Change case number">{job.caseId}</EditableText>
        </span>

        {/* Office */}
        <span style={{ fontSize: 13, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
          <EditableText onClick={() => onEditField("officeId")} title="Change office">{job.office}</EditableText>
        </span>

        {/* Driver — desktop only */}
        {bp === "desktop" && (
          <span style={{ overflow: "hidden", paddingRight: 8 }}>
            <DriverButton job={job} onClick={onEditAssignment} />
          </span>
        )}

        {/* Priority — desktop only */}
        {bp === "desktop" && (
          <span>
            <PriorityButton priority={job.priority} onClick={onEditAssignment} />
          </span>
        )}

        {/* Status */}
        <span>
          <StatusBubble status={job.status} onClick={onUpdateStatus} />
        </span>

        {/* Due — desktop only */}
        {bp === "desktop" && (
          <span style={{ overflow: "hidden" }}>
            <EditableText onClick={() => onEditField("scheduledAt")} title="Change expected delivery">
              <DueText job={job} />
            </EditableText>
          </span>
        )}

        {/* Updated — desktop only */}
        {bp === "desktop" && (
          <span style={{ fontSize: 12, color: "#9a9a9a" }}>{job.updatedAt}</span>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
          <ActionButton onClick={onOpenMessages} title={unread > 0 ? `Messages (${unread} unread)` : "Messages"}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 2.5h10v6H4.5L1 11V2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 11.5 }}>Messages</span>
            <UnreadBadge count={unread} style={{ position: "absolute", top: -7, right: -7 }} />
          </ActionButton>
          <ActionButton onClick={onOpenHistory} title="Status history">
            <HistoryIcon />
            <span style={{ fontSize: 11.5 }}>History</span>
          </ActionButton>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <JobDetailRow
          job={job}
          onCopyLink={onCopyLink}
          linkCopied={linkCopied}
          onEditAssignment={bp === "tablet" ? onEditAssignment : undefined}
          onEditDue={() => onEditField("scheduledAt")}
        />
      )}
    </>
  );
}

// ─── Mobile Job Card ──────────────────────────────────────────────────────────

function JobCard({
  job,
  onUpdateStatus,
  onEditAssignment,
  onEditField,
  onOpenHistory,
  onOpenMessages,
  onCopyLink,
  linkCopied,
  unread,
}: {
  job: Job;
  onUpdateStatus: () => void;
  onEditAssignment: () => void;
  onEditField: (field: EditableField) => void;
  onOpenHistory: () => void;
  onOpenMessages: () => void;
  onCopyLink: () => void;
  linkCopied: boolean;
  unread: number;
}) {
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
          <EditableText onClick={() => onEditField("caseId")} title="Change case number">{job.caseId}</EditableText>
        </span>
        <PriorityButton priority={job.priority} onClick={onEditAssignment} fontSize={10} />
      </div>

      {/* Office */}
      <div style={{ fontSize: 13.5, fontWeight: 500, color: "#1a1a1a", marginBottom: 2 }}>
        <EditableText onClick={() => onEditField("officeId")} title="Change office">{job.office}</EditableText>
      </div>

      {/* Driver */}
      <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 2 }}>
        Driver: <DriverButton job={job} onClick={onEditAssignment} fontSize={12} />
      </div>

      {/* Expected delivery */}
      <div style={{ fontSize: 12, color: "#5F5E5A", marginBottom: 10 }}>
        Due:{" "}
        <EditableText onClick={() => onEditField("scheduledAt")} title="Change expected delivery">
          <DueText job={job} />
        </EditableText>
      </div>

      {/* Bottom row: status + action + timestamp */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <StatusBubble status={job.status} onClick={onUpdateStatus} padding="3px 10px" />
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span style={{ fontSize: 11, color: "#9a9a9a" }}>{job.updatedAt}</span>
          {job.officeTrackingToken && (
            <ActionButton onClick={onCopyLink} title="Copy office tracking link">
              {linkCopied ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6.5l2.5 2.5L9.5 3.5" stroke="#3B6D11" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M5 7L7 5M4.5 8.5L3 10a2 2 0 01-2.83-2.83L1.5 5.83M7.5 3.5L9 2a2 2 0 012.83 2.83L10.5 6.17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span style={{ fontSize: 11.5, color: linkCopied ? "#3B6D11" : undefined }}>{linkCopied ? "Copied" : "Copy Link"}</span>
            </ActionButton>
          )}
          <ActionButton onClick={onOpenMessages} title={unread > 0 ? `Messages (${unread} unread)` : "Messages"}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 2.5h10v6H4.5L1 11V2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: 11.5 }}>Messages</span>
            <UnreadBadge count={unread} style={{ position: "absolute", top: -7, right: -7 }} />
          </ActionButton>
          <ActionButton onClick={onOpenHistory} title="Status history">
            <HistoryIcon />
            <span style={{ fontSize: 11.5 }}>History</span>
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ApiJobFull = {
  id: string; caseId: string; officeName: string; officeId: string; officeTrackingToken: string | null; driverName: string | null; driverId: string | null;
  priority: JobPriority; status: JobStatus; items: { description: string; flags: ItemFlag[] }[];
  deliveryAddress: string; createdAt: string; updatedAt: string; scheduledAt: string | null;
};

function mapJob(j: ApiJobFull): Job {
  return {
    id: j.id,
    caseId: j.caseId,
    office: j.officeName,
    officeId: j.officeId,
    officeTrackingToken: j.officeTrackingToken,
    deliveryAddress: j.deliveryAddress,
    driver: j.driverName,
    driverId: j.driverId,
    priority: j.priority,
    status: j.status,
    itemDescription: j.items?.[0]?.description ?? "",
    flags: j.items?.[0]?.flags ?? [],
    createdAt: new Date(j.createdAt).toLocaleString(),
    updatedAt: timeAgo(j.updatedAt),
    scheduledAt: j.scheduledAt,
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
  const [statusError, setStatusError] = useState<string | null>(null);
  const [historyJob, setHistoryJob]   = useState<Job | null>(null);
  const [assignJob, setAssignJob]     = useState<Job | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [editing, setEditing]         = useState<{ job: Job; field: EditableField } | null>(null);
  const [editError, setEditError]     = useState<string | null>(null);
  const [messagesJob, setMessagesJob] = useState<Job | null>(null);
  const [filter, setFilter]           = useState<FilterTab>("all");
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const {
    unreadByJob, pendingOpenJobId, clearPendingOpen,
    pendingHistoryJobId, clearPendingHistory, jobsChangedAt,
  } = useMessageNotifications();

  // A message toast was clicked — show that thread once the job list has it.
  const toastJob = pendingOpenJobId ? jobs.find((j) => j.id === pendingOpenJobId) ?? null : null;
  const openMessagesJob = toastJob ?? messagesJob;
  // Same for a rejection toast: show that job's history.
  const toastHistoryJob = pendingHistoryJobId ? jobs.find((j) => j.id === pendingHistoryJobId) ?? null : null;
  const openHistoryJob = toastHistoryJob ?? historyJob;
  const closeHistory = () => {
    setHistoryJob(null);
    clearPendingHistory();
  };
  const closeMessages = () => {
    setMessagesJob(null);
    clearPendingOpen();
  };

  const onCopyTrackingLink = async (job: Job) => {
    if (!job.officeTrackingToken) return;
    const ok = await copyToClipboard(trackingUrl(job.officeTrackingToken));
    if (ok) {
      setCopiedJobId(job.id);
      setTimeout(() => setCopiedJobId((id) => (id === job.id ? null : id)), 2000);
    }
  };

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

  // Live updates: reload the list whenever realtime reports a job change
  // (a driver accepting, rejecting or moving a job along).
  useEffect(() => {
    if (!session || !jobsChangedAt) return;
    const t = setTimeout(() => {
      apiFetch<ApiResponse<ApiJobFull[]>>("/api/jobs")
        .then((res) => { if (res.data) setJobs(res.data.map(mapJob)); })
        .catch(() => {});
    }, 300); // a burst of changes becomes one reload
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsChangedAt]);

  const onCreateJob = async (data: { caseId: string; officeId: string; driverId: string | null; deliveryAddress: string; priority: JobPriority; itemDescription: string; flags: ItemFlag[]; scheduledAt: string | null }) => {
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
        scheduledAt: data.scheduledAt,
      }),
    });
    if (res.data) setJobs((prev) => [mapJob(res.data!), ...prev]);
    setShowNewJob(false);
  };

  const onUpdateStatus = async (jobId: string, status: JobStatus) => {
    setStatusError(null);
    try {
      const res = await apiFetch<ApiResponse<ApiJobFull>>(`/api/jobs/${jobId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      if (!res.data) {
        setStatusError(res.error?.message ?? "Couldn't save the status. Please try again.");
        return;
      }
      setJobs((prev) => prev.map((j) => j.id === jobId ? mapJob(res.data!) : j));
      setStatusJob(null);
    } catch {
      setStatusError("Couldn't save the status. Check your connection and try again.");
    }
  };

  const openAssign = (job: Job) => {
    setAssignError(null);
    setAssignJob(job);
  };

  const onSaveAssignment = async (jobId: string, changes: { driverId: string | null; priority: JobPriority }) => {
    setAssignError(null);
    try {
      const res = await apiFetch<ApiResponse<ApiJobFull>>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      if (!res.data) {
        setAssignError(res.error?.message ?? "Couldn't save. Please try again.");
        return;
      }
      setJobs((prev) => prev.map((j) => j.id === jobId ? mapJob(res.data!) : j));
      setAssignJob(null);
    } catch {
      setAssignError("Couldn't save. Check your connection and try again.");
    }
  };

  const openEdit = (job: Job, field: EditableField) => {
    setEditError(null);
    setEditing({ job, field });
  };

  const onSaveEdit = async (jobId: string, changes: Partial<Record<EditableField, string>>) => {
    setEditError(null);
    try {
      const res = await apiFetch<ApiResponse<ApiJobFull>>(`/api/jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      if (!res.data) {
        setEditError(res.error?.message ?? "Couldn't save. Please try again.");
        return;
      }
      setJobs((prev) => prev.map((j) => j.id === jobId ? mapJob(res.data!) : j));
      setEditing(null);
    } catch {
      setEditError("Couldn't save. Check your connection and try again.");
    }
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
                  : "32px 110px 1fr 130px 80px 120px 130px 90px 170px",
                padding: "6px 16px",
                background: "#FAFAFA", borderBottom: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              {(bp === "tablet"
                ? ["", "Case ID", "Office", "Status", ""]
                : ["", "Case ID", "Office", "Driver", "Priority", "Status", "Due", "Updated", ""]
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
                  onEditAssignment={() => openAssign(job)}
                  onEditField={(field) => openEdit(job, field)}
                  onOpenHistory={() => setHistoryJob(job)}
                  onOpenMessages={() => { clearPendingOpen(); setMessagesJob(job); }}
                  onCopyLink={() => onCopyTrackingLink(job)}
                  linkCopied={copiedJobId === job.id}
                  unread={unreadByJob[job.id] ?? 0}
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
                onEditAssignment={() => openAssign(job)}
                onEditField={(field) => openEdit(job, field)}
                onOpenHistory={() => setHistoryJob(job)}
                onOpenMessages={() => { clearPendingOpen(); setMessagesJob(job); }}
                onCopyLink={() => onCopyTrackingLink(job)}
                linkCopied={copiedJobId === job.id}
                unread={unreadByJob[job.id] ?? 0}
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
          onClose={() => { setStatusJob(null); setStatusError(null); }}
          onSave={(status) => onUpdateStatus(statusJob.id, status)}
          error={statusError}
        />
      )}
      {editing && (
        <EditFieldModal
          job={editing.job}
          field={editing.field}
          offices={offices}
          onClose={() => setEditing(null)}
          onSave={(changes) => onSaveEdit(editing.job.id, changes)}
          error={editError}
        />
      )}
      {assignJob && (
        <AssignModal
          job={assignJob}
          drivers={drivers}
          onClose={() => setAssignJob(null)}
          onSave={(changes) => onSaveAssignment(assignJob.id, changes)}
          error={assignError}
        />
      )}
      {openHistoryJob && (
        <HistoryModal job={openHistoryJob} onClose={closeHistory} />
      )}
      {openMessagesJob && (
        <MessagesModal job={openMessagesJob} onClose={closeMessages} />
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
        fontSize: 11.5, transition: "all 0.1s", position: "relative",
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
