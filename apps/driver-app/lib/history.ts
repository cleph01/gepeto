import type { JobItem, JobPriority } from '@gepeto/types';

/** One row in the driver's History tab (from GET /api/driver/history). */
export type JobHistoryEntry = {
  kind: 'delivered' | 'rejected';
  key: string;
  jobId: string;
  caseId: string;
  officeName: string | null;
  deliveryAddress: string;
  priority: JobPriority;
  items: JobItem[];
  at: string;
  /** The driver can still view this delivery's photo (7 days after delivery). */
  hasPhoto: boolean;
};

/** A return the lab has checked in. */
export type ReturnHistoryEntry = {
  kind: 'returned';
  key: string;
  returnId: string;
  label: string;
  officeName: string | null;
  officeAddress: string | null;
  caseCount: number;
  receivedCount: number | null;
  at: string;
};

export type HistoryEntry = JobHistoryEntry | ReturnHistoryEntry;

export type HistoryPage = { entries: HistoryEntry[]; nextBefore: string | null };

/** Read-only summary of a rejected job (from GET /api/driver/history/[jobId]). */
export type RejectedJob = {
  id: string;
  caseId: string;
  priority: JobPriority;
  items: JobItem[];
  pickupAddress: string;
  deliveryAddress: string;
  scheduledAt: string | null;
  officeName: string | null;
  rejectedAt: string;
};

/** Read-only summary of a checked-in return (from GET /api/driver/history/returns/[id]). */
export type ReturnedCases = {
  id: string;
  number: number;
  caseCount: number;
  receivedCount: number | null;
  caseId: string | null;
  caseNumbers: string[];
  note: string | null;
  officeName: string | null;
  officeAddress: string | null;
  pickedUpAt: string | null;
  droppedAt: string | null;
  checkedInAt: string;
};

/** "Today", "Yesterday", "Tomorrow", or e.g. "Mon, Oct 26" in the driver's local time. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days === -1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  });
}

export function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
