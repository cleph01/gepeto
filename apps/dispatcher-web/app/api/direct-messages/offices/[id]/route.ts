import { dispatcherThreadGet, dispatcherThreadPost } from "@/lib/direct-messages";

// GET  /api/direct-messages/offices/[id]  Dispatcher only. The lab's private thread
//      with this office. With ?aboutJobId=, only the messages about that case.
// POST /api/direct-messages/offices/[id]  { body, aboutJobId? }. Only this office and the lab see it.
export const GET = dispatcherThreadGet("office");
export const POST = dispatcherThreadPost("office");
