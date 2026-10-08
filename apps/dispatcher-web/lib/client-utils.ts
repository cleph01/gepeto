"use client";

// Base URL for office-portal tracking links. Prefer an explicit env var
// (set this for real production domains, e.g. https://track.gepeto.com/t) —
// falls back to the current hostname on port 3001, so links copied while
// viewing dispatcher-web over Tailscale (http://100.101.195.96:3000) still
// point somewhere the recipient can actually reach, instead of a hardcoded
// localhost that only works on the dispatcher's own machine.
export function getTrackingBase(): string {
  if (process.env.NEXT_PUBLIC_TRACKING_BASE_URL) {
    return process.env.NEXT_PUBLIC_TRACKING_BASE_URL;
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001/t`;
  }
  return "http://localhost:3001/t";
}

export function trackingUrl(token: string): string {
  return `${getTrackingBase()}/${token}`;
}

/**
 * Copies text to the clipboard, working even in insecure contexts
 * (e.g. http://<tailscale-ip>) where navigator.clipboard doesn't exist at
 * all (it's only defined in secure contexts — https, or http://localhost).
 * Falls back to the legacy textarea + execCommand('copy') approach there.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
