import type { NextRequest } from "next/server";
import { clientIp, officeAccess, officeFromToken } from "@/lib/access";

const TRIES_PER_DEVICE = 5;
const DEVICE_WINDOW_SECONDS = 15 * 60;
// Across everyone, so spreading guesses over many IPs doesn't help either.
const TRIES_PER_OFFICE = 50;
const OFFICE_WINDOW_SECONDS = 60 * 60;

// POST /api/track/[token]/unlock   Body: { code }
// Right code: sets the office's session cookie, good for 30 days on this device.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const office = await officeFromToken(token);
    if (!office) {
      return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Tracking link not found" } }, { status: 404 });
    }

    const withinLimits =
      (await officeAccess.withinRateLimit(`unlock:${token}:${clientIp(request)}`, TRIES_PER_DEVICE, DEVICE_WINDOW_SECONDS)) &&
      (await officeAccess.withinRateLimit(`unlock:${token}`, TRIES_PER_OFFICE, OFFICE_WINDOW_SECONDS));
    if (!withinLimits) {
      return Response.json(
        { data: null, error: { code: "TOO_MANY", message: "Too many tries. Wait 15 minutes, or call the lab for your code." } },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (!officeAccess.codeMatches(body.code, office.accessCodeEnc)) {
      return Response.json(
        { data: null, error: { code: "WRONG_CODE", message: "That code didn't work. Check it and try again, or call the lab." } },
        { status: 401 }
      );
    }

    const value = officeAccess.signSession({ officeId: office.id, token, version: office.accessVersion });
    const parts = [
      `${officeAccess.sessionCookieName(token)}=${value}`,
      "Path=/",
      `Max-Age=${officeAccess.SESSION_DAYS * 24 * 60 * 60}`,
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (process.env.NODE_ENV === "production") parts.push("Secure");
    return new Response(JSON.stringify({ data: { ok: true }, error: null }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Set-Cookie": parts.join("; ") },
    });
  } catch (err) {
    console.error("[POST /api/track/[token]/unlock]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } }, { status: 500 });
  }
}
