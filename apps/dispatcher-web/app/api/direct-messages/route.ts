import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { THREAD_SQL, forbidden, threadKey, unreadForDispatcher } from "@/lib/direct-messages";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/direct-messages
// Dispatcher only. The Messages page's list: every office and driver in the lab,
// each with its private thread's newest message, unread count, and cases in
// progress (for the About picker).
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") return forbidden();

    const [offices, drivers, latest, unread, cases] = await Promise.all([
      db("offices").where("lab_id", user.labId).orderBy("name", "asc").select("id", "name"),
      db("drivers").where("lab_id", user.labId).orderBy("name", "asc").select("id", "name"),
      // Newest message per thread.
      db
        .from(
          db("direct_messages as m")
            .where("m.lab_id", user.labId)
            .select(db.raw(`${THREAD_SQL} as thread`), "m.sender_role", "m.body", "m.created_at")
            .as("t")
        )
        .distinctOn("thread")
        .orderBy([{ column: "thread" }, { column: "created_at", order: "desc" }])
        .select("thread", "sender_role", "body", "created_at"),
      unreadForDispatcher(user.id, user.labId).groupByRaw(THREAD_SQL).select(db.raw(`${THREAD_SQL} as thread`)).count("* as count"),
      db("jobs")
        .where("lab_id", user.labId)
        .whereNot("status", "delivered")
        .orderBy("created_at", "desc")
        .select("id", "office_id", "driver_id", "case_id"),
    ]);

    type Latest = { thread: string; senderRole: string; body: string; createdAt: string };
    const latestBy = new Map((latest as Latest[]).map((m) => [m.thread, m]));
    const unreadBy = new Map((unread as { thread: string; count: string | number }[]).map((r) => [r.thread, Number(r.count)]));
    const casesBy = new Map<string, { id: string; caseId: string }[]>();
    const addCase = (key: string, c: { id: string; caseId: string }) => {
      const list = casesBy.get(key) ?? [];
      list.push({ id: c.id, caseId: c.caseId });
      casesBy.set(key, list);
    };
    for (const c of cases as { id: string; officeId: string | null; driverId: string | null; caseId: string }[]) {
      if (c.officeId) addCase(threadKey("office", c.officeId), c);
      if (c.driverId) addCase(threadKey("driver", c.driverId), c);
    }

    const row = (kind: "office" | "driver") => (p: { id: string; name: string }) => {
      const key = threadKey(kind, p.id);
      const last = latestBy.get(key);
      return {
        kind,
        id: p.id,
        name: p.name,
        lastMessage: last ? { senderRole: last.senderRole, body: last.body, createdAt: last.createdAt } : null,
        unread: unreadBy.get(key) ?? 0,
        activeCases: casesBy.get(key) ?? [],
      };
    };
    const data = [
      ...(offices as { id: string; name: string }[]).map(row("office")),
      ...(drivers as { id: string; name: string }[]).map(row("driver")),
    ];

    return Response.json({ data, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/direct-messages]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch conversations" } }, { status: 500 });
  }
}
