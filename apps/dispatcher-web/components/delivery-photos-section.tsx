"use client";

import { useEffect, useState } from "react";
import type { ApiResponse } from "@gepeto/types";
import { useAuth } from "@/context/auth";

interface PhotoSettings {
  required: boolean;
  retentionDays: number;
}

const KEEP_OPTIONS = [
  { days: 90, label: "90 days (default)" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
  { days: 730, label: "2 years" },
];

// Settings → Proof of delivery: whether drivers must take a drop-off photo, and
// how long photos are kept before the nightly cleanup deletes them. The
// recipient name and delivery time stay on the job either way.
export default function DeliveryPhotosSection({ isMobile }: { isMobile: boolean }) {
  const { apiFetch } = useAuth();
  const [s, setS] = useState<PhotoSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<ApiResponse<PhotoSettings>>("/api/settings/delivery-photos")
      .then((res) => { if (res.data) setS(res.data); else setError(res.error?.message ?? "Couldn't load settings."); })
      .catch(() => setError("Couldn't load settings."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (patch: Partial<PhotoSettings>) => {
    if (!s) return;
    const before = s;
    setS({ ...s, ...patch });
    setError(null);
    setSaved(false);
    const res = await apiFetch<ApiResponse<PhotoSettings>>("/api/settings/delivery-photos", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).catch(() => null);
    if (res?.data) {
      setS(res.data);
      setSaved(true);
    } else {
      setS(before);
      setError(res?.error?.message ?? "Couldn't save. Try again.");
    }
  };

  const card: React.CSSProperties = {
    background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.07)", overflow: "hidden",
  };
  const pad = isMobile ? 16 : 24;

  return (
    <div style={card}>
      <div style={{ padding: `${isMobile ? 14 : 18}px ${pad}px`, borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div style={{ fontSize: 14.5, fontWeight: 600, color: "#1a1a1a" }}>Proof of delivery</div>
        <div style={{ fontSize: 12.5, color: "#5F5E5A", marginTop: 2 }}>Drop-off photos from your drivers</div>
      </div>
      <div style={{ padding: `4px ${pad}px ${pad}px` }}>
        {!s ? (
          <div style={{ paddingTop: 16, fontSize: 13, color: error ? "#A32D2D" : "#9a9a9a" }}>{error ?? "Loading…"}</div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, padding: "16px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "#1a1a1a" }}>Require a photo on every delivery</div>
                <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 2 }}>
                  When off, drivers can still add one. Either way they enter who received it.
                </div>
              </div>
              <button
                role="switch"
                aria-checked={s.required}
                aria-label="Require a photo on every delivery"
                onClick={() => save({ required: !s.required })}
                style={{
                  flexShrink: 0, width: 40, height: 22, borderRadius: 11, border: "none", padding: 0,
                  background: s.required ? "#185FA5" : "rgba(0,0,0,0.15)", cursor: "pointer",
                  position: "relative", transition: "background 0.18s", outline: "none",
                }}
              >
                <span style={{
                  position: "absolute", top: 3, left: s.required ? 21 : 3, width: 16, height: 16,
                  borderRadius: "50%", background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  transition: "left 0.18s",
                }} />
              </button>
            </div>

            <div style={{ padding: "16px 0 0" }}>
              <label htmlFor="pod-keep" style={{ fontSize: 13.5, fontWeight: 500, color: "#1a1a1a" }}>Keep photos for</label>
              <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 2, marginBottom: 10, lineHeight: 1.5 }}>
                Photos are deleted automatically this long after delivery. The delivery record and who received it are kept.
                Choosing a shorter time deletes older photos tonight.
              </div>
              <select
                id="pod-keep"
                value={s.retentionDays}
                onChange={(e) => save({ retentionDays: Number(e.target.value) })}
                style={{
                  fontSize: 13.5, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.15)",
                  background: "#fff", color: "#1a1a1a", minWidth: isMobile ? "100%" : 220,
                }}
              >
                {KEEP_OPTIONS.map((o) => <option key={o.days} value={o.days}>{o.label}</option>)}
              </select>
            </div>

            <div style={{ marginTop: 16, fontSize: 12, color: "#5F5E5A", lineHeight: 1.5, background: "#F8F9FB", borderRadius: 8, padding: "10px 12px" }}>
              Drivers are asked to photograph the drop-off, not labels or paperwork, so patient names stay out of Gepeto.
            </div>

            {(error || saved) && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: error ? "#A32D2D" : "#3B6D11" }}>{error ?? "Saved"}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
