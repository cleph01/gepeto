import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { OFFICE_COLUMNS, cleanEmail, ensureAccessCode, officeAccess, officeForLab } from "@/lib/office-access";
import { randomUUID } from "crypto";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// GET /api/offices — list all offices for the lab
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can view offices" } },
        { status: 403 }
      );
    }

    const offices = await db("offices")
      .where("lab_id", user.labId)
      .orderBy("name", "asc")
      .select(OFFICE_COLUMNS);
    const withCodes = await Promise.all(offices.map(ensureAccessCode));
    return Response.json({ data: withCodes.map(officeForLab), error: null });
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
    const email = cleanEmail(body.email ?? null);

    if (!name || !address || !phone || !contactName) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "name, address, phone, and contactName are required" } },
        { status: 400 }
      );
    }

    if (email === undefined) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "That email address doesn't look right" } },
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
        email,
        tracking_token: randomUUID(),
        access_code_enc: officeAccess.encryptCode(officeAccess.generateCode()),
      })
      .returning(OFFICE_COLUMNS);

    return Response.json({ data: officeForLab(office), error: null }, { status: 201 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/offices]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to create office" } },
      { status: 500 }
    );
  }
}
