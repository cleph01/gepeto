import { apiGet, apiPost } from '@/lib/api';

// Returning cases: what a driver picks up at an office to bring back to the
// lab. Logged through dispatcher-web (/api/returns); see the returns migration.
// An office can also request a pickup ("requested"); dispatch assigns it to a
// driver, and the driver's logged pickup at that office fulfills it.

export type ReturnStatus = 'requested' | 'with_driver' | 'at_lab' | 'checked_in' | 'cancelled';

export type ReturnCase = {
  id: string;
  number: number;
  status: ReturnStatus;
  officeId: string;
  officeName: string | null;
  caseCount: number;
  caseNumbers: string[];
  note: string | null;
  pickedUpAt: string | null;
  droppedAt: string | null;
  requestedAt: string | null;
  readyAt: string | null;
  checkedInAt: string | null;
};

/** What the "Bringing anything back?" block collects. */
export type ReturnDraft = { bringing: boolean; caseCount: number; caseNumbers: string[]; note: string };

export const EMPTY_RETURN: ReturnDraft = { bringing: false, caseCount: 1, caseNumbers: [], note: '' };

export const returnLabel = (r: Pick<ReturnCase, 'number'>) => `RET-${r.number}`;

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: 'Pickup waiting at the office',
  cancelled: 'Cancelled',
  with_driver: 'In your car',
  at_lab: 'At lab · waiting for check-in',
  checked_in: 'Checked in',
};

/** The return form, pre-filled from an office's pickup request. */
export const draftForPickup = (r: ReturnCase): ReturnDraft => ({
  bringing: true,
  caseCount: r.caseCount,
  caseNumbers: r.caseNumbers,
  note: '',
});

/** "Ready now" / "Ready after 3:30 PM" for a pickup request. */
export function readyLabel(r: Pick<ReturnCase, 'readyAt'>): string {
  if (!r.readyAt || new Date(r.readyAt) <= new Date()) return 'Ready now';
  return `Ready after ${new Date(r.readyAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/** This driver's open pickup request at an office, if any. */
export async function findPickupRequest(officeId: string): Promise<ReturnCase | null> {
  try {
    const res = await apiGet<ReturnCase[]>('/api/returns');
    return res.data?.find((r) => r.status === 'requested' && r.officeId === officeId) ?? null;
  } catch {
    return null;
  }
}

/** Logs the draft if the driver said they're bringing cases back. Returns an error message, or null.
 *  If the office has an open pickup request, the server fulfills it rather than adding a new return. */
export async function logReturn(
  draft: ReturnDraft,
  officeId: string,
  pickedUpDuringJobId?: string
): Promise<string | null> {
  if (!draft.bringing) return null;
  try {
    const res = await apiPost<ReturnCase>('/api/returns', {
      officeId,
      caseCount: draft.caseCount,
      caseNumbers: draft.caseNumbers,
      note: draft.note,
      pickedUpDuringJobId,
    });
    return res.data ? null : res.error?.message ?? "Couldn't log the return.";
  } catch {
    return "Couldn't log the return. Check your signal.";
  }
}
