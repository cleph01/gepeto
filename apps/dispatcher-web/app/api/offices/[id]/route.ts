import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { OFFICE_COLUMNS, cleanEmail, ensureAccessCode, officeForLab } from "@/lib/office-access";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

// PATCH /api/offices/[id] — update office name, address, phone, contactName, or email
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);

    if (user.role !== "dispatcher") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only dispatchers can update offices" } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    const updates: Record<string, string | null> = {};
    if (body.name        !== undefined) updates.name         = body.name;
    if (body.address     !== undefined) updates.address      = body.address;
    if (body.phone       !== undefined) updates.phone        = body.phone;
    if (body.contactName !== undefined) updates.contact_name = body.contactName;
    if (body.email       !== undefined) {
      const email = cleanEmail(body.email);
      if (email === undefined) {
        return Response.json(
          { data: null, error: { code: "BAD_REQUEST", message: "That email address doesn't look right" } },
          { status: 400 }
        );
      }
      updates.email = email;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "No valid fields to update" } },
        { status: 400 }
      );
    }

    const [office] = await db("offices")
      .where({ id, lab_id: user.labId })
      .update(updates)
      .returning(OFFICE_COLUMNS);

    if (!office) {
      return Response.json(
        { data: null, error: { code: "NOT_FOUND", message: "Office not found" } },
        { status: 404 }
      );
    }

    return Response.json({ data: officeForLab(await ensureAccessCode(office)), error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[PATCH /api/offices/[id]]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to update office" } },
      { status: 500 }
    );
  }
}
