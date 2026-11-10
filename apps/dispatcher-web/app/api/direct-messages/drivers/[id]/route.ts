import { dispatcherThreadGet, dispatcherThreadPost } from "@/lib/direct-messages";

// GET  /api/direct-messages/drivers/[id]  Dispatcher only. The lab's private thread
//      with this driver. With ?aboutJobId=, only the messages about that case.
// POST /api/direct-messages/drivers/[id]  { body, aboutJobId? }. Only this driver and the lab see it;
//      the office never does.
export const GET = dispatcherThreadGet("driver");
export const POST = dispatcherThreadPost("driver");
