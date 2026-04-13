"use client";

import { useState } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";

// ─── Types ────────────────────────────────────────────────────────────────────

type DriverStatus = "available" | "on_delivery" | "off_duty";

interface Driver {
  id: string;
  name: string;
  phone: string;
  status: DriverStatus;
  activeJobs: number;
  location: string;
  joinedDate: string;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_DRIVERS: Driver[] = [
  { id: "1", name: "Marco Rivera",  phone: "(415) 555-0182", status: "on_delivery", activeJobs: 3, location: "Mission District", joinedDate: "Jan 2025" },
  { id: "2", name: "Jordan Singh",  phone: "(415) 555-0247", status: "on_delivery", activeJobs: 2, location: "SoMa",             joinedDate: "Feb 2025" },
  { id: "3", name: "Aisha Lambert", phone: "(415) 555-0391", status: "on_delivery", activeJobs: 1, location: "Civic Center",     joinedDate: "Feb 2025" },
  { id: "4", name: "Tim Kowalski",  phone: "(415) 555-0468", status: "on_delivery", activeJobs: 2, location: "Castro",           joinedDate: "Mar 2025" },
  { id: "5", name: "Chris Morgan",  phone: "(415) 555-0553", status: "available",   activeJobs: 0, location: "Depot",            joinedDate: "Mar 2025" },
  { id: "6", name: "Dana Reyes",    phone: "(415) 555-0614", status: "off_duty",    activeJobs: 0, location: "—",                joinedDate: "Apr 2025" },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DriverStatus, { label: string; color: string; bg: string }> = {
  available:    { label: "Available",    color: "#3B6D11", bg: "rgba(59,109,17,0.10)"  },
  on_delivery:  { label: "On Delivery",  color: "#185FA5", bg: "rgba(24,95,165,0.10)"  },
  off_duty:     { label: "Off Duty",     color: "#5F5E5A", bg: "rgba(95,94,90,0.10)"   },
};

const AVATAR_COLORS = ["#185FA5", "#3B6D11", "#854F0B", "#185FA5", "#3B6D11", "#854F0B"];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatPhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

// ─── Add / Edit modal ─────────────────────────────────────────────────────────

interface ModalProps {
  driver: Partial<Driver> | null;
  onClose: () => void;
  onSave: (driver: Omit<Driver, "id" | "activeJobs" | "location" | "joinedDate">) => void;
}

function DriverModal({ driver, onClose, onSave }: ModalProps) {
  const isEdit = !!driver?.id;
  const [name, setName]     = useState(driver?.name  ?? "");
  const [phone, setPhone]   = useState(driver?.phone ?? "");
  const [status, setStatus] = useState<DriverStatus>(driver?.status ?? "available");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!name.trim())  e.name  = "Name is required.";
    if (!phone.trim()) e.phone = "Phone number is required.";
    return e;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setErrors(e2); return; }
    onSave({ name: name.trim(), phone: formatPhone(phone.trim()), status });
  };

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdrop}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 420,
          margin: "0 16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {/* Modal header */}
        <div
          style={{
            padding: "18px 20px 14px",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
              {isEdit ? "Edit Driver" : "Add New Driver"}
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5F5E5A" }}>
              {isEdit ? "Update driver details below." : "Driver will appear in the roster immediately."}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#9a9a9a", padding: 4, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Full name */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a", display: "block", marginBottom: 5 }}>
              Full Name <span style={{ color: "#A32D2D" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((prev) => ({ ...prev, name: undefined })); }}
              placeholder="e.g. Alex Johnson"
              style={{
                width: "100%", padding: "8px 11px", fontSize: 13.5,
                border: `1px solid ${errors.name ? "#A32D2D" : "rgba(0,0,0,0.14)"}`,
                borderRadius: 8, outline: "none", color: "#1a1a1a",
                background: errors.name ? "rgba(163,45,45,0.04)" : "#fff",
                boxSizing: "border-box",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#185FA5"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(24,95,165,0.10)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = errors.name ? "#A32D2D" : "rgba(0,0,0,0.14)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            {errors.name && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#A32D2D" }}>{errors.name}</p>}
          </div>

          {/* Phone */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a", display: "block", marginBottom: 5 }}>
              Phone Number <span style={{ color: "#A32D2D" }}>*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setErrors((prev) => ({ ...prev, phone: undefined })); }}
              placeholder="(415) 555-0100"
              style={{
                width: "100%", padding: "8px 11px", fontSize: 13.5,
                border: `1px solid ${errors.phone ? "#A32D2D" : "rgba(0,0,0,0.14)"}`,
                borderRadius: 8, outline: "none", color: "#1a1a1a",
                background: errors.phone ? "rgba(163,45,45,0.04)" : "#fff",
                boxSizing: "border-box",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#185FA5"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(24,95,165,0.10)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = errors.phone ? "#A32D2D" : "rgba(0,0,0,0.14)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            {errors.phone && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#A32D2D" }}>{errors.phone}</p>}
          </div>

          {/* Status */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a", display: "block", marginBottom: 5 }}>
              Initial Status
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["available", "off_duty"] as DriverStatus[]).map((s) => {
                const cfg = STATUS_CONFIG[s];
                const selected = status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    style={{
                      flex: 1, padding: "7px 12px", borderRadius: 8, cursor: "pointer",
                      fontSize: 12.5, fontWeight: 500,
                      border: `1.5px solid ${selected ? cfg.color : "rgba(0,0,0,0.12)"}`,
                      background: selected ? cfg.bg : "transparent",
                      color: selected ? cfg.color : "#5F5E5A",
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
              {isEdit ? "Save Changes" : "Add Driver"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Deactivate confirm ───────────────────────────────────────────────────────

function DeactivateConfirm({ driver, onClose, onConfirm }: { driver: Driver; onClose: () => void; onConfirm: () => void }) {
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
          margin: "0 16px", padding: 22,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
        }}
      >
        <h2 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>
          Deactivate {driver.name}?
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#5F5E5A", lineHeight: 1.5 }}>
          They will be set to <strong>Off Duty</strong> and won&apos;t appear in job assignment until reactivated.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
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
            onClick={onConfirm}
            style={{
              flex: 2, padding: "9px", fontSize: 13.5, fontWeight: 600,
              border: "none", borderRadius: 8,
              background: "#A32D2D", color: "white", cursor: "pointer",
            }}
          >
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DriversPage() {
  const bp = useBreakpoint();
  const [drivers, setDrivers]         = useState<Driver[]>(SEED_DRIVERS);
  const [modalDriver, setModalDriver] = useState<Partial<Driver> | null | "new">(null);
  const [deactivating, setDeactivating] = useState<Driver | null>(null);
  const [filter, setFilter]           = useState<DriverStatus | "all">("all");

  const onSave = (data: Omit<Driver, "id" | "activeJobs" | "location" | "joinedDate">) => {
    if (modalDriver === "new") {
      const newDriver: Driver = {
        ...data,
        id: String(Date.now()),
        activeJobs: 0,
        location: data.status === "available" ? "Depot" : "—",
        joinedDate: new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      };
      setDrivers((prev) => [newDriver, ...prev]);
    } else if (modalDriver && "id" in modalDriver && modalDriver.id) {
      setDrivers((prev) =>
        prev.map((d) => d.id === modalDriver.id ? { ...d, ...data } : d)
      );
    }
    setModalDriver(null);
  };

  const onDeactivate = (driver: Driver) => {
    setDrivers((prev) =>
      prev.map((d) => d.id === driver.id ? { ...d, status: "off_duty", activeJobs: 0 } : d)
    );
    setDeactivating(null);
  };

  const onReactivate = (driver: Driver) => {
    setDrivers((prev) =>
      prev.map((d) => d.id === driver.id ? { ...d, status: "available" } : d)
    );
  };

  const filtered = filter === "all" ? drivers : drivers.filter((d) => d.status === filter);

  const counts = {
    all:         drivers.length,
    on_delivery: drivers.filter((d) => d.status === "on_delivery").length,
    available:   drivers.filter((d) => d.status === "available").length,
    off_duty:    drivers.filter((d) => d.status === "off_duty").length,
  };

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
            Drivers
          </h1>
          <p style={{ fontSize: 11.5, color: "#5F5E5A", margin: 0, fontWeight: 400 }}>
            {counts.on_delivery} on delivery · {counts.available} available · {counts.off_duty} off duty
          </p>
        </div>
        <button
          onClick={() => setModalDriver("new")}
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
          Add Driver
        </button>
      </header>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: bp === "mobile" ? "12px" : "20px 24px" }}>

        {/* Stats row */}
        <div className="stats-grid">
          <StatCard label="Total Drivers"  value={counts.all}         />
          <StatCard label="On Delivery"    value={counts.on_delivery} color="#185FA5" />
          <StatCard label="Available"      value={counts.available}   color="#3B6D11" />
          <StatCard label="Off Duty"       value={counts.off_duty}    color="#5F5E5A" />
        </div>

        {/* Driver table */}
        <div
          style={{
            background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 12, overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
          }}
        >
          {/* Table toolbar */}
          <div
            style={{
              padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a" }}>All Drivers</span>
              <span
                style={{
                  background: "#185FA5", color: "white",
                  fontSize: 10, fontWeight: 500, borderRadius: 20, padding: "1px 7px",
                }}
              >
                {counts.all}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["all", "on_delivery", "available", "off_duty"] as const).map((f) => {
                const labels = { all: "All", on_delivery: "On Delivery", available: "Available", off_duty: "Off Duty" };
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
                    {labels[f]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column headers — hidden on mobile */}
          {bp !== "mobile" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: bp === "tablet"
                  ? "2fr 120px 100px 100px"
                  : "2fr 140px 120px 100px 110px 120px",
                padding: "6px 16px",
                background: "#FAFAFA", borderBottom: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              {(bp === "tablet"
                ? ["Driver", "Status", "Jobs", ""]
                : ["Driver", "Phone", "Status", "Jobs", "Location", ""]
              ).map((col) => (
                <span key={col} style={{ fontSize: 11, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {col}
                </span>
              ))}
            </div>
          )}

          {/* Rows */}
          {filtered.length === 0 ? (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "#9a9a9a", fontSize: 13 }}>
              No drivers with this status.
            </div>
          ) : bp === "mobile" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {filtered.map((driver, i) => (
                <DriverCard
                  key={driver.id}
                  driver={driver}
                  index={i}
                  onEdit={() => setModalDriver(driver)}
                  onDeactivate={() => setDeactivating(driver)}
                  onReactivate={() => onReactivate(driver)}
                />
              ))}
            </div>
          ) : (
            filtered.map((driver, i) => (
              <DriverRow
                key={driver.id}
                driver={driver}
                bp={bp}
                index={i}
                isLast={i === filtered.length - 1}
                onEdit={() => setModalDriver(driver)}
                onDeactivate={() => setDeactivating(driver)}
                onReactivate={() => onReactivate(driver)}
              />
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      {modalDriver !== null && (
        <DriverModal
          driver={modalDriver === "new" ? null : modalDriver}
          onClose={() => setModalDriver(null)}
          onSave={onSave}
        />
      )}
      {deactivating && (
        <DeactivateConfirm
          driver={deactivating}
          onClose={() => setDeactivating(null)}
          onConfirm={() => onDeactivate(deactivating)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color = "#1a1a1a" }: { label: string; value: number; color?: string }) {
  return (
    <div
      style={{
        background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12, padding: "14px 16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
      }}
    >
      <div style={{ fontSize: 26, fontWeight: 600, color, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: "#5F5E5A", fontWeight: 400, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function DriverRow({
  driver, bp, index, isLast, onEdit, onDeactivate, onReactivate,
}: {
  driver: Driver;
  bp: "tablet" | "desktop";
  index: number;
  isLast: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const s = STATUS_CONFIG[driver.status];
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const isOffDuty = driver.status === "off_duty";
  const cols = bp === "tablet"
    ? "2fr 120px 100px 100px"
    : "2fr 140px 120px 100px 110px 120px";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        padding: "10px 16px",
        borderBottom: isLast ? "none" : "1px solid rgba(0,0,0,0.05)",
        alignItems: "center",
        opacity: isOffDuty ? 0.6 : 1,
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {/* Name + avatar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: "white", flexShrink: 0 }}>
          {initials(driver.name)}
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "#1a1a1a" }}>{driver.name}</div>
          <div style={{ fontSize: 11, color: "#9a9a9a" }}>Since {driver.joinedDate}</div>
        </div>
      </div>

      {/* Phone — desktop only */}
      {bp === "desktop" && (
        <span style={{ fontSize: 13, color: "#3a3a3a" }}>{driver.phone}</span>
      )}

      {/* Status */}
      <span>
        <span style={{ fontSize: 11.5, fontWeight: 500, background: s.bg, color: s.color, borderRadius: 20, padding: "2.5px 9px" }}>
          {s.label}
        </span>
      </span>

      {/* Active jobs */}
      <span style={{ fontSize: 13, color: driver.activeJobs > 0 ? "#185FA5" : "#9a9a9a", fontWeight: driver.activeJobs > 0 ? 500 : 400 }}>
        {driver.activeJobs > 0 ? `${driver.activeJobs} active` : "—"}
      </span>

      {/* Location — desktop only */}
      {bp === "desktop" && (
        <span style={{ fontSize: 12.5, color: "#5F5E5A" }}>{driver.location}</span>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <ActionButton onClick={onEdit} title="Edit">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M9 2l2 2-7 7H2v-2L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </ActionButton>
        {isOffDuty ? (
          <ActionButton onClick={onReactivate} title="Reactivate" accent>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2.5 6.5a4 4 0 107 -2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M7.5 2.5l2 1.2-2 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ActionButton>
        ) : (
          <ActionButton onClick={onDeactivate} title="Deactivate" danger>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M4.5 4.5l4 4M8.5 4.5l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </ActionButton>
        )}
      </div>
    </div>
  );
}

// ─── Mobile Driver Card ───────────────────────────────────────────────────────

function DriverCard({
  driver, index, onEdit, onDeactivate, onReactivate,
}: {
  driver: Driver;
  index: number;
  onEdit: () => void;
  onDeactivate: () => void;
  onReactivate: () => void;
}) {
  const s = STATUS_CONFIG[driver.status];
  const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const isOffDuty = driver.status === "off_duty";

  return (
    <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#fff", opacity: isOffDuty ? 0.65 : 1 }}>
      {/* Top row: avatar + name + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "white", flexShrink: 0 }}>
          {initials(driver.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#1a1a1a" }}>{driver.name}</div>
          <div style={{ fontSize: 12, color: "#9a9a9a" }}>{driver.phone}</div>
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 500, background: s.bg, color: s.color, borderRadius: 20, padding: "3px 10px", flexShrink: 0 }}>
          {s.label}
        </span>
      </div>

      {/* Bottom row: location/jobs + actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: "#5F5E5A" }}>
          {driver.activeJobs > 0 ? `${driver.activeJobs} active · ` : ""}{driver.location}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <ActionButton onClick={onEdit} title="Edit">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M9 2l2 2-7 7H2v-2L9 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ActionButton>
          {isOffDuty ? (
            <ActionButton onClick={onReactivate} title="Reactivate" accent>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M2.5 6.5a4 4 0 107 -2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M7.5 2.5l2 1.2-2 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </ActionButton>
          ) : (
            <ActionButton onClick={onDeactivate} title="Deactivate" danger>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M4.5 4.5l4 4M8.5 4.5l-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  children, onClick, title, danger, accent,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: "none", border: "1px solid rgba(0,0,0,0.10)",
        borderRadius: 6, padding: "4px 7px", cursor: "pointer",
        color: danger ? "#A32D2D" : accent ? "#3B6D11" : "#5F5E5A",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.1s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = danger ? "rgba(163,45,45,0.07)" : accent ? "rgba(59,109,17,0.08)" : "rgba(0,0,0,0.05)";
        el.style.borderColor = danger ? "#A32D2D" : accent ? "#3B6D11" : "rgba(0,0,0,0.18)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = "none";
        el.style.borderColor = "rgba(0,0,0,0.10)";
      }}
    >
      {children}
    </button>
  );
}
