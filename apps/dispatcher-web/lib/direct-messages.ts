import type { NextRequest } from "next/server";
import type { AuthUser } from "./auth";
import { requireAuth } from "./auth";
import { notifyDriverDirectMessage, notifyLab, notifyOffices } from "./realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// Private threads between dispatch and one office or one driver (see the
// direct_messages migration). There is no private office-driver thread.
//
// A thread is named by who it's with: "office:<id>" or "driver:<id>". That
// string keys direct_message_reads and the dispatcher's unread counts.

export const MAX_DIRECT_MESSAGE_LENGTH = 2000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

export type PartyKind = "office" | "driver";
/** The office or driver on the other end of a private thread. */
export type Party = { kind: PartyKind; id: string; name: string };

export const threadKey = (kind: PartyKind, id: string) => `${kind}:${id}`;
export const officeThread = (officeId: string) => threadKey("office", officeId);
export const driverThread = (driverId: string) => threadKey("driver", driverId);

const COLUMN = { office: "office_id", driver: "driver_id" } as const;

const json = (status: number, code: string, message: string) =>
  Response.json({ data: null, error: { code, message } }, { status });

export const forbidden = () => json(403, "FORBIDDEN", "Dispatchers only");
export const driversOnly = () => json(403, "FORBIDDEN", "Drivers only");
export const officeNotFound = () => json(404, "NOT_FOUND", "Office not found");
export const driverNotFound = () => json(404, "NOT_FOUND", "Driver not found");
const notFound = (kind: PartyKind) => (kind === "office" ? officeNotFound() : driverNotFound());

/** The office or driver if it's in this dispatcher's lab, otherwise null. */
export async function partyForDispatcher(user: AuthUser, kind: PartyKind, id: string): Promise<Party | null> {
  if (user.role !== "dispatcher" || !isUuid(id)) return null;
  const table = kind === "office" ? "offices" : "drivers";
  const row = await db(table).where({ id, lab_id: user.labId }).first("id", "name");
  return row ? { kind, id: row.id, name: row.name } : null;
}

/** The office if it's in this dispatcher's lab, otherwise null. */
export async function officeForDispatcher(user: AuthUser, officeId: string) {
  return partyForDispatcher(user, "office", officeId);
}

/** A thread's messages, oldest first, with the case each one is about. */
export function threadMessages(party: { kind: PartyKind; id: string }) {
  const q = db("direct_messages as m");
  if (party.kind === "office") {
    // Only name the case while it's still this office's: a case moved to
    // another office shouldn't carry its number into this thread.
    q.joinRaw("LEFT JOIN jobs j ON j.id = m.about_job_id AND j.office_id = m.office_id");
  } else {
    // A driver's case can move to someone else; the number they were sent
    // about stays, since they already saw it.
    q.joinRaw("LEFT JOIN jobs j ON j.id = m.about_job_id AND j.lab_id = m.lab_id");
  }
  return q
    .where(`m.${COLUMN[party.kind]}`, party.id)
    .orderBy("m.created_at", "asc")
    .select("m.id", "m.sender_role", "m.body", "m.created_at", "m.about_job_id", "j.case_id as about_case_id");
}

/** Office and driver messages this dispatcher hasn't seen, across the lab. Each row has `thread`. */
export function unreadForDispatcher(userId: string, labId: string) {
  return db("direct_messages as m")
    .joinRaw(
      `LEFT JOIN direct_message_reads rd
         ON rd.user_id = ?
        AND rd.thread = CASE WHEN m.office_id IS NOT NULL THEN 'office:' || m.office_id::text ELSE 'driver:' || m.driver_id::text END`,
      [userId]
    )
    .where("m.lab_id", labId)
    .whereIn("m.sender_role", ["office", "driver"])
    // ms truncation: see /api/messages/unread
    .whereRaw("(rd.last_read_at IS NULL OR date_trunc('milliseconds', m.created_at) > rd.last_read_at)");
}

/** SQL for a row's thread key, to select or group by. */
export const THREAD_SQL =
  "CASE WHEN m.office_id IS NOT NULL THEN 'office:' || m.office_id::text ELSE 'driver:' || m.driver_id::text END";

/** Messages from dispatch in this driver's thread that the driver hasn't seen. */
export function unreadForDriver(userId: string, driverId: string) {
  return db("direct_messages as m")
    .joinRaw("LEFT JOIN direct_message_reads rd ON rd.user_id = ? AND rd.thread = ?", [userId, driverThread(driverId)])
    .where("m.driver_id", driverId)
    .where("m.sender_role", "dispatcher")
    .whereRaw("(rd.last_read_at IS NULL OR date_trunc('milliseconds', m.created_at) > rd.last_read_at)");
}

/** Validates a message body; returns the trimmed text or an error Response. */
export function checkBody(body: unknown): string | Response {
  const trimmed = typeof body === "string" ? body.trim() : "";
  if (!trimmed) return json(400, "BAD_REQUEST", "Message body is required");
  if (trimmed.length > MAX_DIRECT_MESSAGE_LENGTH) return json(400, "BAD_REQUEST", "Message is too long");
  return trimmed;
}

/**
 * The case a message may be about, or an error Response. Offices: the case has
 * to be theirs. Drivers: it has to be assigned to them.
 */
