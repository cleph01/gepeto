import type { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { MAX_POD_PHOTO_BYTES, uploadPodPhoto } from "@/lib/pod-photos";

// POST /api/driver/pod-photo
// Body: the JPEG itself (Content-Type: image/jpeg; what the driver app sends),
// or a multipart form with one field "photo". The app resizes it first.
// Returns { path }, which the app then sends as proofOfDelivery.photoPath
// when it marks the job delivered. Uploading alone attaches it to nothing.
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (user.role !== "driver") {
      return Response.json(
        { data: null, error: { code: "FORBIDDEN", message: "Only drivers can upload delivery photos" } },
        { status: 403 }
      );
    }

    const photo = (request.headers.get("content-type") ?? "").startsWith("image/jpeg")
      ? await request.blob()
      : (await request.formData()).get("photo");
    if (!(photo instanceof Blob) || photo.size === 0) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "Attach a photo." } },
        { status: 400 }
      );
    }
    if (photo.size > MAX_POD_PHOTO_BYTES) {
      return Response.json(
        { data: null, error: { code: "TOO_LARGE", message: "That photo is too large. Retake it and try again." } },
        { status: 413 }
      );
    }
    const bytes = await photo.arrayBuffer();
    // JPEG files start FF D8 FF; refuse anything else whatever it claims to be.
    const head = new Uint8Array(bytes, 0, 3);
    if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
      return Response.json(
        { data: null, error: { code: "BAD_REQUEST", message: "Photos must be JPEG." } },
        { status: 400 }
      );
    }

    const path = await uploadPodPhoto(user.labId, bytes);
    return Response.json({ data: { path }, error: null });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/driver/pod-photo]", err);
    return Response.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Couldn't save the photo. Try again." } },
      { status: 500 }
    );
  }
}
