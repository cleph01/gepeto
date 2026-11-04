import { cookies } from "next/headers";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const officeAccess = require("@gepeto/db/office-access");

// The tracking link alone shows only the code screen. Everything else takes the
// office's access code, which sets a signed cookie for 30 days.

export interface OfficeForToken {
  id: string;
  labId: string;
  accessVersion: number;
  accessCodeEnc: string | null;
}

export async function officeFromToken(token: string): Promise<OfficeForToken | null> {
  return (await db("offices")
    .where("tracking_token", token)
    .first("id", "lab_id", "access_version", "access_code_enc")) ?? null;
}

export async function isUnlocked(token: string, office: OfficeForToken): Promise<boolean> {
  const jar = await cookies();
  return officeAccess.verifySession(jar.get(officeAccess.sessionCookieName(token))?.value, {
    officeId: office.id,
    token,
    version: office.accessVersion,
  });
}

/**
 * For routes behind the code. Returns the office, or the Response to send back:
 * 404 for a bad link, 401 when the code hasn't been entered.
 */
export async function requireUnlocked(token: string): Promise<OfficeForToken | Response> {
  const office = await officeFromToken(token);
  if (!office) {
    return Response.json({ data: null, error: { code: "NOT_FOUND", message: "Tracking link not found" } }, { status: 404 });
  }
  if (!(await isUnlocked(token, office))) {
    return Response.json({ data: null, error: { code: "LOCKED", message: "Enter your office's access code to continue." } }, { status: 401 });
  }
  return office;
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Counts this hit against the per-office, per-IP limit. A 429 Response when over it. */
export async function rateLimited(request: Request, token: string, action: string, max: number, windowSeconds: number): Promise<Response | null> {
  const ok = await officeAccess.withinRateLimit(`${action}:${token}:${clientIp(request)}`, max, windowSeconds);
  if (ok) return null;
  return Response.json(
    { data: null, error: { code: "TOO_MANY", message: "That's a lot of requests in a short time. Please wait a few minutes and try again." } },
    { status: 429 }
  );
}
