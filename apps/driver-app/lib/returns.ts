import { apiPost } from '@/lib/api';

// Returning cases: what a driver picks up at an office to bring back to the
// lab. Logged through dispatcher-web (/api/returns); see the returns migration.

export type ReturnStatus = 'with_driver' | 'at_lab' | 'checked_in';

export type ReturnCase = {
  id: string;
  number: number;
  status: ReturnStatus;
  officeId: string;
  officeName: string | null;
  caseCount: number;
  caseNumbers: string[];
  note: string | null;
  pickedUpAt: string;
  droppedAt: string | null;
  checkedInAt: string | null;
};

/** What the "Bringing anything back?" block collects. */
export type ReturnDraft = { bringing: boolean; caseCount: number; caseNumbers: string[]; note: string };

export const EMPTY_RETURN: ReturnDraft = { bringing: false, caseCount: 1, caseNumbers: [], note: '' };

export const returnLabel = (r: Pick<ReturnCase, 'number'>) => `RET-${r.number}`;

export const RETURN_STATUS_LABEL: Record<ReturnStatus, string> = {
  with_driver: 'In your car',
  at_lab: 'At lab · waiting for check-in',
  checked_in: 'Checked in',
};

/** Logs the draft if the driver said they're bringing cases back. Returns an error message, or null. */
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
