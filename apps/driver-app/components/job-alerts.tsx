import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Job } from '@gepeto/types';
import { supabase, channelName } from '@/lib/supabase';
import { rowToCamel } from '@/lib/transform';
import { useAuth } from '@/context/auth';
import { useMessages } from '@/context/messages';
import { getDriverId } from '@/lib/driver';
import { Colors, FontSize, Radius, Spacing, StatusLabels, Fonts } from '@/constants/theme';
import { dayLabel, timeLabel } from '@/lib/history';
import { IconSymbol } from '@/components/ui/icon-symbol';

// App-wide job alerts. Mounted once in the root layout so they show over
// whatever screen or tab the driver is on, and stay until tapped or dismissed.
//
//   new      a job created for this driver, or reassigned to them
//   stat     a job they have was made STAT
//   unstat   a job they have is no longer STAT
//   removed  dispatch reassigned or unassigned a job they had
//   status   dispatch changed the status of one of their jobs
//   office   dispatch changed where a job is delivered (strong alert)
//   due      dispatch changed a job's expected delivery time
//   multi    several of office/due/priority changed in one save
//   message  the lab or office sent a message (tap opens the chat)
//
// Case number changes update the job quietly (no alert).
//
// new/stat/unstat/office/due/multi come from postgres_changes on the
// driver's jobs (drivers can't edit those fields, so any change is dispatch's). The other
// two come as broadcasts from the server (see dispatcher-web lib/realtime.ts):
// a job taken off the driver is hidden from them by row-level security, and a
// row change alone can't tell dispatch's status changes from the driver's own.
// Messages come from MessagesProvider, which skips the chat that's open.

type AlertKind = 'new' | 'stat' | 'unstat' | 'removed' | 'status' | 'office' | 'due' | 'multi' | 'message';
type JobAlert = {
  kind: AlertKind;
  jobId: string;
  caseId: string;
  deliveryAddress: string;
  priority: Job['priority'];
  status?: Job['status'];
  scheduledAt?: string | null;
  changed?: string[]; // for 'multi': what changed, in words
  from?: 'Lab' | 'Office'; // for 'message'
  body?: string;           // for 'message'
};
type KnownJob = Pick<Job, 'caseId' | 'deliveryAddress' | 'priority' | 'officeId' | 'scheduledAt'>;

// Jobs this driver already has, by id. null until loaded. Module-level so the
// reject flow can drop a job (forgetJob) and get alerted if it comes back.
let known: Map<string, KnownJob> | null = null;

/** The driver gave this job up (rejected it); alert again if it's reassigned to them. */
export function forgetJob(id: string) {
  known?.delete(id);
}

// Lets the Jobs tab drop a job the moment it's taken off the driver.
const removedListeners = new Set<(jobId: string) => void>();
export function onJobRemoved(listener: (jobId: string) => void): () => void {
  removedListeners.add(listener);
  return () => { removedListeners.delete(listener); };
}

function remember(row: Pick<Job, 'id' | 'caseId' | 'deliveryAddress' | 'priority' | 'officeId' | 'scheduledAt'>) {
  known?.set(row.id, {
    caseId: row.caseId,
    deliveryAddress: row.deliveryAddress,
    priority: row.priority,
    officeId: row.officeId,
    scheduledAt: row.scheduledAt,
  });
}

const sameTime = (a: string | null, b: string | null) =>
  (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);

