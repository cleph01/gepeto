// Formatting shared by the In progress and Delivered tabs.

export interface Item {
  description: string;
  quantity: number;
  flags: string[];
}

/** Handling notes the person signing for the box should know about ("rush" is lab-internal). */
const HANDLING: Record<string, string> = {
  fragile: "Fragile",
  temperature_sensitive: "Keep cool",
  biohazard: "Biohazard",
};

export function itemsLine(items: Item[] | null): { text: string; handling: string[] } {
  const list = items ?? [];
  const text = list
    .map((i) => (i.quantity > 1 ? `${i.description} ×${i.quantity}` : i.description))
    .filter(Boolean)
    .join(" · ");
  const handling = [...new Set(list.flatMap((i) => i.flags ?? []).map((f) => HANDLING[f]).filter(Boolean))];
  return { text, handling };
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
