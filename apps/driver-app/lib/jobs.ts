import { Job, JobStatus } from '@gepeto/types';

// Shared by the Jobs tab and the job detail screen.

/** Statuses where the job is the driver's and not yet delivered. */
export const ON_THE_WAY: JobStatus[] = ['assigned', 'picked_up', 'in_transit', 'arrived'];

/** The four steps of the progress bar. */
export const STEPS: { status: JobStatus; label: string }[] = [
  { status: 'assigned', label: 'Assigned' },
  { status: 'picked_up', label: 'Picked up' },
  { status: 'in_transit', label: 'In transit' },
  { status: 'arrived', label: 'Arrived' },
];

export const needsReply = (j: Job) => j.driverResponse === 'pending' && j.status === 'assigned';

/** "Due today 2:30 PM", "Due tomorrow 9:00 AM", "Due Thu 3:00 PM", or "Late · due 2:30 PM". */
export function dueInfo(job: Job): { text: string; tone: 'late' | 'soon' | 'normal' } | null {
  if (!job.scheduledAt || job.status === 'delivered') return null;
  const due = new Date(job.scheduledAt);
  const time = due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(due) - startOf(new Date())) / 86400000);
  const day =
    days === 0 ? 'today' :
    days === 1 ? 'tomorrow' :
    days > 1 && days < 7 ? due.toLocaleDateString('en-US', { weekday: 'short' }) :
    due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const minsLeft = (due.getTime() - Date.now()) / 60000;
  if (minsLeft < 0) return { text: `Late · due ${days === 0 ? '' : `${day} `}${time}`, tone: 'late' };
  return { text: `Due ${day} ${time}`, tone: minsLeft <= 60 ? 'soon' : 'normal' };
}
