import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Job } from '@gepeto/types';
import { supabase, channelName } from '@/lib/supabase';
import { rowToCamel } from '@/lib/transform';
import { useAuth } from '@/context/auth';
import { getDriverId } from '@/lib/driver';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

// App-wide job alerts. Mounted once in the root layout so they show over
// whatever screen or tab the driver is on, and stay until tapped or dismissed.
//
//   new      a job created for this driver, or reassigned to them
//   stat     a job they have was made STAT
//   unstat   a job they have is no longer STAT
//   removed  dispatch reassigned or unassigned a job they had
//
// new/stat/unstat come from postgres_changes on the driver's jobs. A job taken
// off the driver is hidden from them by row-level security, so the server
// sends a `job_removed` broadcast instead (see dispatcher-web lib/realtime.ts).

type AlertKind = 'new' | 'stat' | 'unstat' | 'removed';
type JobAlert = { kind: AlertKind; jobId: string; caseId: string; deliveryAddress: string; priority: Job['priority'] };
type KnownJob = Pick<JobAlert, 'caseId' | 'deliveryAddress' | 'priority'>;

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

function remember(row: Pick<Job, 'id' | 'caseId' | 'deliveryAddress' | 'priority'>) {
  known?.set(row.id, { caseId: row.caseId, deliveryAddress: row.deliveryAddress, priority: row.priority });
}

export function JobAlerts() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
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
      .select('id, case_id, delivery_address, priority')
      .eq('driver_id', driverId)
      .then(({ data }) => {
        known = new Map();
        for (const r of data ?? []) remember(rowToCamel<Job>(r));
      });

    const show = (a: JobAlert) => {
      setAlert(a);
      if (a.kind === 'stat') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
          } else if (before.priority !== row.priority) {
            show({ kind: row.priority === 'stat' ? 'stat' : 'unstat', ...base });
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
      .subscribe();

    return () => {
      supabase.removeChannel(changes);
      supabase.removeChannel(removals);
    };
  }, [driverId]);

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
    if (alert.kind === 'removed') {
      // Don't leave the driver on a job that's no longer theirs.
      if (onJobScreen) router.replace('/(tabs)');
    } else if (!onJobScreen) {
      // Already looking at this job (it updates live), so don't stack a copy.
      router.push(`/job/${alert.jobId}`);
    }
  };

  const look = LOOK[alert.kind];
  const title = {
    new: 'New job assigned',
    stat: `${alert.caseId} is now STAT`,
    unstat: `${alert.caseId} is no longer STAT`,
    removed: `${alert.caseId} was taken off your jobs`,
  }[alert.kind];
  const detail = {
    new: `${alert.caseId} → ${alert.deliveryAddress}`,
    stat: `→ ${alert.deliveryAddress}`,
    unstat: 'Back to standard priority.',
    removed: 'Dispatch reassigned or unassigned it.',
  }[alert.kind];
  const cta = {
    new: 'Tap to accept or reject',
    stat: 'Tap to view',
    unstat: 'Tap to view',
    removed: onJobScreen ? 'Tap to go back to your jobs' : 'Tap to dismiss',
  }[alert.kind];

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
        <Text style={styles.icon}>{look.icon}</Text>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {alert.kind === 'new' && alert.priority === 'stat' && (
              <View style={styles.statBadge}>
                <Text style={styles.statBadgeText}>STAT</Text>
              </View>
            )}
          </View>
          <Text style={styles.detail} numberOfLines={1}>{detail}</Text>
          <Text style={[styles.cta, { color: look.cta }]}>{cta}</Text>
        </View>
        <TouchableOpacity
          onPress={() => setAlert(null)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel="Dismiss"
        >
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const LOOK: Record<AlertKind, { icon: string; bg: string; border: string; cta: string }> = {
  new:     { icon: '🔔', bg: Colors.warningBg, border: Colors.warningBorder, cta: Colors.warning },
  stat:    { icon: '⚡', bg: '#3A1300',         border: '#FF6B35',           cta: '#FF6B35' },
  unstat:  { icon: '↓',  bg: Colors.card,      border: Colors.border,       cta: Colors.textSecondary },
  removed: { icon: '↩',  bg: Colors.card,      border: Colors.border,       cta: Colors.textSecondary },
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
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  icon: { fontSize: 22, color: Colors.text, width: 26, textAlign: 'center' },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', flexShrink: 1 },
  statBadge: { backgroundColor: '#7A2500', borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statBadgeText: { color: '#FF6B35', fontSize: FontSize.xs, fontWeight: '800', letterSpacing: 0.5 },
  detail: { color: Colors.textSecondary, fontSize: FontSize.sm },
  cta: { fontSize: FontSize.sm, fontWeight: '600' },
  close: { color: Colors.textMuted, fontSize: FontSize.lg, paddingHorizontal: Spacing.xs },
});