export async function checkAbout(
  labId: string,
  party: { kind: PartyKind; id: string },
  aboutJobId: unknown
): Promise<{ id: string; caseId: string } | null | Response> {
  if (aboutJobId == null || aboutJobId === "") return null;
  const about = isUuid(aboutJobId)
    ? await db("jobs").where({ id: aboutJobId, lab_id: labId, [COLUMN[party.kind]]: party.id }).first("id", "case_id")
    : null;
  if (!about) {
    return json(400, "BAD_REQUEST", party.kind === "office" ? "That case isn't this office's" : "That case isn't this driver's");
  }
  return about;
}

/** Saves a message in a thread and tells everyone who can see it. */
export async function sendDirectMessage(opts: {
  labId: string;
  party: { kind: PartyKind; id: string };
  senderRole: "dispatcher" | "driver";
  senderId: string;
  body: string;
  about: { id: string; caseId: string } | null;
}) {
  const { labId, party, senderRole, senderId, body, about } = opts;
  const [message] = await db("direct_messages")
    .insert({
      lab_id: labId,
      [COLUMN[party.kind]]: party.id,
      sender_role: senderRole,
      sender_id: senderId,
      about_job_id: about?.id ?? null,
      body,
    })
    .returning(["id", "sender_role", "body", "created_at", "about_job_id"]);

  const thread = threadKey(party.kind, party.id);
  // officeId stays for any dispatcher page still running the previous version.
  await notifyLab(labId, "direct_message", party.kind === "office" ? { thread, officeId: party.id } : { thread });
  if (party.kind === "office") await notifyOffices([party.id], "messages");
  else await notifyDriverDirectMessage(party.id);

  return { ...message, aboutCaseId: about?.caseId ?? null };
}

/** Records that this person has read a thread up to `upTo` (never moving backwards). */
export async function markThreadRead(userId: string, thread: string, upTo: unknown): Promise<Response> {
  const upToDate = upTo ? new Date(upTo as string) : null;
  if (!upToDate || isNaN(upToDate.getTime())) return json(400, "BAD_REQUEST", "upTo must be a valid timestamp");
  await db.raw(
    `INSERT INTO direct_message_reads (user_id, thread, last_read_at)
     VALUES (?, ?, ?)
     ON CONFLICT (user_id, thread)
     DO UPDATE SET last_read_at = GREATEST(direct_message_reads.last_read_at, EXCLUDED.last_read_at)`,
    [userId, thread, upToDate.toISOString()]
  );
  return Response.json({ data: { ok: true }, error: null });
}

const internal = (label: string, err: unknown, message: string) => {
  if (err instanceof Response) return err;
  console.error(label, err);
  return json(500, "INTERNAL_ERROR", message);
};

// ── Dispatcher routes, shared by /offices/[id] and /drivers/[id] ──────────────

type Params = { params: Promise<{ id: string }> };

/** GET: the thread. With ?aboutJobId=, only messages about that case (a job's Messages window). */
export function dispatcherThreadGet(kind: PartyKind) {
  return async (request: NextRequest, { params }: Params) => {
    try {
      const user = await requireAuth(request);
      const party = await partyForDispatcher(user, kind, (await params).id);
      if (!party) return notFound(kind);
      const query = threadMessages(party);
      const aboutJobId = request.nextUrl.searchParams.get("aboutJobId");
      if (aboutJobId) {
        if (!isUuid(aboutJobId)) return Response.json({ data: [], error: null });
        query.where("m.about_job_id", aboutJobId);
      }
      return Response.json({ data: await query, error: null });
    } catch (err) {
      return internal(`[GET /api/direct-messages/${kind}s/[id]]`, err, "Failed to fetch messages");
    }
  };
}

/** POST { body, aboutJobId? }: only this office or driver and the lab see it. */
export function dispatcherThreadPost(kind: PartyKind) {
  return async (request: NextRequest, { params }: Params) => {
    try {
      const user = await requireAuth(request);
      const party = await partyForDispatcher(user, kind, (await params).id);
      if (!party) return notFound(kind);
      const { body, aboutJobId } = await request.json().catch(() => ({}));
      const text = checkBody(body);
      if (text instanceof Response) return text;
      const about = await checkAbout(user.labId, party, aboutJobId);
      if (about instanceof Response) return about;
      const data = await sendDirectMessage({ labId: user.labId, party, senderRole: "dispatcher", senderId: user.id, body: text, about });
      return Response.json({ data, error: null }, { status: 201 });
    } catch (err) {
      return internal(`[POST /api/direct-messages/${kind}s/[id]]`, err, "Failed to send message");
    }
  };
}

/** POST { upTo }: the createdAt of the newest message shown. */
export function dispatcherThreadRead(kind: PartyKind) {
  return async (request: NextRequest, { params }: Params) => {
    try {
      const user = await requireAuth(request);
      const party = await partyForDispatcher(user, kind, (await params).id);
      if (!party) return notFound(kind);
      const { upTo } = await request.json().catch(() => ({}));
      return await markThreadRead(user.id, threadKey(kind, party.id), upTo);
    } catch (err) {
      return internal(`[POST /api/direct-messages/${kind}s/[id]/read]`, err, "Failed to mark messages read");
    }
  };
}
