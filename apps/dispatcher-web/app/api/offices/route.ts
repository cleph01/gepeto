import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { randomUUID } from "crypto";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/offices — list all offices for the lab
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const offices = await db("offices")
      .where("lab_id", user.labId)
      .orderBy("name", "asc")
      .select("id", "name", "address", "phone", "contact_name", "tracking_token");
    return Response.json({ data: offices, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[GET /api/offices]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to fetch offices" } },
      { status: 500 }
    );
  }
}

// POST /api/offices — create a new office (dispatcher only)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can add offices" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, address, phone, contactName } = body;

    if (!name || !address || !phone || !contactName) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "name, address, phone, and contactName are required" } },
        { status: 400 }
      );
    }

    const [office] = await db("offices")
      .insert({
        lab_id:         user.labId,
        name,
        address,
        phone,
        contact_name:   contactName,
        tracking_token: randomUUID(),
      })
      .returning("*");

    return Response.json({ data: office, error: null }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/offices]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to create office" } },
      { status: 500 }
    );
  }
}
