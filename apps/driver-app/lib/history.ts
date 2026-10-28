import type { JobItem, JobPriority } from '@gepeto/types';

/** One row in the driver's History tab (from GET /api/driver/history). */
export type HistoryEntry = {
  kind: 'delivered' | 'rejected';
  key: string;
  jobId: string;
  caseId: string;
  officeName: string | null;
  deliveryAddress: string;
  priority: JobPriority;
  items: JobItem[];
  at: string;
  hasProof: boolean;
};

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

/** "Today", "Yesterday", or e.g. "Mon, Oct 26" in the driver's local time. */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
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
