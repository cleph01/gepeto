"use client";

import { useEffect, useRef } from "react";
import type { Freshness } from "./format";

type LatLng = { lat: number; lng: number };

interface JobMapProps {
  driverName: string;
  driverLocation: LatLng;
  /** Delivery points for this driver's cases (usually just the office). */
  destinations: LatLng[];
  /** How recent the driver's location is: the dot fades, then turns gray. */
  freshness: Freshness;
}

// One map per driver on the public office tracking page: the driver plus where
// their cases for this office are headed, zoomed to fit both. A scoped-down
// version of dispatcher-web's fleet-wide LiveMap.
export default function JobMap({ driverName, driverLocation, destinations, freshness }: JobMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current!, { zoomControl: true, attributionControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = { map, L, driverMarker: null as unknown, destMarkers: [] as unknown[] };
      renderMarkers(mapRef.current, driverName, driverLocation, destinations, freshness);
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

  // Re-render only when a position actually changes (polling hands us new
  // objects every 30s), so the map doesn't snap back while someone pans it.
  const key = JSON.stringify([driverLocation.lat, driverLocation.lng, destinations, freshness]);
  useEffect(() => {
    if (!mapRef.current) return;
    renderMarkers(mapRef.current, driverName, driverLocation, destinations, freshness);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverName, key]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={containerRef} style={{ width: "100%", height: 200, background: "#eef1f5" }} />
    </>
  );
}

function renderMarkers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: { map: any; L: any; driverMarker: any; destMarkers: any[] },
  driverName: string,
  driverLocation: LatLng,
  destinations: LatLng[],
  freshness: Freshness
) {
  const { map, L } = ref;
  const points: [number, number][] = [[driverLocation.lat, driverLocation.lng]];

  if (ref.driverMarker) ref.driverMarker.remove();
  const initials = driverName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const driverIcon = L.divIcon({
    className: "",
    html: `
      <div style="
        width:30px;height:30px;border-radius:50%;
        background:${freshness === "stale" ? "#8A9099" : "#185FA5"};border:2.5px solid white;
        opacity:${freshness === "recent" ? 0.6 : 1};
        box-shadow:0 2px 6px rgba(0,0,0,0.35)${freshness === "stale" ? ",0 0 0 4px rgba(138,144,153,0.25)" : ""};
        outline:${freshness === "stale" ? "2px dashed #8A9099" : "none"};outline-offset:3px;
        display:flex;align-items:center;justify-content:center;
        font-size:10px;font-weight:600;color:white;font-family:sans-serif;
      ">${initials}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
  ref.driverMarker = L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon })
    .addTo(map)
    .bindPopup(`<strong>${driverName.replace(/[<>&]/g, "")}</strong><br>${freshness === "live" ? "your driver" : "last known location"}`);

  ref.destMarkers.forEach((m) => m.remove());
  const destIcon = L.divIcon({
    className: "",
    html: `<div style="width:12px;height:12px;border-radius:50%;background:#3B6D11;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
  ref.destMarkers = destinations.map((d) => {
    points.push([d.lat, d.lng]);
    return L.marker([d.lat, d.lng], { icon: destIcon }).addTo(map).bindPopup("Delivery destination");
  });

  map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
}
