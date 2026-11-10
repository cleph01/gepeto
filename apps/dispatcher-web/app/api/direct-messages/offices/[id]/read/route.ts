import { dispatcherThreadRead } from "@/lib/direct-messages";

// POST /api/direct-messages/offices/[id]/read
// Body: { upTo }, the createdAt of the newest message shown. Same rules as
// /api/jobs/[id]/messages/read: the client's time, never moving backwards.
export const POST = dispatcherThreadRead("office");
