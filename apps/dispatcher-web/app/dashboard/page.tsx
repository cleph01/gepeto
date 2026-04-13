"use client";

export default function DashboardPage() {
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
            Saturday, April 12, 2026 · Valley Dental Lab
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
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* LEFT PANEL */}
        <div
          style={{
            flex: "0 0 55%",
            overflowY: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Metrics row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <MetricCard value="42" label="Total Jobs" />
            <MetricCard value="8" label="In Transit" color="#185FA5" />
            <MetricCard value="31" label="Delivered Today" color="#3B6D11" />
            <MetricCard value="3" label="Pending" color="#854F0B" />
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
                  11
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
            {JOBS.map((job, i) => (
              <JobRow key={job.caseId} job={job} isLast={i === JOBS.length - 1} />
            ))}
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
              {DRIVERS.map((d) => (
                <DriverRow key={d.name} driver={d} />
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Live Map */}
        <div
          style={{
            flex: "0 0 45%",
            padding: "20px 24px 20px 0",
            display: "flex",
            flexDirection: "column",
          }}
        >
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
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>8 drivers active</span>
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
              {/* Grid overlay */}
              <svg
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.12 }}
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* Simulated road lines */}
              <svg
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.18 }}
                xmlns="http://www.w3.org/2000/svg"
              >
                <line x1="0" y1="38%" x2="100%" y2="42%" stroke="rgba(255,255,255,0.6)" strokeWidth="2" />
                <line x1="0" y1="62%" x2="100%" y2="65%" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                <line x1="28%" y1="0" x2="32%" y2="100%" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
                <line x1="60%" y1="0" x2="57%" y2="100%" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                <line x1="0" y1="22%" x2="55%" y2="18%" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                <line x1="45%" y1="75%" x2="100%" y2="78%" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
              </svg>

              {/* Driver pins */}
              <DriverPin initials="MR" color="#185FA5" top="34%" left="26%" label="Marco R." jobs={3} />
              <DriverPin initials="JS" color="#3B6D11" top="52%" left="58%" label="Jordan S." jobs={2} />
              <DriverPin initials="AL" color="#854F0B" top="22%" left="68%" label="Aisha L." jobs={1} pulse />
              <DriverPin initials="TK" color="#185FA5" top="68%" left="38%" label="Tim K." jobs={2} />
              <DriverPin initials="CM" color="#3B6D11" top="44%" left="80%" label="Chris M." jobs={1} />

              {/* Delivery destination markers */}
              <DestMarker top="38%" left="42%" />
              <DestMarker top="28%" left="72%" />
              <DestMarker top="60%" left="50%" />
              <DestMarker top="48%" left="20%" />

              {/* Route line */}
              <svg
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M 26% 34% Q 35% 38% 42% 38%"
                  fill="none"
                  stroke="#185FA5"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  opacity="0.6"
                />
                <path
                  d="M 58% 52% Q 65% 46% 72% 28%"
                  fill="none"
                  stroke="#3B6D11"
                  strokeWidth="2"
                  strokeDasharray="4 3"
                  opacity="0.6"
                />
              </svg>
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
                Map powered by Google Maps
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
  caseId: string;
  office: string;
  driver: string;
  priority: "stat" | "standard";
  status: "pending" | "assigned" | "picked_up" | "in_transit" | "arrived" | "delivered";
  updated: string;
};

const STATUS_CONFIG: Record<Job["status"], { label: string; bg: string; text: string }> = {
  pending:    { label: "Pending",    bg: "rgba(95,94,90,0.10)",  text: "#5F5E5A" },
  assigned:   { label: "Assigned",   bg: "rgba(24,95,165,0.08)", text: "#185FA5" },
  picked_up:  { label: "Picked Up",  bg: "rgba(24,95,165,0.10)", text: "#185FA5" },
  in_transit: { label: "In Transit", bg: "rgba(24,95,165,0.10)", text: "#185FA5" },
  arrived:    { label: "Arrived",    bg: "rgba(133,79,11,0.10)", text: "#854F0B" },
  delivered:  { label: "Delivered",  bg: "rgba(59,109,17,0.10)", text: "#3B6D11" },
};

