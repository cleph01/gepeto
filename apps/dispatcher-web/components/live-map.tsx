"use client";

import { useEffect, useRef } from "react";

type DriverPin = {
  id: string;
  name: string;
  status: string;
  /** updatedAt: when the driver's phone last sent it (absent on very old rows). */
  currentLocation: { lat: number; lng: number; updatedAt?: string } | null;
};

type JobMarker = {
  id: string;
  caseId: string;
  officeName: string;
  status: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
};

interface LiveMapProps {
  drivers: DriverPin[];
  jobs: JobMarker[];
  /** Ticks from the page so "last seen" ages without new data. */
  now: Date;
}

// How much to trust a driver's last location (the app sends one about every
// 30s). Looser than the office page, since dispatch knows what "last seen" means:
//   live    under 2 min      normal pin
//   recent  2–15 min         faded pin
//   stale   15 min – 8 hrs   gray dashed pin, "last seen" in the popup
//   gone    over 8 hrs, or no time recorded: no pin
type Freshness = "live" | "recent" | "stale" | "gone";
function freshness(updatedAt: string | undefined, now: number): Freshness {
  if (!updatedAt) return "gone";
  const mins = (now - new Date(updatedAt).getTime()) / 60000;
  if (mins < 2) return "live";
  if (mins < 15) return "recent";
  if (mins < 480) return "stale";
  return "gone";
}

function ago(updatedAt: string, now: number) {
  const m = Math.max(0, Math.floor((now - new Date(updatedAt).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} hr ${m % 60} min ago`;
}

const escape = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

// Status → color
const STATUS_COLOR: Record<string, string> = {
  in_transit:  "#185FA5",
  picked_up:   "#185FA5",
  assigned:    "#854F0B",
  arrived:     "#3B6D11",
  pending:     "#9a9a9a",
  delivered:   "#3B6D11",
};

export default function LiveMap({ drivers, jobs, now }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    // Dynamic import so Leaflet only runs client-side
    import("leaflet").then((L) => {
      // Guard against unmount during async import (Strict Mode / Fast Refresh)
      if (cancelled || !containerRef.current || mapRef.current) return;

      // Fix default icon paths broken by webpack
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = { map, L, markers: [] as unknown[] };

      // Fit to data on first load
      updateMarkers(mapRef.current, drivers, jobs, now.getTime());
    });

    return () => {
      cancelled = true;
      if (mapRef.current?.map) {
        mapRef.current.map.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when data changes
  useEffect(() => {
    if (!mapRef.current) return;
    updateMarkers(mapRef.current, drivers, jobs, now.getTime());
  }, [drivers, jobs, now]);

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      {/* isolation keeps Leaflet's high z-index layers (400+) inside the map,
          so popups and windows opened over it aren't drawn underneath. */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", background: "#1a2535", isolation: "isolate" }}
      />
    </>
  );
}

// ── Marker management ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateMarkers(ref: { map: any; L: any; markers: any[]; defaultViewSet?: boolean; fittedKey?: string }, drivers: DriverPin[], jobs: JobMarker[], now: number) {
  const { map, L, markers } = ref;

  // Remove existing markers
  markers.forEach((m) => m.remove());
  ref.markers = [];

  const points: [number, number][] = [];

  // Driver pins
  for (const d of drivers) {
    if (!d.currentLocation) continue;
    const { lat, lng, updatedAt } = d.currentLocation;
    const fresh = freshness(updatedAt, now);
    if (fresh === "gone") continue;
    points.push([lat, lng]);

    const initials = d.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
    const color = fresh === "stale" ? "#8A9099" : d.status === "on_delivery" ? "#185FA5" : "#3B6D11";

    const icon = L.divIcon({
      className: "",
      html: `
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:${color};border:2.5px solid white;
          opacity:${fresh === "recent" ? 0.6 : 1};
          box-shadow:0 2px 6px rgba(0,0,0,0.35);
          outline:${fresh === "stale" ? "2px dashed #8A9099" : "none"};outline-offset:3px;
          display:flex;align-items:center;justify-content:center;
          font-size:11px;font-weight:600;color:white;font-family:sans-serif;
        ">${escape(initials)}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([lat, lng], { icon })
      .addTo(map)
      .bindPopup(
        `<strong>${escape(d.name)}</strong><br>${d.status.replace("_", " ")}` +
        (updatedAt ? `<br><span style="color:${fresh === "stale" ? "#854F0B" : "#5F5E5A"}">${fresh === "live" ? "Live · " : "Last seen "}${ago(updatedAt, now)}</span>` : "")
      );
    ref.markers.push(marker);
  }

  // Job destination markers
  for (const j of jobs) {
    if (j.deliveryLat == null || j.deliveryLng == null) continue;
    points.push([j.deliveryLat, j.deliveryLng]);

    const color = STATUS_COLOR[j.status] ?? "#9a9a9a";

    const icon = L.divIcon({
      className: "",
      html: `
        <div style="
          width:10px;height:10px;border-radius:50%;
          background:${color};border:2px solid white;
          box-shadow:0 1px 4px rgba(0,0,0,0.4);
        "></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });

    const marker = L.marker([j.deliveryLat, j.deliveryLng], { icon })
      .addTo(map)
      .bindPopup(`<strong>${escape(j.caseId)}</strong><br>${escape(j.officeName)}<br>${j.status.replace("_", " ")}`);
    ref.markers.push(marker);
  }

  // Fit map to visible markers, or default to continental US. Only when the
  // pins actually moved, so the minute tick doesn't undo someone's panning.
  const fitKey = JSON.stringify(points);
  if (points.length > 0 && fitKey !== ref.fittedKey) {
    ref.fittedKey = fitKey;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
  } else if (points.length === 0 && !ref.defaultViewSet) {
    map.setView([39.5, -98.35], 4);
    ref.defaultViewSet = true;
  }
}
