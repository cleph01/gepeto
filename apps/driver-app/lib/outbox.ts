import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import type { Job, JobStatus } from '@gepeto/types';
import { apiPatch, apiPost } from './api';
import { uploadPodPhotoBytes } from './pod-photo';
import type { ReturnCase, ReturnDraft } from './returns';

// The offline queue ("outbox"). Job steps, deliveries (with their photo) and
// returns are saved on the phone first and sent in order, so a driver with no
// signal can keep working. Each item stays until the server confirms it, and
// the screens show it as "Not sent yet" meanwhile. Accepting or rejecting a
// job and chat messages are not queued: those stay live.
//
// The server side: occurredAt records when the driver tapped, expectedFrom
// refuses a step if dispatch changed the job meanwhile, and clientId stops a
// return from being logged twice (see dispatcher-web lib/offline-sync.ts).

type Base = {
  id: string;
  /** When the driver tapped, ISO. */
  occurredAt: string;
  /** Why the server refused it. A refused item is never retried; the driver dismisses it. */
  failed?: string;
};

export type JobStepItem = Base & {
  kind: 'job_status';
  jobId: string;
  caseId: string;
  officeName: string | null;
  from: JobStatus;
  to: JobStatus;
  proof?: { recipientName: string; timestamp: string };
  /** A delivery photo saved in the app's folder; uploadedPath once it's on the server. */
  photo?: { file: string; uploadedPath?: string };
};

export type ReturnLogItem = Base & {
  kind: 'return_log';
  officeId: string;
  officeName: string | null;
  draft: ReturnDraft;
  pickedUpDuringJobId?: string;
};

export type ReturnsDropItem = Base & { kind: 'returns_drop'; caseCount: number };

export type OutboxItem = JobStepItem | ReturnLogItem | ReturnsDropItem;

/** What happened when an item was sent. */
export type SendResult = { ok: true } | { ok: false; offline: true } | { ok: false; offline: false; message: string };

const storageKey = (driverId: string) => `gepeto.outbox.v1.${driverId}`;

export async function loadOutbox(driverId: string): Promise<OutboxItem[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(driverId));
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

export async function saveOutbox(driverId: string, items: OutboxItem[]): Promise<void> {
  await AsyncStorage.setItem(storageKey(driverId), JSON.stringify(items));
}

/** A random id (UUID v4 shape), so the server can tell a resend from a new update. */
export function newId(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.random() * 4) | 8];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}

// ── Photos ───────────────────────────────────────────────────────────────────

// The camera's file sits in a cache iOS may clear, so a queued photo is copied
// here until it's uploaded.
const photoDir = () => new Directory(Paths.document, 'outbox-photos');

/** Copies a just-taken photo into the app's folder. Returns its file URI. */
export function keepPhoto(cacheUri: string, id: string): string {
  const dir = photoDir();
  dir.create({ idempotent: true, intermediates: true });
  const dest = new File(dir, `${id}.jpg`);
  if (dest.exists) dest.delete();
  new File(cacheUri).copy(dest);
  return dest.uri;
}

/** Deletes a kept photo once nothing in the queue needs it. */
export function dropPhoto(uri: string, remaining: OutboxItem[]) {
  if (remaining.some((i) => i.kind === 'job_status' && i.photo?.file === uri)) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone.
  }
}

// ── Sending ──────────────────────────────────────────────────────────────────

type ApiReply<T> = { data: T | null; error: { code: string; message: string } | null };

/** A server reply to a send: saved, refused (with why), or try again later. */
function judge<T>(res: ApiReply<T>, refusedMessage: (code: string, message: string) => string): SendResult {
  if (res.data) return { ok: true };
  const code = res.error?.code ?? '';
  // The server had a problem, not the update: keep it and try again.
  if (!code || code === 'INTERNAL_ERROR') return { ok: false, offline: true };
  return { ok: false, offline: false, message: refusedMessage(code, res.error?.message ?? "It wasn't saved.") };
}

/**
 * Sends one item. `onPhotoUploaded` saves a photo's server path as soon as it
 * has one, so a retry (or the other jobs in a group delivery) doesn't upload it again.
 */
export async function sendItem(item: OutboxItem, onPhotoUploaded: (file: string, path: string) => void): Promise<SendResult> {
  try {
    if (item.kind === 'job_status') {
      let photoPath = item.photo?.uploadedPath;
      if (item.photo && !photoPath) {
        const file = new File(item.photo.file);
        if (!file.exists) {
          return { ok: false, offline: false, message: 'The delivery photo was lost on the phone. Open the job and deliver it again.' };
        }
        const uploaded = await uploadPodPhotoBytes(await file.bytes());
        if ('offline' in uploaded) return { ok: false, offline: true };
        if ('error' in uploaded) return { ok: false, offline: false, message: uploaded.error };
        photoPath = uploaded.path;
        onPhotoUploaded(item.photo.file, photoPath);
      }
      const res = await apiPatch<Job>(`/api/jobs/${item.jobId}/status`, {
        status: item.to,
        expectedFrom: item.from,
        occurredAt: item.occurredAt,
        ...(item.to === 'delivered' ? { proofOfDelivery: { ...item.proof, photoPath } } : {}),
      });
      return judge(res, (code, message) =>
        code === 'NOT_FOUND' ? "This job isn't yours anymore, so this update wasn't saved." : message
      );
    }
    if (item.kind === 'return_log') {
      const res = await apiPost<ReturnCase>('/api/returns', {
        clientId: item.id,
        occurredAt: item.occurredAt,
        officeId: item.officeId,
        caseCount: item.draft.caseCount,
        caseNumbers: item.draft.caseNumbers,
        note: item.draft.note,
        pickedUpDuringJobId: item.pickedUpDuringJobId,
      });
      return judge(res, (_code, message) => message);
    }
    const res = await apiPost<{ dropped: number }>('/api/returns/drop', { occurredAt: item.occurredAt });
    return judge(res, (_code, message) => message);
  } catch {
    // No signal, timed out, or a reply that wasn't ours (a network error page).
    return { ok: false, offline: true };
  }
}

// ── How the screens describe items ───────────────────────────────────────────

const STEP_LABEL: Partial<Record<JobStatus, string>> = {
  picked_up: 'Picked up',
  in_transit: 'On the way',
  arrived: 'Arrived',
  delivered: 'Delivered',
};

/** One line for the queue list: "FAKE LAB-0001 · Delivered". */
export function describeItem(item: OutboxItem): string {
  if (item.kind === 'job_status') return `${item.caseId} · ${STEP_LABEL[item.to] ?? item.to}`;
  if (item.kind === 'return_log') {
    const n = item.draft.caseCount;
    return `Pickup · ${item.officeName ?? 'Office'} · ${n} case${n === 1 ? '' : 's'}`;
  }
  return `Dropped at lab · ${item.caseCount} case${item.caseCount === 1 ? '' : 's'}`;
}

/** The job as the driver last left it: its server row with any queued steps applied. */
export function withQueuedSteps<T extends Job>(job: T, items: OutboxItem[]): T {
  let out = job;
  for (const i of items) {
    if (i.kind !== 'job_status' || i.jobId !== job.id || i.failed) continue;
    out = { ...out, status: i.to, ...(i.to === 'delivered' ? { deliveredAt: i.occurredAt } : {}) };
  }
  return out;
}
