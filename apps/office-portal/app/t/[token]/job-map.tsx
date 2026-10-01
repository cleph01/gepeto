"use client";

import { useEffect, useRef } from "react";

interface JobMapProps {
  driverName: string;
  driverLocation: { lat: number; lng: number };
  deliveryLat: number | null;
  deliveryLng: number | null;
}

// Single-driver tracking map for the public office tracking page — a scoped-down
// version of dispatcher-web's fleet-wide LiveMap, showing just this one delivery.
export default function JobMap({ driverName, driverLocation, deliveryLat, deliveryLng }: JobMapProps) {
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

      mapRef.current = { map, L, driverMarker: null as unknown, destMarker: null as unknown };
      renderMarkers(mapRef.current, driverName, driverLocation, deliveryLat, deliveryLng);
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

  useEffect(() => {
    if (!mapRef.current) return;
    renderMarkers(mapRef.current, driverName, driverLocation, deliveryLat, deliveryLng);
  }, [driverName, driverLocation, deliveryLat, deliveryLng]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={containerRef} style={{ width: "100%", height: 180, background: "#eef1f5" }} />
    </>
  );
}

function renderMarkers(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ref: { map: any; L: any; driverMarker: any; destMarker: any },
  driverName: string,
  driverLocation: { lat: number; lng: number },
  deliveryLat: number | null,
  deliveryLng: number | null
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
        background:#185FA5;border:2.5px solid white;
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
        font-size:10px;font-weight:600;color:white;font-family:sans-serif;
      ">${initials}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
  ref.driverMarker = L.marker([driverLocation.lat, driverLocation.lng], { icon: driverIcon })
    .addTo(map)
    .bindPopup(`<strong>${driverName}</strong><br>your driver`);

  if (ref.destMarker) ref.destMarker.remove();
  if (deliveryLat != null && deliveryLng != null) {
    points.push([deliveryLat, deliveryLng]);
    const destIcon = L.divIcon({
      className: "",
      html: `<div style="width:12px;height:12px;border-radius:50%;background:#3B6D11;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
    ref.destMarker = L.marker([deliveryLat, deliveryLng], { icon: destIcon })
      .addTo(map)
      .bindPopup("Delivery destination");
  }

  map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 15 });
}
