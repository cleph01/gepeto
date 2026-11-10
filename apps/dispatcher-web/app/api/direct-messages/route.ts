import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { forbidden, unreadOfficeMessages } from "@/lib/direct-messages";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/direct-messages
// Dispatcher only. The Messages page's list: every office in the lab, with its
// private thread's newest message, unread count, and cases in progress (for
// the About picker).
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") return forbidden();

    const [offices, latest, unread, cases] = await Promise.all([
      db("offices").where("lab_id", user.labId).orderBy("name", "asc").select("id", "name"),
      db("direct_messages")
        .where("lab_id", user.labId)
        .whereNotNull("office_id")
        .distinctOn("office_id")
        .orderBy([{ column: "office_id" }, { column: "created_at", order: "desc" }])
        .select("office_id", "sender_role", "body", "created_at"),
      unreadOfficeMessages(user.id, user.labId).groupBy("m.office_id").select("m.office_id").count("* as count"),
      db("jobs")
        .where("lab_id", user.labId)
        .whereNot("status", "delivered")
        .orderBy("created_at", "desc")
        .select("id", "office_id", "case_id"),
    ]);

    type Latest = { officeId: string; senderRole: string; body: string; createdAt: string };
    const latestBy = new Map((latest as Latest[]).map((m) => [m.officeId, m]));
    const unreadBy = new Map((unread as { officeId: string; count: string | number }[]).map((r) => [r.officeId, Number(r.count)]));
    const casesBy = new Map<string, { id: string; caseId: string }[]>();
    for (const c of cases as { id: string; officeId: string; caseId: string }[]) {
      const list = casesBy.get(c.officeId) ?? [];
      list.push({ id: c.id, caseId: c.caseId });
      casesBy.set(c.officeId, list);
    }

    const data = (offices as { id: string; name: string }[]).map((o) => {
      const last = latestBy.get(o.id);
      return {
        kind: "office" as const,
        id: o.id,
        name: o.name,
        lastMessage: last ? { senderRole: last.senderRole, body: last.body, createdAt: last.createdAt } : null,
        unread: unreadBy.get(o.id) ?? 0,
        activeCases: casesBy.get(o.id) ?? [],
      };
    });

    return Response.json({ data, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/direct-messages]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch conversations" } }, { status: 500 });
  }
}