const JOBS: Job[] = [
  { caseId: "LAB-2041", office: "Bright Smile Dental",    driver: "Marco R.",  priority: "stat",     status: "in_transit", updated: "2m ago" },
  { caseId: "LAB-2039", office: "Sunrise Orthodontics",   driver: "Jordan S.", priority: "standard", status: "picked_up",  updated: "8m ago" },
  { caseId: "LAB-2038", office: "Pacific Dental Group",   driver: "Aisha L.",  priority: "stat",     status: "arrived",    updated: "11m ago" },
  { caseId: "LAB-2036", office: "Westside Family Dental", driver: "Tim K.",    priority: "standard", status: "in_transit", updated: "18m ago" },
  { caseId: "LAB-2033", office: "Downtown Dental Arts",   driver: "Chris M.",  priority: "standard", status: "delivered",  updated: "34m ago" },
  { caseId: "LAB-2031", office: "Bay Area Periodontics",  driver: "—",         priority: "standard", status: "pending",    updated: "47m ago" },
];

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
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 500, color: "#185FA5", fontFamily: "monospace" }}>
        {job.caseId}
      </span>
      <span style={{ fontSize: 13, color: "#1a1a1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
        {job.office}
      </span>
      <span style={{ fontSize: 13, color: "#3a3a3a" }}>{job.driver}</span>
      <span>
        {job.priority === "stat" ? (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              background: "rgba(133,79,11,0.10)",
              color: "#854F0B",
              borderRadius: 20,
              padding: "2px 8px",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            STAT
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "#9a9a9a" }}>Standard</span>
        )}
      </span>
      <span>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 500,
            background: status.bg,
            color: status.text,
            borderRadius: 20,
            padding: "2.5px 9px",
          }}
        >
          {status.label}
        </span>
      </span>
      <span style={{ fontSize: 12, color: "#9a9a9a" }}>{job.updated}</span>
    </div>
  );
}

const DRIVERS = [
  { name: "Marco R.",  initials: "MR", status: "on_delivery" as const, jobs: 3, location: "Mission District" },
  { name: "Jordan S.", initials: "JS", status: "on_delivery" as const, jobs: 2, location: "SoMa" },
  { name: "Aisha L.",  initials: "AL", status: "on_delivery" as const, jobs: 1, location: "Civic Center" },
  { name: "Tim K.",    initials: "TK", status: "on_delivery" as const, jobs: 2, location: "Castro" },
  { name: "Chris M.",  initials: "CM", status: "available"   as const, jobs: 0, location: "Depot" },
];

const DRIVER_STATUS_CONFIG = {
  available:    { label: "Available",    color: "#3B6D11", bg: "rgba(59,109,17,0.10)"  },
  on_delivery:  { label: "On Delivery",  color: "#185FA5", bg: "rgba(24,95,165,0.10)"  },
  off_duty:     { label: "Off Duty",     color: "#5F5E5A", bg: "rgba(95,94,90,0.10)"   },
};

function DriverRow({ driver }: { driver: typeof DRIVERS[0] }) {
  const s = DRIVER_STATUS_CONFIG[driver.status];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 16px",
        cursor: "pointer",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.018)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          background: "#185FA5",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 600,
          color: "white",
          flexShrink: 0,
        }}
      >
        {driver.initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{driver.name}</div>
        <div style={{ fontSize: 11.5, color: "#5F5E5A" }}>{driver.location}</div>
      </div>
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          background: s.bg,
          color: s.color,
          borderRadius: 20,
          padding: "2px 9px",
          flexShrink: 0,
        }}
      >
        {s.label}
      </span>
      {driver.jobs > 0 && (
        <span style={{ fontSize: 12, color: "#5F5E5A", flexShrink: 0 }}>
          {driver.jobs} job{driver.jobs !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}

function DriverPin({
  initials,
  color,
  top,
  left,
  label,
  jobs,
  pulse,
}: {
  initials: string;
  color: string;
  top: string;
  left: string;
  label: string;
  jobs: number;
  pulse?: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        zIndex: 10,
      }}
    >
      {pulse && (
        <div
          style={{
            position: "absolute",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: color,
            opacity: 0.2,
            animation: "pulse 2s infinite",
          }}
        />
      )}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: color,
          border: "2px solid white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 600,
          color: "white",
          boxShadow: `0 2px 8px ${color}60`,
          position: "relative",
          zIndex: 1,
        }}
      >
        {initials}
      </div>
      <div
        style={{
          background: "rgba(0,0,0,0.75)",
          color: "white",
          fontSize: 9.5,
          fontWeight: 500,
          padding: "1.5px 6px",
          borderRadius: 4,
          whiteSpace: "nowrap",
          backdropFilter: "blur(4px)",
        }}
      >
        {label} · {jobs}
      </div>
    </div>
  );
}

function DestMarker({ top, left }: { top: string; left: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        transform: "translate(-50%, -50%)",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.85)",
        border: "2px solid rgba(255,255,255,0.5)",
        boxShadow: "0 0 0 3px rgba(255,255,255,0.15)",
        zIndex: 5,
      }}
    />
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
