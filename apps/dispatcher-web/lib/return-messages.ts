// Shared rules for messages on a return (see the return_messages migration).
import { notifyDriverReturnMessage, notifyLab, notifyOffices } from "@/lib/realtime";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require("@gepeto/db");

export const MAX_MESSAGE_LENGTH = 2000;

/** Still moving, so the driver who has it can take part. */
export const OPEN_FOR_DRIVER = ["requested", "with_driver", "at_lab"];

type Viewer = { role: string; labId: string; driverId?: string | null };

/** The return if this person may see its messages: anyone in the lab, or the driver who has it. */
export function returnForViewer(user: Viewer, id: string) {
  return db("returns")
    .where(user.role === "driver"
      ? { id, lab_id: user.labId, driver_id: user.driverId }
      : { id, lab_id: user.labId })
    .first();
}

/** Why a message can't be sent right now, if so. Checked-in returns stay open to the lab and office, for follow-ups. */
export function whyClosed(status: string, role: string): string | null {
  if (status === "cancelled") return "This pickup was cancelled, so its messages are closed.";
  if (role === "driver" && !OPEN_FOR_DRIVER.includes(status)) return "This return is checked in, so its messages are closed.";
  return null;
}

/** Everyone in the conversation refreshes. Payloads carry only ids, and each side re-reads through the API. */
export async function announceReturnMessage(ret: { id: string; labId: string; officeId: string; driverId: string | null }) {
  await notifyLab(ret.labId, "return_message", { returnId: ret.id });
  await notifyOffices([ret.officeId], "messages");
  if (ret.driverId) await notifyDriverReturnMessage(ret.driverId, { returnId: ret.id });
}
