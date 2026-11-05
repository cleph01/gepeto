"use client";

import { useEffect, useState } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useAuth } from "@/context/auth";
import { copyToClipboard, trackingUrl } from "@/lib/client-utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Office {
  id: string;
  name: string;
  address: string;
  phone: string;
  contactName: string;
  email: string | null;
  trackingToken: string;
  accessCode: string | null;
}

type OfficeDraft = Pick<Office, "name" | "address" | "phone" | "contactName"> & { email: string };

// ── Main page ─────────────────────────────────────────────────────────────────

export default function OfficesPage() {
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const { apiFetch, session } = useAuth();

  const [offices, setOffices]       = useState<Office[]>([]);
  // Until the first load lands, show placeholder cards, not the "No offices yet" screen.
  const [loaded, setLoaded]         = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [editOffice, setEditOffice] = useState<Office | null>(null);
  // Just-created office: show its link and code so the handoff isn't missed.
  const [added, setAdded]           = useState<Office | null>(null);

  useEffect(() => {
    if (!session) return;
    apiFetch<{ data: Office[] | null; error: null }>("/api/offices").then((res) => {
      if (res.data) setOffices(res.data);
    }).catch(() => {}).finally(() => setLoaded(true));
  }, [session]);

  const replaceOffice = (updated: Office) =>
    setOffices((prev) => prev.map((o) => o.id === updated.id ? updated : o));

  async function onSave(draft: OfficeDraft, id?: string) {
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
      if (res.data) {
        setOffices((prev) => [...prev, res.data!]);
        setAdded(res.data);
      }
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
            {loaded ? `${offices.length} dental office${offices.length !== 1 ? "s" : ""}` : "Loading offices…"}
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
        {loaded && offices.length === 0 ? (
          <EmptyState onAdd={() => setShowModal(true)} />
        ) : (
          <div style={{
            display: "grid",
            // minmax(0, ...): a plain 1fr column won't shrink below its content, so the
            // one-line tracking link stretched the grid and pushed cards off the page.
            gridTemplateColumns: `repeat(${isMobile ? 1 : bp === "tablet" ? 2 : 3}, minmax(0, 1fr))`,
            gap: 16,
          }}>
            {!loaded && [0, 1, 2].map((i) => <OfficeCardSkeleton key={i} />)}
            {offices.map((office) => (
              <div key={office.id} id={`search-office-${office.id}`} style={{ borderRadius: 12 }}>
                <OfficeCard
                  office={office}
                  onEdit={() => { setEditOffice(office); setShowModal(true); }}
                  onChanged={replaceOffice}
                />
              </div>
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

      {added && <OfficeAddedModal office={added} onClose={() => setAdded(null)} />}
    </div>
  );
}

// ── Office card ───────────────────────────────────────────────────────────────

// Same outline as OfficeCard, so nothing shifts when the real cards arrive.
function OfficeCardSkeleton() {
  return (
    <div
      aria-hidden
      style={{
        background: "#FFFFFF",
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 12,
        boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 16px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="skeleton" style={{ height: 14, width: "60%", marginBottom: 4 }} />
        <div className="skeleton" style={{ height: 10, width: "45%" }} />
        <div className="skeleton" style={{ height: 10, width: "35%" }} />
        <div className="skeleton" style={{ height: 10, width: "75%" }} />
      </div>
      <div style={{ padding: "10px 16px 14px", borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="skeleton" style={{ height: 8, width: "30%" }} />
        <div className="skeleton" style={{ height: 28, width: "100%", borderRadius: 7 }} />
      </div>
    </div>
  );
}

function OfficeCard({ office, onEdit, onChanged }: { office: Office; onEdit: () => void; onChanged: (o: Office) => void }) {
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState<"code" | "link" | null>(null);
  const url = trackingUrl(office.trackingToken);

  function copyLink() {
    copyToClipboard(url).then((ok) => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
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
          {office.email && <MetaRow icon="email" text={office.email} />}
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
        <EmailButton kind="link" office={office} style={{ marginTop: 7 }} />
        <p style={{ fontSize: 11.5, color: "#5F5E5A", lineHeight: 1.4, margin: "6px 0 0" }}>
          {office.email ? SEPARATE_EMAILS_NOTE : "Add an email address to this office to send the link and code from here."}
        </p>
        <button onClick={() => setResetting("link")} style={resetButton}>Reset link</button>
      </div>

      <AccessCodeSection office={office} onReset={() => setResetting("code")} />

      {resetting && (
        <ResetModal
          kind={resetting}
          office={office}
          onChanged={onChanged}
          onClose={() => setResetting(null)}
        />
      )}
    </div>
  );
}

const resetButton: React.CSSProperties = {
  display: "block", marginTop: 8, padding: 0, background: "none", border: "none",
  fontSize: 11.5, color: "#5F5E5A", textDecoration: "underline", cursor: "pointer",
};

// ── Access code ───────────────────────────────────────────────────────────────

const SEPARATE_EMAILS_NOTE = "The link and code go in separate emails, so forwarding one can't open the full view.";

function EmailButton({ kind, office, style }: { kind: "code" | "link"; office: Office; style?: React.CSSProperties }) {
  const { apiFetch } = useAuth();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setState("sending");
    setError(null);
    try {
      // apiFetch resolves on error responses too; the failure is in the body.
      const res = await apiFetch<{ data: unknown; error: { message: string } | null }>(`/api/offices/${office.id}/email-${kind}`, { method: "POST" });
      if (res.error) {
        setError(res.error.message);
        setState("idle");
      } else {
        setState("sent");
      }
    } catch {
      setError("The email didn't send. Check your connection and try again.");
      setState("idle");
    }
  }

  return (
    <div style={{ flex: 1, ...style }}>
      <button
        onClick={send}
        disabled={!office.email || state !== "idle"}
        title={office.email ? `Send the ${kind} to ${office.email}` : "Add an email address to this office first"}
        style={{
          width: "100%", background: "#FFFFFF", border: "1px solid #C0D9F0", borderRadius: 6, padding: "6px 10px",
          fontSize: 12, fontWeight: 500, color: office.email ? "#185FA5" : "#9a9a9a",
          cursor: office.email && state === "idle" ? "pointer" : "default",
        }}
      >
        {state === "sent" ? "Emailed ✓" : state === "sending" ? "Sending…" : `Email ${kind} to office`}
      </button>
      {error && <div role="alert" style={{ fontSize: 11.5, color: "#C53B0A", marginTop: 5, lineHeight: 1.4 }}>{error}</div>}
    </div>
  );
}

function AccessCodeSection({ office, onReset }: { office: Office; onReset: () => void }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    if (!office.accessCode) return;
    copyToClipboard(office.accessCode).then((ok) => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    });
  }

  return (
    <div style={{ padding: "10px 16px 12px", borderTop: "1px solid rgba(0,0,0,0.06)", background: "#FAFAFA" }}>
      <div style={{ fontSize: 10.5, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 7 }}>
        Access Code
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <div style={{
          flex: 1, background: "#F0F4F8", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 6,
          padding: "5px 9px", fontSize: 13, fontWeight: 600, letterSpacing: "0.06em", color: "#1a1a1a", fontFamily: "monospace",
        }}>
          {office.accessCode ?? "—"}
        </div>
        <button
          onClick={copyCode}
          title="Copy code"
          style={{
            background: copied ? "#EBF5E9" : "#185FA5", color: copied ? "#3B6D11" : "white", border: "none",
            borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <EmailButton kind="code" office={office} style={{ marginTop: 7 }} />
      <button onClick={onReset} style={resetButton}>Reset code</button>
    </div>
  );
}

// ── Office added ──────────────────────────────────────────────────────────────
// Nothing goes to the office on its own: the lab may not be ready to contact
// them yet, and a mistyped address would send the code to a stranger.

function CopyRow({ label, value, large }: { label: string; value: string; large?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
        <div style={{
          flex: 1, minWidth: 0, background: "#F0F4F8", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 6, padding: "7px 10px",
          fontFamily: "monospace", color: "#1a1a1a", wordBreak: "break-all",
          fontSize: large ? 15 : 12, fontWeight: large ? 600 : 400, letterSpacing: large ? "0.06em" : 0,
        }}>
          {value}
        </div>
        <button
          onClick={() => copyToClipboard(value).then((ok) => {
            if (ok) {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }
          })}
          style={{
            background: copied ? "#EBF5E9" : "#185FA5", color: copied ? "#3B6D11" : "white", border: "none", borderRadius: 6,
            padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function OfficeAddedModal({ office, onClose }: { office: Office; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, backdropFilter: "blur(2px)" }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${office.name} added`}
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 101,
          background: "#FFFFFF", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          width: "min(460px, calc(100vw - 32px))", maxHeight: "calc(100vh - 32px)", overflowY: "auto", padding: 20, boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>{office.name} is added</div>
        <p style={{ fontSize: 13, color: "#5F5E5A", lineHeight: 1.5, margin: "0 0 14px" }}>
          To follow their deliveries, the office needs both of these. Nothing has been sent to them yet. You can always find these on the office&apos;s card.
        </p>
        <CopyRow label="Tracking Link" value={trackingUrl(office.trackingToken)} />
        <CopyRow label="Access Code" value={office.accessCode ?? ""} large />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <EmailButton kind="link" office={office} />
          <EmailButton kind="code" office={office} />
        </div>
        <p style={{ fontSize: 12, color: "#5F5E5A", lineHeight: 1.5, margin: "8px 0 0" }}>
          {office.email ? SEPARATE_EMAILS_NOTE : "Add an email address to this office to send these from here."}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button autoFocus onClick={onClose} style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 7, padding: "7px 16px", fontSize: 13, color: "#3a3a3a", cursor: "pointer" }}>
            Done
          </button>
        </div>
      </div>
    </>
  );
}

// ── Reset confirmation ────────────────────────────────────────────────────────
// Both resets cut off people who may be relying on the page right now, so each
// spells out exactly what happens. Cancel holds the focus, so a stray Enter or
// double-click doesn't confirm.

function ResetModal({
  kind, office, onChanged, onClose,
}: {
  kind: "code" | "link";
  office: Office;
  onChanged: (o: Office) => void;
  onClose: () => void;
}) {
  const { apiFetch } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Office | null>(null);
  const [copied, setCopied] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      // apiFetch resolves on error responses too; the failure is in the body.
      const res = await apiFetch<{ data: Office | null; error: { message: string } | null }>(`/api/offices/${office.id}/reset-${kind}`, { method: "POST" });
      if (res.data) {
        onChanged(res.data);
        setDone(res.data);
      } else {
        setError(res.error?.message ?? "That didn't work. Nothing was changed.");
      }
    } catch {
      setError("Couldn't reach the server, so we can't confirm the reset. Reload the page to check before trying again.");
    } finally {
      setBusy(false);
    }
  }

  const newValue = done ? (kind === "code" ? done.accessCode ?? "" : trackingUrl(done.trackingToken)) : "";
  const noun = kind === "code" ? "access code" : "tracking link";

  return (
    <>
      <div onClick={busy ? undefined : onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, backdropFilter: "blur(2px)" }} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={done ? `New ${noun}` : `Reset ${noun}`}
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 101,
          background: "#FFFFFF", borderRadius: 12, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          width: "min(460px, calc(100vw - 32px))", maxHeight: "calc(100vh - 32px)", overflowY: "auto", padding: 20, boxSizing: "border-box",
        }}
      >
        {done ? (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 6 }}>
              {kind === "code" ? "New access code" : "New tracking link"} for {office.name}
            </div>
            <p style={{ fontSize: 13, color: "#5F5E5A", lineHeight: 1.5, margin: "0 0 12px" }}>
              {kind === "code"
                ? "The office is locked out of the full view until they have this code. It hasn't been sent to them yet."
                : "The old link has stopped working. This one hasn't been sent to the office yet, so they can't get in until you send it."}
            </p>
            <div style={{
              background: "#F0F4F8", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 6, padding: "9px 11px",
              fontFamily: "monospace", color: "#1a1a1a", wordBreak: "break-all",
              fontSize: kind === "code" ? 17 : 12.5, fontWeight: kind === "code" ? 600 : 400, letterSpacing: kind === "code" ? "0.06em" : 0,
            }}>
              {newValue}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => copyToClipboard(newValue).then((ok) => { if (ok) setCopied(true); })}
                style={{ flex: 1, background: copied ? "#EBF5E9" : "#185FA5", color: copied ? "#3B6D11" : "white", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
              >
                {copied ? "Copied!" : kind === "code" ? "Copy code" : "Copy link"}
              </button>
              <EmailButton kind={kind} office={done} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={onClose} style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 7, padding: "7px 16px", fontSize: 13, color: "#3a3a3a", cursor: "pointer" }}>
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 10 }}>
              Reset the {noun} for {office.name}?
            </div>
            <div style={{ background: "#FFF4F0", border: "1px solid #F5C9B8", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 13, fontWeight: 500, color: "#A33208", lineHeight: 1.5 }}>
              {kind === "code"
                ? "This takes effect immediately and can't be undone. The current code stops working for everyone at this office."
                : "This takes effect immediately and can't be undone. The current link stops working for everyone, including saved bookmarks."}
            </div>
            <ul style={{ margin: "0 0 14px", paddingLeft: 18, fontSize: 13, color: "#3a3a3a", lineHeight: 1.6 }}>
              {kind === "code" ? (
                <>
                  <li>Every device at the office is signed out, even if the page is open right now.</li>
                  <li>Until they enter the new code, the tracking link shows only a code screen. They can&apos;t see their cases, driver locations, messages, photos or delivery history, or request pickups.</li>
                  <li>You&apos;ll need to give the office the new code. It isn&apos;t sent automatically.</li>
                </>
              ) : (
                <>
                  <li>Anyone opening the old link sees a &quot;link isn&apos;t working&quot; page, with no case information at all.</li>
                  <li>The office can&apos;t see anything until you send them the new link. It isn&apos;t sent automatically.</li>
                  <li>The access code stays the same, but everyone has to enter it again on the new link.</li>
                </>
              )}
            </ul>
            {error && <div role="alert" style={{ fontSize: 12.5, color: "#C53B0A", marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button
                autoFocus
                onClick={onClose}
                disabled={busy}
                style={{ background: "#185FA5", color: "white", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
              >
                Cancel, keep it
              </button>
              <button
                onClick={confirm}
                disabled={busy}
                style={{ background: "#FFFFFF", color: "#C53B0A", border: "1px solid #C53B0A", borderRadius: 7, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 }}
              >
                {busy ? "Resetting…" : kind === "code" ? "Yes, reset the code" : "Yes, reset the link"}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Meta row ──────────────────────────────────────────────────────────────────

function MetaRow({ icon, text }: { icon: "person" | "phone" | "location" | "email"; text: string }) {
  const icons = {
    email: (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
        <rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M2 4l6 5 6-5" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
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
  onSave: (draft: OfficeDraft, id?: string) => Promise<void>;
}) {
  const [name, setName]               = useState(office?.name        ?? "");
  const [address, setAddress]         = useState(office?.address     ?? "");
  const [phone, setPhone]             = useState(office?.phone       ?? "");
  const [contactName, setContactName] = useState(office?.contactName ?? "");
  const [email, setEmail]             = useState(office?.email       ?? "");
  const [saving, setSaving]           = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ name, address, phone, contactName, email }, office?.id);
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
          <ModalField label="Email (for sending the access code)" value={email} onChange={setEmail} placeholder="frontdesk@sfsmile.com" type="email" />
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
