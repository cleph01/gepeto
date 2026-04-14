"use client";

import { useEffect, useState } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useAuth } from "@/context/auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Office {
  id: string;
  name: string;
  address: string;
  phone: string;
  contactName: string;
  trackingToken: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TRACKING_BASE =
  process.env.NEXT_PUBLIC_TRACKING_BASE_URL ?? "http://localhost:3001/t";

function trackingUrl(token: string) {
  return `${TRACKING_BASE}/${token}`;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OfficesPage() {
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const { apiFetch, session } = useAuth();

  const [offices, setOffices]       = useState<Office[]>([]);
  const [showModal, setShowModal]   = useState(false);
  const [editOffice, setEditOffice] = useState<Office | null>(null);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ data: Office[] | null; error: null }>("/api/offices").then((res) => {
      if (res.data) setOffices(res.data);
    });
  }, [session]);

  async function onSave(draft: Omit<Office, "id" | "trackingToken">, id?: string) {
    if (id) {
      const res = await apiFetch<{ data: Office | null; error: null }>(`/api/offices/${id}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      if (res.data) setOffices((prev) => prev.map((o) => o.id === id ? { ...o, ...res.data! } : o));
    } else {
      const res = await apiFetch<{ data: Office | null; error: null }>("/api/offices", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      if (res.data) setOffices((prev) => [...prev, res.data!]);
    }
    setShowModal(false);
    setEditOffice(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#F8F9FB" }}>

      {/* Header */}
      <header style={{
        padding: isMobile ? "0 16px" : "0 28px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#FFFFFF",
        borderBottom: "1px solid rgba(0,0,0,0.08)",
        flexShrink: 0,
      }}>
        <div>
          <h1 style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: 0, letterSpacing: "-0.01em" }}>
            Offices
          </h1>
          <p style={{ fontSize: 11.5, color: "#5F5E5A", margin: 0 }}>
            {offices.length} dental office{offices.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { setEditOffice(null); setShowModal(true); }}
          style={{
            background: "#185FA5", color: "white", border: "none",
            borderRadius: 7, padding: "6px 14px", fontSize: 13,
            fontWeight: 500, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add Office
        </button>
      </header>

      {/* Content */}
      <div style={{ padding: isMobile ? 12 : "20px 28px", flex: 1 }}>
        {offices.length === 0 ? (
          <EmptyState onAdd={() => setShowModal(true)} />
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : bp === "tablet" ? "1fr 1fr" : "1fr 1fr 1fr",
            gap: 16,
          }}>
            {offices.map((office) => (
              <OfficeCard
                key={office.id}
                office={office}
                onEdit={() => { setEditOffice(office); setShowModal(true); }}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <OfficeModal
          office={editOffice}
          onClose={() => { setShowModal(false); setEditOffice(null); }}
          onSave={onSave}
        />
      )}
    </div>
  );
}

// ── Office card ───────────────────────────────────────────────────────────────

function OfficeCard({ office, onEdit }: { office: Office; onEdit: () => void }) {
  const [copied, setCopied] = useState(false);
  const url = trackingUrl(office.trackingToken);

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 12,
      boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Card body */}
      <div style={{ padding: "16px 16px 12px", flex: 1 }}>
        {/* Name + edit */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.3 }}>
            {office.name}
          </div>
          <button
            onClick={onEdit}
            title="Edit office"
            style={{
              background: "none", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6,
              padding: "3px 8px", fontSize: 12, color: "#5F5E5A",
              cursor: "pointer", flexShrink: 0,
            }}
          >
            Edit
          </button>
        </div>

        {/* Meta rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <MetaRow icon="person" text={office.contactName} />
          <MetaRow icon="phone" text={office.phone} />
          <MetaRow icon="location" text={office.address} />
        </div>
      </div>

      {/* Tracking link section */}
      <div style={{
        padding: "10px 16px",
        borderTop: "1px solid rgba(0,0,0,0.06)",
        background: "#FAFAFA",
      }}>
        <div style={{ fontSize: 10.5, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>
          Tracking Link
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{
            flex: 1,
            background: "#F0F4F8",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 6,
            padding: "5px 9px",
            fontSize: 11.5,
            color: "#5F5E5A",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "monospace",
          }}>
            {url}
          </div>
          <button
            onClick={copyLink}
            title="Copy link"
            style={{
              background: copied ? "#EBF5E9" : "#185FA5",
              color: copied ? "#3B6D11" : "white",
              border: "none",
              borderRadius: 6,
              padding: "5px 10px",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              flexShrink: 0,
              transition: "background 0.15s, color 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Meta row ──────────────────────────────────────────────────────────────────

function MetaRow({ icon, text }: { icon: "person" | "phone" | "location"; text: string }) {
  const icons = {
    person: (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.3" />
        <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    phone: (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <path d="M3 2.5A1.5 1.5 0 014.5 1h1.879a.5.5 0 01.49.392l.74 3.7a.5.5 0 01-.284.545L5.5 6.5a10.01 10.01 0 004 4l.863-1.825a.5.5 0 01.545-.284l3.7.74a.5.5 0 01.392.49V11.5A1.5 1.5 0 0113.5 13C7.149 13 2 7.851 2 1.5 2 1.224 2.224 1 2.5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
    location: (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.5 4.5 8.5 4.5 8.5s4.5-5 4.5-8.5c0-2.485-2.015-4.5-4.5-4.5z" stroke="currentColor" strokeWidth="1.3" />
        <circle cx="8" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  };

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
      <span style={{ color: "#9a9a9a", marginTop: 1.5, flexShrink: 0 }}>{icons[icon]}</span>
      <span style={{ fontSize: 12.5, color: "#5F5E5A", lineHeight: 1.4 }}>{text}</span>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      maxWidth: 400,
      margin: "60px auto",
      textAlign: "center",
      background: "#FFFFFF",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 12,
      padding: "40px 32px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: "#EBF2FA",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 16px",
      }}>
        <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="5.5" width="13" height="9" rx="1.5" stroke="#185FA5" strokeWidth="1.25" />
          <path d="M5 5.5V4a3 3 0 016 0v1.5" stroke="#185FA5" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>No offices yet</div>
      <div style={{ fontSize: 13, color: "#5F5E5A", marginBottom: 20, lineHeight: 1.5 }}>
        Add your dental office clients to generate tracking links for them.
      </div>
      <button
        onClick={onAdd}
        style={{
          background: "#185FA5", color: "white", border: "none",
          borderRadius: 7, padding: "8px 20px", fontSize: 13,
          fontWeight: 500, cursor: "pointer",
        }}
      >
        Add your first office
      </button>
    </div>
  );
}

// ── Office modal ──────────────────────────────────────────────────────────────

function OfficeModal({
  office,
  onClose,
  onSave,
}: {
  office: Office | null;
  onClose: () => void;
  onSave: (draft: Omit<Office, "id" | "trackingToken">, id?: string) => Promise<void>;
}) {
  const [name, setName]               = useState(office?.name        ?? "");
  const [address, setAddress]         = useState(office?.address     ?? "");
  const [phone, setPhone]             = useState(office?.phone       ?? "");
  const [contactName, setContactName] = useState(office?.contactName ?? "");
  const [saving, setSaving]           = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ name, address, phone, contactName }, office?.id);
    setSaving(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
          zIndex: 100, backdropFilter: "blur(2px)",
        }}
      />
      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 101,
        background: "#FFFFFF",
        borderRadius: 12,
        boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        width: "min(480px, calc(100vw - 32px))",
        overflow: "hidden",
      }}>
        {/* Modal header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.07)",
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a1a" }}>
            {office ? "Edit Office" : "Add Office"}
          </span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9a9a9a", padding: 4, borderRadius: 5 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <ModalField label="Office Name"    value={name}        onChange={setName}        placeholder="SF Smile Center" required />
          <ModalField label="Contact Name"   value={contactName} onChange={setContactName} placeholder="Dr. Jane Smith"   required />
          <ModalField label="Phone"          value={phone}       onChange={setPhone}        placeholder="(415) 555-0100"  required type="tel" />
          <ModalField label="Address"        value={address}     onChange={setAddress}      placeholder="123 Market St, San Francisco, CA 94103" required />

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent", border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 7, padding: "7px 16px", fontSize: 13, color: "#5F5E5A", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: "#185FA5", color: "white", border: "none",
                borderRadius: 7, padding: "7px 20px", fontSize: 13,
                fontWeight: 500, cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving…" : office ? "Save Changes" : "Add Office"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function ModalField({
  label, value, onChange, placeholder, required, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; type?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a" }}>
        {label}{required && <span style={{ color: "#C53B0A", marginLeft: 2 }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          border: "1px solid rgba(0,0,0,0.12)", borderRadius: 7,
          padding: "7px 10px", fontSize: 13, color: "#1a1a1a",
          background: "#FFFFFF", outline: "none", width: "100%",
          boxSizing: "border-box", fontFamily: "inherit",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#185FA5"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(24,95,165,0.10)"; }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)"; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}
