import { randomUUID } from "crypto";
import { supabaseAdmin } from "./supabase";

// Proof-of-delivery photos in the private Supabase Storage bucket "pod-photos"
// (created by migration 20261102000000_pod_photos). Objects are
// <lab_id>/<uuid>.jpg and are only ever shown through short-lived signed URLs.
// The office portal has its own copy of signPodPhoto (lib/pod-photos.ts there).

const BUCKET = "pod-photos";
export const MAX_POD_PHOTO_BYTES = 5 * 1024 * 1024;
export const RETENTION_CHOICES = [90, 180, 365, 730] as const;
export const DEFAULT_RETENTION_DAYS = 90;

// A driver can see their own delivery photo for this long, enough to answer
// "we never got that". After that it's the lab's record: dispatch still has it.
// The driver app's wording repeats this number (components/delivered-photo.tsx).
export const DRIVER_PHOTO_DAYS = 7;

export function driverPhotoCutoff(now = Date.now()): Date {
  return new Date(now - DRIVER_PHOTO_DAYS * 86400000);
}

export function podPhotoSettings(settings: Record<string, unknown> | null | undefined) {
  const s = settings ?? {};
  const days = Number(s.podPhotoRetentionDays);
  return {
    required: s.podPhotoRequired === true,
    retentionDays: (RETENTION_CHOICES as readonly number[]).includes(days) ? days : DEFAULT_RETENTION_DAYS,
  };
}

// A path the client may attach to its own lab's delivery: one we could have issued.
export function isLabPhotoPath(labId: string, path: unknown): path is string {
  return typeof path === "string" && new RegExp(`^${labId}/[0-9a-f-]{36}\\.jpg$`).test(path);
}

function bucket() {
  return supabaseAdmin.storage.from(BUCKET);
}

export async function uploadPodPhoto(labId: string, bytes: ArrayBuffer): Promise<string> {
  const path = `${labId}/${randomUUID()}.jpg`;
  const { error } = await bucket().upload(path, bytes, { contentType: "image/jpeg" });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);
  return path;
}

export async function signPodPhoto(path: string, expiresIn = 300): Promise<string | null> {
  const { data } = await bucket().createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function deletePodPhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await bucket().remove(paths);
  if (error) throw new Error(`Photo delete failed: ${error.message}`);
}
