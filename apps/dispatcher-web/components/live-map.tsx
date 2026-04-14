"use client";

import { useEffect, useRef } from "react";

type DriverPin = {
  id: string;
  name: string;
  status: string;
  currentLocation: { lat: number; lng: number } | null;
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
}

// Status → color
const STATUS_COLOR: Record<string, string> = {
  in_transit:  "#185FA5",
  picked_up:   "#185FA5",
  assigned:    "#854F0B",
  arrived:     "#3B6D11",
  pending:     "#9a9a9a",
  delivered:   "#3B6D11",
};

export default function LiveMap({ drivers, jobs }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Dynamic import so Leaflet only runs client-side
    import("leaflet").then((L) => {
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
      updateMarkers({ map, L, markers: mapRef.current.markers }, drivers, jobs);
    });

    return () => {
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
    updateMarkers(mapRef.current, drivers, jobs);
  }, [drivers, jobs]);

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", background: "#1a2535" }}
      />
    </>
  );
}

// ── Marker management ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function updateMarkers(ref: { map: any; L: any; markers: any[]; defaultViewSet?: boolean }, drivers: DriverPin[], jobs: JobMarker[]) {
  const { map, L, markers } = ref;

  // Remove existing markers
  markers.forEach((m) => m.remove());
  ref.markers = [];

  const points: [number, number][] = [];

  // Driver pins
  for (const d of drivers) {
    if (!d.currentLocation) continue;
    const { lat, lng } = d.currentLocation;
    points.push([lat, lng]);

    const initials = d.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
    const color = d.status === "on_delivery" ? "#185FA5" : "#3B6D11";

    const icon = L.divIcon({
      className: "",
      html: `
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:${color};border:2.5px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,0.35);
          display:flex;align-items:center;justify-content:center;
          font-size:11px;font-weight:600;color:white;font-family:sans-serif;
        ">${initials}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([lat, lng], { icon })
      .addTo(map)
      .bindPopup(`<strong>${d.name}</strong><br>${d.status.replace("_", " ")}`);
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
      .bindPopup(`<strong>${j.caseId}</strong><br>${j.officeName}<br>${j.status.replace("_", " ")}`);
    ref.markers.push(marker);
  }

  // Fit map to visible markers, or default to continental US
  if (points.length > 0) {
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 14 });
  } else if (!ref.defaultViewSet) {
    map.setView([39.5, -98.35], 4);
    ref.defaultViewSet = true;
  }
}