export function JobAlerts() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { onIncoming } = useMessages();
  const driverId = getDriverId(session);
  const [alert, setAlert] = useState<JobAlert | null>(null);
  const [slide] = useState(() => new Animated.Value(-160));

  useEffect(() => {
    if (!driverId) return;
    known = null;

    // Jobs the driver already has aren't news. Until this loads, events are
    // ignored, so a slow load can't fire alerts for old jobs.
    supabase
      .from('jobs')
      .select('id, case_id, delivery_address, priority, office_id, scheduled_at')
      .eq('driver_id', driverId)
      .then(({ data }) => {
        known = new Map();
        for (const r of data ?? []) remember(rowToCamel<Job>(r));
      });

    const show = (a: JobAlert) => {
      setAlert(a);
      if (a.kind === 'stat' || a.kind === 'office') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      else if (a.kind === 'unstat') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    };

    const changes = supabase
      .channel(channelName('job-alerts'))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs', filter: `driver_id=eq.${driverId}` },
        (payload) => {
          if (payload.eventType === 'DELETE' || !known) return;
          const row = rowToCamel<Job>(payload.new as Record<string, unknown>);
          const before = known.get(row.id);
          remember(row);
          const base = { jobId: row.id, caseId: row.caseId, deliveryAddress: row.deliveryAddress, priority: row.priority };
          if (!before) {
            // Assigned and made STAT in one go is one alert, with a STAT badge.
            if (row.status === 'assigned') show({ kind: 'new', ...base });
          } else {
            const changed: { kind: AlertKind; words: string }[] = [];
            if (before.priority !== row.priority) changed.push({ kind: row.priority === 'stat' ? 'stat' : 'unstat', words: 'priority' });
            if (before.officeId !== row.officeId) changed.push({ kind: 'office', words: 'delivery' });
            if (!sameTime(before.scheduledAt, row.scheduledAt)) changed.push({ kind: 'due', words: 'due time' });
            if (changed.length === 1) {
              show({ kind: changed[0].kind, ...base, scheduledAt: row.scheduledAt });
            } else if (changed.length > 1) {
              show({ kind: 'multi', ...base, changed: changed.map((c) => c.words) });
            }
          }
        }
      )
      .subscribe();

    // The topic has to match the server's exactly, so it can't use
    // channelName(); clear any leftover subscription to it first.
    const topic = `driver:${driverId}`;
    for (const c of supabase.getChannels()) {
      if (c.topic === `realtime:${topic}`) supabase.removeChannel(c);
    }
    const removals = supabase
      .channel(topic)
      .on('broadcast', { event: 'job_removed' }, async ({ payload }) => {
        const jobId = (payload as { jobId?: string })?.jobId;
        const info = jobId ? known?.get(jobId) : undefined;
        if (!jobId || !info) return;
        // Broadcasts aren't authenticated; only act if the job really is gone.
        const { data } = await supabase.from('jobs').select('id').eq('id', jobId).maybeSingle();
        if (data) return;
        known?.delete(jobId);
        removedListeners.forEach((l) => l(jobId));
        show({ kind: 'removed', jobId, ...info });
      })
      .on('broadcast', { event: 'job_status_changed' }, async ({ payload }) => {
        const jobId = (payload as { jobId?: string })?.jobId;
        if (!jobId) return;
        // Read the job back rather than trusting the (unauthenticated) message.
        const { data } = await supabase
          .from('jobs')
          .select('id, case_id, delivery_address, priority, status')
          .eq('id', jobId)
          .maybeSingle();
        if (!data) return;
        const row = rowToCamel<Job>(data);
        show({
          kind: 'status',
          jobId,
          caseId: row.caseId,
          deliveryAddress: row.deliveryAddress,
          priority: row.priority,
          status: row.status,
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(changes);
      supabase.removeChannel(removals);
    };
  }, [driverId]);

  // New lab/office messages, on any screen except that job's open chat.
  useEffect(
    () =>
      onIncoming((msg) => {
        const info = known?.get(msg.jobId);
        if (!info) return;
        setAlert({
          kind: 'message',
          jobId: msg.jobId,
          caseId: info.caseId,
          deliveryAddress: info.deliveryAddress,
          priority: info.priority,
          from: msg.senderRole === 'office' ? 'Office' : 'Lab',
          body: msg.body,
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }),
    [onIncoming]
  );

  useEffect(() => {
    Animated.timing(slide, {
      toValue: alert ? 0 : -160,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [alert, slide]);

  if (!alert) return null;

  const onJobScreen = pathname === `/job/${alert.jobId}`;
  const tap = () => {
    setAlert(null);
    if (alert.kind === 'message') {
      router.push(`/chat/${alert.jobId}`);
    } else if (alert.kind === 'removed') {
      // Don't leave the driver on a job that's no longer theirs.
      if (onJobScreen) router.replace('/(tabs)');
    } else if (!onJobScreen) {
      // Already looking at this job (it updates live), so don't stack a copy.
      router.push(`/job/${alert.jobId}`);
    }
  };

  const look = LOOK[alert.kind];
  // Lead with what happened; the case ID goes on the second line so a driver
  // with several jobs can still tell which one without tapping.
  const title = {
    new: 'New job',
    stat: 'Now STAT',
    unstat: 'No longer STAT',
    removed: 'Job removed',
    status: `Moved to ${alert.status ? StatusLabels[alert.status] : 'a new status'}`,
    office: 'Delivery changed',
    due: 'Due time changed',
    multi: 'Job updated',
    message: `Message from ${alert.from ?? 'Lab'}`,
  }[alert.kind];
  const detail = {
    new: `${alert.caseId} → ${alert.deliveryAddress}`,
    stat: `${alert.caseId} → ${alert.deliveryAddress}`,
    unstat: alert.caseId,
    removed: `${alert.caseId} · by dispatch`,
    status: `${alert.caseId} · by dispatch`,
    office: `${alert.caseId} → ${alert.deliveryAddress}`,
    due: alert.scheduledAt ? `${alert.caseId} · now ${dayLabel(alert.scheduledAt)} ${timeLabel(alert.scheduledAt)}` : alert.caseId,
    multi: `${alert.caseId} · ${(alert.changed ?? []).join(', ')}`,
    message: `${alert.caseId} · ${alert.body ?? ''}`,
  }[alert.kind];
  // Only when the tap does something the driver needs to know about.
  const cta = alert.kind === 'new'
    ? 'Tap to accept or reject'
    : alert.kind === 'removed' && onJobScreen
      ? 'Tap to go back to your jobs'
      : null;

  return (
    <Animated.View
      style={[styles.wrap, { paddingTop: insets.top + Spacing.sm, transform: [{ translateY: slide }] }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: look.bg, borderColor: look.border }]}
        onPress={tap}
        activeOpacity={0.85}
      >
        <View style={[styles.iconTile, { backgroundColor: look.tile }]}>
          <IconSymbol name={look.icon} size={20} color={look.iconColor} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {alert.kind === 'new' && alert.priority === 'stat' && (
              <View style={styles.statBadge}>
                <Text style={styles.statBadgeText}>STAT</Text>
              </View>
            )}
          </View>
          <Text style={[styles.detail, { color: look.detail }]} numberOfLines={alert.kind === 'message' ? 2 : 1}>{detail}</Text>
          {cta && <Text style={[styles.cta, { color: look.cta }]}>{cta}</Text>}
        </View>
        <TouchableOpacity
          style={styles.close}
          onPress={() => setAlert(null)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <IconSymbol name="xmark" size={18} color={look.detail} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Blue: new work. Amber (the STAT color): urgent changes to the route or
// priority, with a strong buzz. Navy: routine updates. Grey: low priority.
type Look = {
  icon: Parameters<typeof IconSymbol>[0]['name'];
  bg: string;
  border: string;
  tile: string;
  iconColor: string;
  detail: string;
  cta: string;
};
const BLUE = { bg: Colors.accentBg, border: Colors.accentBorder, tile: Colors.primary, iconColor: '#FFFFFF', detail: Colors.accentText, cta: Colors.accent };
const AMBER = { bg: Colors.warningBg, border: Colors.warning, tile: Colors.stat, iconColor: Colors.statText, detail: Colors.warningText, cta: Colors.warning };
const NAVY = { bg: Colors.card, border: Colors.accentBorder, tile: Colors.cardElevated, iconColor: Colors.accent, detail: Colors.textSecondary, cta: Colors.accent };
const GREY = { bg: Colors.card, border: Colors.borderStrong, tile: Colors.cardElevated, iconColor: Colors.textSecondary, detail: Colors.textSecondary, cta: Colors.textSecondary };

const LOOK: Record<AlertKind, Look> = {
  new:     { icon: 'bell.fill', ...BLUE },
  stat:    { icon: 'bolt.fill', ...AMBER },
  office:  { icon: 'mappin.and.ellipse', ...AMBER },
  status:  { icon: 'list.bullet.rectangle.portrait', ...NAVY },
  due:     { icon: 'clock', ...NAVY },
  multi:   { icon: 'square.and.pencil', ...NAVY },
  removed: { icon: 'arrow.uturn.left', ...GREY },
  unstat:  { icon: 'arrow.down', ...GREY },
  message: { icon: 'bubble.left.and.bubble.right.fill', ...NAVY },
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    zIndex: 1000,
    elevation: 1000,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  iconTile: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { color: Colors.text, fontSize: FontSize.md, fontFamily: Fonts.bold, flexShrink: 1 },
  statBadge: { backgroundColor: Colors.stat, borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  statBadgeText: { color: Colors.statText, fontSize: FontSize.xs, fontFamily: Fonts.bold, letterSpacing: 0.6 },
  detail: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSize.sm },
  cta: { fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -Spacing.sm },
});
