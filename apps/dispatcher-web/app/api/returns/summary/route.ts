import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/returns/summary  (dispatcher)
// Open returns for the sidebar badge and dashboard tile: how many returns and
// cases are still in a driver's car vs. waiting at the lab for check-in.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "dispatcher") {
      return Response.json({ data: null, error: { code: "FORBIDDEN", message: "Dispatchers only" } }, { status: 403 });
    }
    const rows = await db("returns")
      .where({ lab_id: user.labId })
      .whereIn("status", ["with_driver", "at_lab"])
      .groupBy("status")
      .select("status")
      .count("* as returns")
      .sum("case_count as cases");

    const summary = { withDriver: 0, withDriverCases: 0, atLab: 0, atLabCases: 0 };
    for (const r of rows as { status: string; returns: string; cases: string }[]) {
      if (r.status === "with_driver") { summary.withDriver = Number(r.returns); summary.withDriverCases = Number(r.cases); }
      if (r.status === "at_lab") { summary.atLab = Number(r.returns); summary.atLabCases = Number(r.cases); }
    }
    return Response.json({ data: summary, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/returns/summary]", err);
    return Response.json({ data: null, error: { code: "INTERNAL_ERROR", message: "Failed to load return summary" } }, { status: 500 });
  }
}
