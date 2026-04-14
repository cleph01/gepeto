/**
 * Geocodes a street address using the Nominatim API (OpenStreetMap).
 * Free, no API key required. Rate limit: 1 req/sec — acceptable for job creation.
 * Returns null if the address cannot be resolved.
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      headers: {
        // Nominatim requires a descriptive User-Agent
        "User-Agent": "Gepeto/1.0 (dental-lab-logistics)",
      },
    });

    if (!res.ok) return null;

    const data = await res.json() as { lat: string; lon: string }[];
    if (!data.length) return null;

    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}
