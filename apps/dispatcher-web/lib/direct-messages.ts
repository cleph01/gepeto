import type { AuthUser } from "./auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// Private threads between dispatch and one office (see the direct_messages
// migration). Drivers get theirs once the driver app has a screen for it; until
// then every route here is office-only, so nothing is sent that can't be read.

export const MAX_DIRECT_MESSAGE_LENGTH = 2000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

export const officeThread = (officeId: string) => `office:${officeId}`;

export const forbidden = () =>
  Response.json({ data: null, error: { code: "FORBIDDEN", message: "Dispatchers only" } }, { status: 403 });
export const officeNotFound = () =>
  Response.json({ data: null, error: { code: "NOT_FOUND", message: "Office not found" } }, { status: 404 });

/** The office if it's in this dispatcher's lab, otherwise null. */
export async function officeForDispatcher(user: AuthUser, officeId: string) {
  if (user.role !== "dispatcher" || !isUuid(officeId)) return null;
  return (await db("offices").where({ id: officeId, lab_id: user.labId }).first("id", "name", "lab_id")) ?? null;
}

/** A thread's messages, oldest first, with the case each one is about. */
export function threadMessages(officeId: string) {
  return db("direct_messages as m")
    // Only name the case while it's still this office's: a case moved to
    // another office shouldn't carry its number into this thread.
    .joinRaw("LEFT JOIN jobs j ON j.id = m.about_job_id AND j.office_id = m.office_id")
    .where("m.office_id", officeId)
    .orderBy("m.created_at", "asc")
    .select("m.id", "m.sender_role", "m.body", "m.created_at", "m.about_job_id", "j.case_id as about_case_id");
}

/** Office messages this dispatcher hasn't seen, across the lab. */
export function unreadOfficeMessages(userId: string, labId: string) {
  return db("direct_messages as m")
    .joinRaw("LEFT JOIN direct_message_reads rd ON rd.thread = 'office:' || m.office_id::text AND rd.user_id = ?", [userId])
    .where("m.lab_id", labId)
    .whereNotNull("m.office_id")
    .where("m.sender_role", "office")
    // ms truncation: see /api/messages/unread
    .whereRaw("(rd.last_read_at IS NULL OR date_trunc('milliseconds', m.created_at) > rd.last_read_at)");
}
