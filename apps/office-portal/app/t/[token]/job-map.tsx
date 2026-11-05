"use client";

import { useEffect, useRef, useState } from "react";
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
  // Once someone moves the map it stays where they put it, until they ask to recenter.
  const [moved, setMoved] = useState(false);
  const movedRef = useRef(false);
  const noteMoved = () => {
    movedRef.current = true;
    setMoved(true);
  };

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

      // Only a person's hands count here: the map's own move events fire for our refits too.
      const el = containerRef.current!;
      map.on("dragstart", noteMoved);
      el.addEventListener("wheel", noteMoved, { capture: true, passive: true });
      el.addEventListener("dblclick", noteMoved, { capture: true });
      el.addEventListener("touchstart", (e: TouchEvent) => { if (e.touches.length > 1) noteMoved(); }, { capture: true, passive: true });
      el.addEventListener("pointerdown", (e: PointerEvent) => {
        if ((e.target as Element).closest?.(".leaflet-control-zoom")) noteMoved();
      }, { capture: true });

      mapRef.current = { map, L, driverMarker: null, iconKey: "", destMarkers: [], destKey: "", points: [], glide: null };
      renderMarkers(mapRef.current, driverName, driverLocation, destinations, freshness, false);
    });

    return () => {
      cancelled = true;
      if (mapRef.current?.map) {
        if (mapRef.current.glide) cancelAnimationFrame(mapRef.current.glide);
        mapRef.current.map.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-render only when a position actually changes (every reload hands us new objects).
  const key = JSON.stringify([driverLocation.lat, driverLocation.lng, destinations, freshness]);
  useEffect(() => {
    if (!mapRef.current) return;
    renderMarkers(mapRef.current, driverName, driverLocation, destinations, freshness, movedRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverName, key]);

  function recenter() {
    movedRef.current = false;
    setMoved(false);
    fit(mapRef.current);
  }

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div style={{ position: "relative" }}>
        <div ref={containerRef} style={{ width: "100%", height: 200, background: "#eef1f5" }} />
        {moved && (
          <button
            onClick={recenter}
            style={{
              // Above Leaflet, whose map controls sit at z-index 1000.
              position: "absolute", top: 10, right: 10, zIndex: 1001, padding: "5px 10px", fontSize: 12, fontWeight: 600,
              color: "#185FA5", background: "#fff", border: "1px solid #C0D9F0", borderRadius: 7, boxShadow: "0 1px 4px rgba(0,0,0,0.2)", cursor: "pointer",
            }}
          >
            Recenter
          </button>
        )}
      </div>
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MapRef = { map: any; L: any; driverMarker: any; iconKey: string; destMarkers: any[]; destKey: string; points: [number, number][]; glide: number | null };

const GLIDE_MS = 1_000;

function fit(ref: MapRef | null) {
  if (ref?.points.length) ref.map.fitBounds(ref.L.latLngBounds(ref.points), { padding: [30, 30], maxZoom: 15 });
}

// Slides the marker to its new spot rather than jumping, unless the person asked for less motion.
function glideTo(ref: MapRef, to: LatLng) {
  if (ref.glide) cancelAnimationFrame(ref.glide);
  ref.glide = null;
  const from = ref.driverMarker.getLatLng();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden) {
    ref.driverMarker.setLatLng([to.lat, to.lng]);
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    const t = Math.min((now - start) / GLIDE_MS, 1);
    ref.driverMarker.setLatLng([from.lat + (to.lat - from.lat) * t, from.lng + (to.lng - from.lng) * t]);
    ref.glide = t < 1 ? requestAnimationFrame(step) : null;
  };
  ref.glide = requestAnimationFrame(step);
}

function renderMarkers(
  ref: MapRef,
  driverName: string,
  driverLocation: LatLng,
  destinations: LatLng[],
  freshness: Freshness,
  keepView: boolean
) {
  const { map, L } = ref;
  const initials = driverName.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  // Kept between updates, not rebuilt, so it can glide and an open popup stays open.
  const iconKey = `${initials}|${freshness}`;
  if (ref.iconKey !== iconKey) {
    ref.iconKey = iconKey;
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
    const popup = `<strong>${driverName.replace(/[<>&]/g, "")}</strong><br>${freshness === "live" ? "your driver" : "last known location"}`;
    if (ref.driverMarker) ref.driverMarker.setIcon(driverIcon).setPopupContent(popup);
    else ref.driverMarker = L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon }).addTo(map).bindPopup(popup);
  }
  glideTo(ref, driverLocation);

  const destKey = JSON.stringify(destinations);
  if (ref.destKey !== destKey) {
    ref.destKey = destKey;
    ref.destMarkers.forEach((m) => m.remove());
    const destIcon = L.divIcon({
      className: "",
      html: `<div style="width:12px;height:12px;border-radius:50%;background:#3B6D11;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    ref.destMarkers = destinations.map((d) => L.marker([d.lat, d.lng], { icon: destIcon }).addTo(map).bindPopup("Delivery destination"));
  }

  ref.points = [[driverLocation.lat, driverLocation.lng], ...destinations.map((d): [number, number] => [d.lat, d.lng])];
  // Leaflet needs a view before anything else, so the first render always fits.
  if (!keepView) fit(ref);
}
