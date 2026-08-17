"use client";

import { useState, useEffect } from "react";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useAuth } from "@/context/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LabInfo {
  labName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  timezone: string;
  operatingHoursStart: string;
  operatingHoursEnd: string;
}

interface ProfileInfo {
  name: string;
  email: string;
  role: string;
  phone: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  labRole: "owner" | "dispatcher";
  createdAt: string;
}

// ─── Notification defaults ────────────────────────────────────────────────────

const DEFAULT_NOTIFS = {
  statJobAlert:      true,
  unassignedAlert:   true,
  unassignedMinutes: "15",
  lateDeliveryAlert: true,
  lateDeliveryMins:  "30",
  driverOffDuty:     false,
};

const TIMEZONES = [
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Denver",      label: "Mountain Time (MT)" },
  { value: "America/Chicago",     label: "Central Time (CT)" },
  { value: "America/New_York",    label: "Eastern Time (ET)" },
  { value: "America/Phoenix",     label: "Arizona Time (MST, no DST)" },
  { value: "America/Anchorage",   label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu",    label: "Hawaii Time (HST)" },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const bp = useBreakpoint();
  const isMobile = bp === "mobile";
  const isDesktop = bp === "desktop";
  const { apiFetch, session } = useAuth();

  const [activeSection, setActiveSection] = useState<"profile" | "lab" | "team" | "notifications">("profile");

  const emptyLab: LabInfo = { labName: "", address: "", city: "", state: "", zip: "", phone: "", timezone: "America/Los_Angeles", operatingHoursStart: "07:00", operatingHoursEnd: "18:00" };
  const [lab, setLab]           = useState<LabInfo>(emptyLab);
  const [labDraft, setLabDraft] = useState<LabInfo>(emptyLab);
  const [labDirty, setLabDirty] = useState(false);
  const [labSaved, setLabSaved] = useState(false);

  const emptyProfile: ProfileInfo = { name: "", email: "", role: "", phone: "" };
  const [profile, setProfile] = useState<ProfileInfo>(emptyProfile);

  const [notifs, setNotifs] = useState(DEFAULT_NOTIFS);
  const [notifSaved, setNotifSaved] = useState(false);

  const [team, setTeam]           = useState<TeamMember[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function loadTeam() {
    const res = await apiFetch<{ data: TeamMember[] | null; error: { message: string } | null }>("/api/team");
    if (res.data) setTeam(res.data);
  }

  // ── Load settings ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!session) return;
    apiFetch<{ data: { lab: LabInfo & { name: string }; notifications: typeof DEFAULT_NOTIFS; profile: ProfileInfo } | null; error: null }>("/api/settings").then((res) => {
      if (!res.data) return;
      const labData: LabInfo = {
        labName:              res.data.lab.name ?? res.data.lab.labName ?? "",
        address:              res.data.lab.address,
        city:                 res.data.lab.city,
        state:                res.data.lab.state,
        zip:                  res.data.lab.zip,
        phone:                res.data.lab.phone,
        timezone:             res.data.lab.timezone,
        operatingHoursStart:  res.data.lab.operatingHoursStart,
        operatingHoursEnd:    res.data.lab.operatingHoursEnd,
      };
      setLab(labData);
      setLabDraft(labData);
      setNotifs({ ...DEFAULT_NOTIFS, ...res.data.notifications });
      setProfile(res.data.profile);
    });
    loadTeam();
  }, [session]);

  // ── Team handlers ───────────────────────────────────────────────────────────

  async function handleInvite(data: { name: string; email: string }) {
    setInviteError(null);
    const res = await apiFetch<{ data: TeamMember | null; error: { message: string } | null }>("/api/team", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.data) {
      setInviteError(res.error?.message ?? "Something went wrong. Please try again.");
      return;
    }
    setTeam((prev) => [...prev, res.data!]);
    setShowInvite(false);
  }

  // ── Lab handlers ────────────────────────────────────────────────────────────

  function handleLabChange(field: keyof LabInfo, value: string) {
    setLabDraft((prev) => ({ ...prev, [field]: value }));
    setLabDirty(true);
    setLabSaved(false);
  }

  async function handleLabSave() {
    await apiFetch("/api/settings/lab", {
      method: "PATCH",
      body: JSON.stringify({
        name:                labDraft.labName,
        address:             labDraft.address,
        city:                labDraft.city,
        state:               labDraft.state,
        zip:                 labDraft.zip,
        phone:               labDraft.phone,
        timezone:            labDraft.timezone,
        operatingHoursStart: labDraft.operatingHoursStart,
        operatingHoursEnd:   labDraft.operatingHoursEnd,
      }),
    });
    setLab(labDraft);
    setLabDirty(false);
    setLabSaved(true);
    setTimeout(() => setLabSaved(false), 3000);
  }

  function handleLabReset() {
    setLabDraft(lab);
    setLabDirty(false);
    setLabSaved(false);
  }

  // ── Notif handlers ──────────────────────────────────────────────────────────

  async function handleNotifSave() {
    await apiFetch("/api/settings/notifications", {
      method: "PATCH",
      body: JSON.stringify(notifs),
    });
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
  }

  // ── Layout ──────────────────────────────────────────────────────────────────

  const sections: { key: "profile" | "lab" | "team" | "notifications"; label: string; icon: React.ReactNode }[] = [
    {
      key: "profile",
      label: "Profile",
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.25" fill="none" />
          <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
        </svg>
      ),
    },
    {
      key: "lab",
      label: "Lab Info",
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="5.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.25" fill="none" />
          <path d="M5 5.5V4a3 3 0 016 0v1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
          <path d="M8 9v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      key: "team",
      label: "Team",
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <circle cx="5.5" cy="5" r="2.25" stroke="currentColor" strokeWidth="1.25" fill="none" />
          <path d="M1.5 13.5c0-2.485 1.79-3.75 4-3.75s4 1.265 4 3.75" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
          <path d="M10.5 3.1c1.02.26 1.75 1.1 1.75 2.15s-.73 1.89-1.75 2.15" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
          <path d="M10 9.9c1.7.28 2.9 1.42 2.9 3.6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" fill="none" />
        </svg>
      ),
    },
    {
      key: "notifications",
      label: "Notifications",
      icon: (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <path d="M8 2a4 4 0 00-4 4v3l-1 1.5h10L12 9V6a4 4 0 00-4-4z" stroke="currentColor" strokeWidth="1.25" fill="none" strokeLinejoin="round" />
          <path d="M6.5 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  const px = isMobile ? 16 : 24;
  const py = isMobile ? 16 : 24;

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
            Settings
          </h1>
          <p style={{ fontSize: 11.5, color: "#5F5E5A", margin: 0, fontWeight: 400 }}>
            Manage your profile and lab preferences
          </p>
        </div>
      </header>

      {/* Body */}
      <div style={{
        display: "flex",
        flex: 1,
        flexDirection: isDesktop ? "row" : "column",
        padding: `${py}px ${px}px`,
        gap: 20,
        maxWidth: 1100,
        width: "100%",
        alignSelf: "flex-start",
      }}>

        {/* ── Sidebar nav ── */}
        <nav style={{
          flexShrink: 0,
          width: isDesktop ? 200 : "100%",
        }}>
          <div style={{
            background: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
            display: "flex",
            flexDirection: isDesktop ? "column" : "row",
          }}>
            {sections.map((s) => {
              const isActive = activeSection === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActiveSection(s.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: isDesktop ? "10px 14px" : "10px 16px",
                    fontSize: 13,
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? "#185FA5" : "#3a3a3a",
                    background: isActive ? "#EBF2FA" : "transparent",
                    border: "none",
                    ...(isDesktop
                      ? { borderLeft: `2px solid ${isActive ? "#185FA5" : "transparent"}` }
                      : { borderBottom: `2px solid ${isActive ? "#185FA5" : "transparent"}` }
                    ),
                    cursor: "pointer",
                    textAlign: "left",
                    width: isDesktop ? "100%" : "auto",
                    flex: isDesktop ? undefined : 1,
                    justifyContent: isDesktop ? "flex-start" : "center",
                    transition: "background 0.12s, color 0.12s",
                    outline: "none",
                  }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.5, flexShrink: 0 }}>{s.icon}</span>
                  {isMobile ? null : s.label}
                  {isMobile && <span style={{ fontSize: 10.5, fontWeight: isActive ? 500 : 400 }}>{s.label}</span>}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ── Content panels ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ── Profile ── */}
          {activeSection === "profile" && (
            <div style={{
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
              overflow: "hidden",
            }}>
              <SectionHeader title="Profile" subtitle="Your account information" />
              <div style={{ padding: isMobile ? "16px" : "20px 24px" }}>

                {/* Avatar row */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 24,
                  paddingBottom: 20,
                  borderBottom: "1px solid rgba(0,0,0,0.06)",
                }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "#185FA5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 600,
                    color: "white",
                    flexShrink: 0,
                  }}>
                    {profile.name.slice(0, 2).toUpperCase() || "??"}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>{profile.name}</div>
                    <div style={{ fontSize: 12.5, color: "#5F5E5A", marginTop: 2 }}>{profile.role}</div>
                  </div>
                </div>

                {/* Fields — read-only */}
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
                  <ReadOnlyField label="Full Name"    value={profile.name} />
                  <ReadOnlyField label="Role"         value={profile.role} />
                  <ReadOnlyField label="Email"        value={profile.email} />
                  <ReadOnlyField label="Phone"        value={profile.phone} />
                </div>

                <InfoBanner text="To update your profile information, contact your lab administrator." />
              </div>
            </div>
          )}

          {/* ── Lab Info ── */}
          {activeSection === "lab" && (
            <div style={{
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
              overflow: "hidden",
            }}>
              <SectionHeader title="Lab Info" subtitle="Organization details and operating hours" />
              <div style={{ padding: isMobile ? "16px" : "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

                {/* Identity */}
                <FieldGroup label="Identity">
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
                    <Field
                      label="Lab Name"
                      value={labDraft.labName}
                      onChange={(v) => handleLabChange("labName", v)}
                      placeholder="Valley Dental Lab"
                      fullWidth
                    />
                    <Field
                      label="Phone"
                      value={labDraft.phone}
                      onChange={(v) => handleLabChange("phone", v)}
                      placeholder="(415) 555-0100"
                      type="tel"
                    />
                  </div>
                </FieldGroup>

                {/* Address */}
                <FieldGroup label="Address">
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <Field
                      label="Street Address"
                      value={labDraft.address}
                      onChange={(v) => handleLabChange("address", v)}
                      placeholder="1280 Industrial Blvd"
                      fullWidth
                    />
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 80px 120px", gap: 14 }}>
                      <Field
                        label="City"
                        value={labDraft.city}
                        onChange={(v) => handleLabChange("city", v)}
                        placeholder="San Francisco"
                      />
                      <SelectField
                        label="State"
                        value={labDraft.state}
                        onChange={(v) => handleLabChange("state", v)}
                        options={US_STATES.map((s) => ({ value: s, label: s }))}
                      />
                      <Field
                        label="ZIP"
                        value={labDraft.zip}
                        onChange={(v) => handleLabChange("zip", v)}
                        placeholder="94103"
                      />
                    </div>
                  </div>
                </FieldGroup>

                {/* Hours & timezone */}
                <FieldGroup label="Operating Hours">
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 14 }}>
                    <Field
                      label="Opens"
                      value={labDraft.operatingHoursStart}
                      onChange={(v) => handleLabChange("operatingHoursStart", v)}
                      type="time"
                    />
                    <Field
                      label="Closes"
                      value={labDraft.operatingHoursEnd}
                      onChange={(v) => handleLabChange("operatingHoursEnd", v)}
                      type="time"
                    />
                    <SelectField
                      label="Time Zone"
                      value={labDraft.timezone}
                      onChange={(v) => handleLabChange("timezone", v)}
                      options={TIMEZONES}
                    />
                  </div>
                </FieldGroup>

                {/* Save row */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 10,
                  paddingTop: 4,
                  borderTop: "1px solid rgba(0,0,0,0.06)",
                }}>
                  {labSaved && (
                    <span style={{ fontSize: 12.5, color: "#3B6D11", fontWeight: 500 }}>
                      ✓ Saved
                    </span>
                  )}
                  {labDirty && (
                    <button
                      onClick={handleLabReset}
                      style={{
                        background: "transparent",
                        border: "1px solid rgba(0,0,0,0.12)",
                        borderRadius: 7,
                        padding: "6px 14px",
                        fontSize: 13,
                        fontWeight: 400,
                        color: "#5F5E5A",
                        cursor: "pointer",
                      }}
                    >
                      Discard
                    </button>
                  )}
                  <button
                    onClick={handleLabSave}
                    disabled={!labDirty}
                    style={{
                      background: labDirty ? "#185FA5" : "rgba(0,0,0,0.07)",
                      color: labDirty ? "white" : "#9a9a9a",
                      border: "none",
                      borderRadius: 7,
                      padding: "6px 18px",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: labDirty ? "pointer" : "default",
                      transition: "background 0.15s, color 0.15s",
                    }}
                  >
                    Save Changes
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* ── Team ── */}
          {activeSection === "team" && (
            <div style={{
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
              overflow: "hidden",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid rgba(0,0,0,0.07)", background: "#FAFAFA" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a" }}>Team</div>
                  <div style={{ fontSize: 11.5, color: "#5F5E5A", marginTop: 1 }}>Dispatchers with access to this lab</div>
                </div>
                {profile.role === "owner" && (
                  <button
                    onClick={() => setShowInvite(true)}
                    style={{
                      background: "#185FA5", color: "white", border: "none", borderRadius: 7,
                      padding: "6px 14px", fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    + Invite Teammate
                  </button>
                )}
              </div>
              <div>
                {team.map((m, i) => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: isMobile ? "12px 16px" : "12px 24px",
                      borderBottom: i === team.length - 1 ? "none" : "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", background: "#185FA5",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 600, color: "white", flexShrink: 0,
                    }}>
                      {m.name.slice(0, 2).toUpperCase() || "??"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 500, color: "#1a1a1a", display: "flex", alignItems: "center", gap: 6 }}>
                        {m.name}
                        {m.email === profile.email && (
                          <span style={{ fontSize: 10.5, fontWeight: 500, color: "#5F5E5A", background: "rgba(95,94,90,0.10)", padding: "1px 6px", borderRadius: 999 }}>
                            You
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 1 }}>{m.email}</div>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 500, textTransform: "capitalize",
                      color: m.labRole === "owner" ? "#854F0B" : "#185FA5",
                      background: m.labRole === "owner" ? "rgba(133,79,11,0.10)" : "rgba(24,95,165,0.10)",
                      padding: "3px 9px", borderRadius: 999,
                    }}>
                      {m.labRole}
                    </span>
                  </div>
                ))}
                {team.length === 0 && (
                  <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 13, color: "#5F5E5A" }}>
                    No teammates yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Notifications ── */}
          {activeSection === "notifications" && (
            <div style={{
              background: "#FFFFFF",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
              overflow: "hidden",
            }}>
              <SectionHeader title="Notifications" subtitle="Configure alert thresholds and delivery preferences" />
              <div style={{ padding: isMobile ? "16px" : "20px 24px", display: "flex", flexDirection: "column", gap: 0 }}>

                <ToggleRow
                  label="STAT job created"
                  description="Alert immediately when a STAT-priority job is added"
                  checked={notifs.statJobAlert}
                  onChange={(v) => setNotifs((p) => ({ ...p, statJobAlert: v }))}
                />

                <ToggleRow
                  label="Unassigned job threshold"
                  description="Alert when a job has no driver assigned after a set time"
                  checked={notifs.unassignedAlert}
                  onChange={(v) => setNotifs((p) => ({ ...p, unassignedAlert: v }))}
                >
                  {notifs.unassignedAlert && (
                    <InlineMinutesPicker
                      value={notifs.unassignedMinutes}
                      onChange={(v) => setNotifs((p) => ({ ...p, unassignedMinutes: v }))}
                      label="Threshold"
                    />
                  )}
                </ToggleRow>

                <ToggleRow
                  label="Late delivery alert"
                  description="Alert when a delivery exceeds its estimated time"
                  checked={notifs.lateDeliveryAlert}
                  onChange={(v) => setNotifs((p) => ({ ...p, lateDeliveryAlert: v }))}
                >
                  {notifs.lateDeliveryAlert && (
                    <InlineMinutesPicker
                      value={notifs.lateDeliveryMins}
                      onChange={(v) => setNotifs((p) => ({ ...p, lateDeliveryMins: v }))}
                      label="Overdue after"
                    />
                  )}
                </ToggleRow>

                <ToggleRow
                  label="Driver goes off-duty"
                  description="Alert when a driver's status changes to Off Duty mid-shift"
                  checked={notifs.driverOffDuty}
                  onChange={(v) => setNotifs((p) => ({ ...p, driverOffDuty: v }))}
                  last
                />

                {/* Save row */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 10,
                  paddingTop: 16,
                }}>
                  {notifSaved && (
                    <span style={{ fontSize: 12.5, color: "#3B6D11", fontWeight: 500 }}>
                      ✓ Saved
                    </span>
                  )}
                  <button
                    onClick={handleNotifSave}
                    style={{
                      background: "#185FA5",
                      color: "white",
                      border: "none",
                      borderRadius: 7,
                      padding: "6px 18px",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modals */}
      {showInvite && (
        <InviteTeammateModal
          error={inviteError}
          onClose={() => { setShowInvite(false); setInviteError(null); }}
          onSave={handleInvite}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InviteTeammateModal({
  error,
  onClose,
  onSave,
}: {
  error: string | null;
  onClose: () => void;
  onSave: (data: { name: string; email: string }) => void;
}) {
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});

  const validate = () => {
    const e: typeof fieldErrors = {};
    if (!name.trim()) e.name = "Name is required.";
    if (!email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Enter a valid email address.";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) { setFieldErrors(e2); return; }
    setSaving(true);
    await onSave({ name: name.trim(), email: email.trim() });
    setSaving(false);
  };

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
      <div style={{
        background: "#fff", borderRadius: 14, width: "100%", maxWidth: 420,
        margin: "0 16px", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden",
      }}>
        <div style={{
          padding: "18px 20px 14px", borderBottom: "1px solid rgba(0,0,0,0.07)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1a1a1a", letterSpacing: "-0.01em" }}>
              Invite Teammate
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#5F5E5A" }}>
              An invite email will be sent so they can log in as a dispatcher.
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

        <form onSubmit={handleSubmit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div style={{ background: "rgba(163,45,45,0.07)", border: "1px solid rgba(163,45,45,0.2)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#A32D2D" }}>
              {error}
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a", display: "block", marginBottom: 5 }}>
              Full Name <span style={{ color: "#A32D2D" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setFieldErrors((prev) => ({ ...prev, name: undefined })); }}
              placeholder="e.g. Jordan Lee"
              style={{
                width: "100%", padding: "8px 11px", fontSize: 13.5,
                border: `1px solid ${fieldErrors.name ? "#A32D2D" : "rgba(0,0,0,0.14)"}`,
                borderRadius: 8, outline: "none", color: "#1a1a1a",
                background: fieldErrors.name ? "rgba(163,45,45,0.04)" : "#fff",
                boxSizing: "border-box",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#185FA5"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(24,95,165,0.10)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.name ? "#A32D2D" : "rgba(0,0,0,0.14)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            {fieldErrors.name && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#A32D2D" }}>{fieldErrors.name}</p>}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a", display: "block", marginBottom: 5 }}>
              Email <span style={{ color: "#A32D2D" }}>*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFieldErrors((prev) => ({ ...prev, email: undefined })); }}
              placeholder="teammate@example.com"
              style={{
                width: "100%", padding: "8px 11px", fontSize: 13.5,
                border: `1px solid ${fieldErrors.email ? "#A32D2D" : "rgba(0,0,0,0.14)"}`,
                borderRadius: 8, outline: "none", color: "#1a1a1a",
                background: fieldErrors.email ? "rgba(163,45,45,0.04)" : "#fff",
                boxSizing: "border-box",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "#185FA5"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(24,95,165,0.10)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = fieldErrors.email ? "#A32D2D" : "rgba(0,0,0,0.14)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            {fieldErrors.email && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#A32D2D" }}>{fieldErrors.email}</p>}
            <p style={{ margin: "5px 0 0", fontSize: 11.5, color: "#5F5E5A" }}>
              They'll be invited as a dispatcher — able to manage jobs, drivers, and offices.
            </p>
          </div>

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
              disabled={saving}
              style={{
                flex: 2, padding: "9px", fontSize: 13.5, fontWeight: 600,
                border: "none", borderRadius: 8,
                background: "#185FA5", color: "white", cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Sending Invite…" : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{
      padding: "14px 20px",
      borderBottom: "1px solid rgba(0,0,0,0.07)",
      background: "#FAFAFA",
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a" }}>{title}</div>
      <div style={{ fontSize: 11.5, color: "#5F5E5A", marginTop: 1 }}>{subtitle}</div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 500, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", fullWidth,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; fullWidth?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: fullWidth ? "1 / -1" : undefined }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a" }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 7,
          padding: "7px 10px",
          fontSize: 13,
          color: "#1a1a1a",
          background: "#FFFFFF",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "inherit",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#185FA5"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(24,95,165,0.10)"; }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)"; e.currentTarget.style.boxShadow = "none"; }}
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a" }}>{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 7,
          padding: "7px 10px",
          fontSize: 13,
          color: "#1a1a1a",
          background: "#FFFFFF",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
          fontFamily: "inherit",
          cursor: "pointer",
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%235F5E5A' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 10px center",
          paddingRight: 28,
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#185FA5"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(24,95,165,0.10)"; }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.12)"; e.currentTarget.style.boxShadow = "none"; }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#3a3a3a" }}>{label}</label>
      <div style={{
        border: "1px solid rgba(0,0,0,0.08)",
        borderRadius: 7,
        padding: "7px 10px",
        fontSize: 13,
        color: "#5F5E5A",
        background: "#F8F9FB",
      }}>
        {value}
      </div>
    </div>
  );
}

function InfoBanner({ text }: { text: string }) {
  return (
    <div style={{
      marginTop: 20,
      background: "#EBF2FA",
      border: "1px solid rgba(24,95,165,0.15)",
      borderRadius: 8,
      padding: "10px 14px",
      display: "flex",
      alignItems: "flex-start",
      gap: 9,
    }}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
        <circle cx="7" cy="7" r="6" stroke="#185FA5" strokeWidth="1.25" fill="none" />
        <path d="M7 6v4M7 4.5v.5" stroke="#185FA5" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
      <span style={{ fontSize: 12.5, color: "#185FA5", lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

function ToggleRow({
  label, description, checked, onChange, children, last,
}: {
  label: string; description: string; checked: boolean;
  onChange: (v: boolean) => void; children?: React.ReactNode; last?: boolean;
}) {
  return (
    <div style={{
      paddingTop: 16,
      paddingBottom: 16,
      borderBottom: last ? "none" : "1px solid rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: "#1a1a1a" }}>{label}</div>
          <div style={{ fontSize: 12, color: "#5F5E5A", marginTop: 2 }}>{description}</div>
        </div>
        {/* Toggle switch */}
        <button
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          style={{
            flexShrink: 0,
            width: 40,
            height: 22,
            borderRadius: 11,
            background: checked ? "#185FA5" : "rgba(0,0,0,0.15)",
            border: "none",
            cursor: "pointer",
            position: "relative",
            transition: "background 0.18s",
            outline: "none",
            padding: 0,
          }}
        >
          <span style={{
            position: "absolute",
            top: 3,
            left: checked ? 21 : 3,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            transition: "left 0.18s",
          }} />
        </button>
      </div>
      {children && (
        <div style={{ marginTop: 10 }}>{children}</div>
      )}
    </div>
  );
}

function InlineMinutesPicker({
  value, onChange, label,
}: {
  value: string; onChange: (v: string) => void; label: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 12.5, color: "#5F5E5A" }}>{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 6,
          padding: "4px 24px 4px 8px",
          fontSize: 12.5,
          color: "#1a1a1a",
          background: "#FFFFFF",
          outline: "none",
          fontFamily: "inherit",
          cursor: "pointer",
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%235F5E5A' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px center",
        }}
      >
        {["5","10","15","20","30","45","60"].map((m) => (
          <option key={m} value={m}>{m} min</option>
        ))}
      </select>
    </div>
  );
}
