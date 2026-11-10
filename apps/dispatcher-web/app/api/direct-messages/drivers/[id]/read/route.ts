import { dispatcherThreadRead } from "@/lib/direct-messages";

// POST /api/direct-messages/drivers/[id]/read
// Body: { upTo }, the createdAt of the newest message shown.
export const POST = dispatcherThreadRead("driver");
