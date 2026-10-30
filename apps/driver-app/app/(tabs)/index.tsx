import { useEffect, useRef, useState, useCallback } from 'react';
import { rowToCamel } from '@/lib/transform';
import { useLocationTracking } from '@/hooks/use-location-tracking';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Job } from '@gepeto/types';
import { supabase, channelName } from '@/lib/supabase';
import { useAuth } from '@/context/auth';
import { useMessages } from '@/context/messages';
import {
  Colors,
  FontSize,
  Radius,
  Spacing,
  StatusColors,
  StatusLabels,
  Fonts,
} from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getDriverId } from '@/lib/driver';
import { navigate } from '@/lib/navigation';
import { onJobRemoved } from '@/components/job-alerts';
import { ON_THE_WAY, STEPS, dueInfo, needsReply } from '@/lib/jobs';

// The queue reads office names alongside each job (drivers can read their lab's offices).
type QueueJob = Job & { officeName: string | null };

function toQueueJob(row: Record<string, unknown>): QueueJob {
  const { offices, ...rest } = row as Record<string, unknown> & { offices?: { name: string } | null };
  return { ...rowToCamel<Job>(rest), officeName: offices?.name ?? null };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// One place the driver goes: a single job, or several for the same office
// (grouped so they can be delivered on one trip).
type Stop = { key: string; jobs: QueueJob[] };

const dueTime = (j: QueueJob) => (j.scheduledAt ? new Date(j.scheduledAt).getTime() : Infinity);

/** Groups jobs by office and orders the stops by their earliest due time (no due time last). */
function toStops(jobs: QueueJob[]): Stop[] {
  const byKey = new Map<string, QueueJob[]>();
  for (const job of jobs) {
    const key = job.officeId ?? job.deliveryAddress;
    byKey.set(key, [...(byKey.get(key) ?? []), job]);
  }
  const stops = [...byKey].map(([key, group]) => ({ key, jobs: group.sort((a, b) => dueTime(a) - dueTime(b)) }));
  return stops.sort((a, b) => dueTime(a.jobs[0]) - dueTime(b.jobs[0]));
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({ job, unread, inGroup, onPress }: { job: QueueJob; unread: number; inGroup?: boolean; onPress: () => void }) {
  const statusColor = StatusColors[job.status];
  const pendingReply = needsReply(job);
  const due = dueInfo(job);
  const step = STEPS.findIndex((s) => s.status === job.status);
  const showProgress = step > 0; // once picked up

  return (
    <TouchableOpacity
      style={[styles.card, pendingReply && styles.cardNeedsReply]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${job.officeName ?? job.caseId}, ${StatusLabels[job.status]}${pendingReply ? ', needs your reply' : ''}${unread > 0 ? `, ${unread} unread messages` : ''}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.caseId} numberOfLines={1}>{job.caseId}</Text>
          {job.priority === 'stat' && (
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText}>STAT</Text>
            </View>
          )}
        </View>
        <View style={styles.cardHeaderRight}>
          {unread > 0 && (
            <View style={styles.unreadBadge}>
              <IconSymbol name="bubble.left.and.bubble.right.fill" size={12} color={Colors.dangerBg} />
              <Text style={styles.unreadBadgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}>
            <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>
              {StatusLabels[job.status]}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.cardBody}>
        {/* In a group the office and address are on the group header. */}
        {!inGroup && <Text style={styles.officeName} numberOfLines={1}>{job.officeName ?? job.deliveryAddress}</Text>}
        {!inGroup && job.officeName && (
          <View style={styles.metaRow}>
            <IconSymbol name="mappin.and.ellipse" size={15} color={Colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{job.deliveryAddress}</Text>
          </View>
        )}
        {due && (
          <View style={styles.metaRow}>
            <IconSymbol
              name="clock"
              size={15}
              color={due.tone === 'late' ? Colors.danger : due.tone === 'soon' ? Colors.warning : Colors.textSecondary}
            />
            <Text
              style={[
                styles.metaText,
                due.tone === 'late' && styles.dueLate,
                due.tone === 'soon' && styles.dueSoon,
              ]}
            >
              {due.text}
            </Text>
          </View>
        )}
      </View>

      {showProgress && (
        <View accessibilityLabel={`Step ${step + 1} of 4: ${STEPS[step].label}`}>
          <View style={styles.progressTrack}>
            {STEPS.map((s, i) => (
              <View key={s.status} style={[styles.progressSeg, i <= step && styles.progressSegDone]} />
            ))}
          </View>
          <View style={styles.progressLabels}>
            {STEPS.map((s, i) => (
              <Text key={s.status} style={[styles.progressLabel, i === step && styles.progressLabelCurrent]}>
                {s.label}
              </Text>
            ))}
          </View>
        </View>
      )}

      {pendingReply && (
        <View style={styles.replyPrompt}>
          <Text style={styles.replyPromptText}>Tap to accept or reject</Text>
          <IconSymbol name="chevron.right" size={16} color={Colors.accent} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

// Delivered/rejected today, by the driver's local date. deliveredAt is set when
// the status goes to delivered; updatedAt covers rejections and older rows.
function finishedToday(job: Job) {
  if (job.status !== 'delivered' && job.status !== 'rejected') return false;
  const when = job.deliveredAt ?? job.updatedAt;
  return !!when && new Date(when).toDateString() === new Date().toDateString();
}

function StatsRow({ jobs }: { jobs: Job[] }) {
  const active = jobs.filter((j) => ON_THE_WAY.includes(j.status)).length;
  const delivered = jobs.filter((j) => j.status === 'delivered' && finishedToday(j)).length;
  const pending = jobs.filter(needsReply).length;

  return (
    <View style={styles.statsRow}>
      <StatTile label="Active" value={active} />
      <StatTile label="Needs reply" value={pending} highlight={pending > 0} />
      <StatTile label="Delivered" value={delivered} valueColor={Colors.success} />
    </View>
  );
}

// ─── Office group header ─────────────────────────────────────────────────────

function GroupHeader({ jobs }: { jobs: QueueJob[] }) {
  const first = jobs[0];
  const due = dueInfo(first); // jobs are sorted, so this is the earliest
  const hasStat = jobs.some((j) => j.priority === 'stat');
  return (
    <View
      style={styles.groupHeader}
      accessibilityLabel={`${first.officeName ?? first.deliveryAddress}, ${jobs.length} jobs${hasStat ? ', includes STAT' : ''}`}
    >
      <View style={styles.groupHeaderBody}>
        <View style={styles.groupTitleRow}>
          <Text style={[styles.officeName, styles.groupOfficeName]} numberOfLines={1}>{first.officeName ?? first.deliveryAddress}</Text>
          <View style={styles.groupCount}>
            <Text style={styles.groupCountText}>{jobs.length} jobs</Text>
          </View>
          {hasStat && (
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText}>STAT</Text>
            </View>
          )}
        </View>
        {first.officeName && (
          <View style={styles.metaRow}>
            <IconSymbol name="mappin.and.ellipse" size={15} color={Colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{first.deliveryAddress}</Text>
          </View>
        )}
        {due && (
          <View style={styles.metaRow}>
            <IconSymbol
              name="clock"
              size={15}
              color={due.tone === 'late' ? Colors.danger : due.tone === 'soon' ? Colors.warning : Colors.textSecondary}
            />
            <Text style={[styles.metaText, due.tone === 'late' && styles.dueLate, due.tone === 'soon' && styles.dueSoon]}>
              {jobs.length > 1 ? `Earliest: ${due.text}` : due.text}
            </Text>
          </View>
        )}
      </View>
      <TouchableOpacity
        style={styles.groupNavigate}
        onPress={() => navigate({ address: first.deliveryAddress })}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Navigate to ${first.officeName ?? first.deliveryAddress}`}
      >
        <IconSymbol name="mappin.and.ellipse" size={20} color={Colors.accent} />
      </TouchableOpacity>
    </View>
  );
}

function StatTile({ label, value, highlight, valueColor }: { label: string; value: number; highlight?: boolean; valueColor?: string }) {
  return (
    <View style={[styles.statTile, highlight && styles.statTileHighlight]}>
      <Text style={[styles.statValue, { color: highlight ? Colors.accent : valueColor ?? Colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, highlight && styles.statLabelHighlight]}>{label}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

type Row =
  | { type: 'stats' }
  | { type: 'section'; title: string }
  | { type: 'group'; key: string; jobs: QueueJob[] }
  | { type: 'job'; job: QueueJob; inGroup?: boolean; lastInGroup?: boolean };

export default function JobQueueScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { unreadByJob } = useMessages();
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const driverId = getDriverId(session);

  const fetchJobs = useCallback(async (showSpinner = true) => {
    if (!driverId) return;
    if (showSpinner) setRefreshing(true);
    // Only active jobs and today's finished ones; older ones live in the History tab.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const since = startOfToday.toISOString();
    const { data, error } = await supabase
      .from('jobs')
      .select('*, offices(name)')
      .eq('driver_id', driverId)
      .or(`status.neq.delivered,delivered_at.gte.${since},updated_at.gte.${since}`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setJobs(data.map((row) => toQueueJob(row)));
    }
    if (showSpinner) setRefreshing(false);
  }, [driverId]);

  // Initial fetch. fetchJobs() only updates the list after awaiting the query;
  // the spinner it shows first is intended.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Supabase Realtime — subscribe to job changes for this driver
  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel(channelName('driver-jobs'))
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          // Apply the row right away (keeping the office name we have), then
          // refetch quietly so a new job or office change gets its name.
          const row = rowToCamel<Job>(payload.new as Record<string, unknown>);
          setJobs((prev) => {
            const existing = prev.find((j) => j.id === row.id);
            const next: QueueJob = { ...row, officeName: existing && existing.officeId === row.officeId ? existing.officeName : null };
            // A dispatcher assigning an existing job to this driver arrives as an
            // UPDATE for a job not in the list yet; treat it like a new job.
            return existing ? prev.map((j) => (j.id === row.id ? next : j)) : [next, ...prev];
          });
          if (refetchTimer.current) clearTimeout(refetchTimer.current);
          refetchTimer.current = setTimeout(() => fetchJobs(false), 400);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
    };
  }, [driverId, fetchJobs]);

  // Dispatch took a job off this driver (no realtime row event reaches them).
  useEffect(() => onJobRemoved((jobId) => {
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
  }), []);

  const activeJobs = jobs.filter((j) => j.status !== 'delivered' && j.status !== 'rejected');
  const replyJobs = activeJobs.filter(needsReply);
  const inProgressJobs = activeJobs.filter((j) => !needsReply(j));
  const completedJobs = jobs.filter(finishedToday);

  // Track location whenever the driver has at least one active job
  const hasActiveJob = activeJobs.some((j) => ON_THE_WAY.includes(j.status));
  useLocationTracking(hasActiveJob);

  // Active sections group jobs going to the same office, so they can go out on one trip.
  const sections = [
    { title: `Needs your reply · ${replyJobs.length}`, data: replyJobs, grouped: true },
    { title: `In progress · ${inProgressJobs.length}`, data: inProgressJobs, grouped: true },
    { title: `Completed today · ${completedJobs.length}`, data: completedJobs, grouped: false },
  ].filter((s) => s.data.length > 0);

  const flatData: Row[] = [
    { type: 'stats' },
    ...sections.flatMap((s): Row[] => [
      { type: 'section', title: s.title },
      ...(s.grouped
        ? toStops(s.data).flatMap((stop): Row[] =>
            stop.jobs.length === 1
              ? [{ type: 'job', job: stop.jobs[0] }]
              : [
                  { type: 'group', key: `${s.title}-${stop.key}`, jobs: stop.jobs },
                  ...stop.jobs.map((job, i): Row => ({ type: 'job', job, inGroup: true, lastInGroup: i === stop.jobs.length - 1 })),
                ])
        : s.data.map((job): Row => ({ type: 'job', job }))),
    ]),
  ];

  return (
    <View style={styles.screen}>
      {/* Landing-page dot grid and blue glow, behind the safe area so it reaches the top edge */}
      <Image
        source={require('@/assets/images/header-glow.png')}
        style={styles.glow}
        resizeMode="cover"
        accessible={false}
      />
      <SafeAreaView style={styles.safe} edges={['top']}>

      <FlatList
        data={flatData}
        keyExtractor={(item, i) => (item.type === 'job' ? item.job.id : item.type === 'group' ? `group-${item.key}` : `${item.type}-${i}`)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchJobs}
            tintColor={Colors.accent}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brand}>
                <View style={styles.logoTile}>
                  <Image source={require('@/assets/images/gepeto-icon.png')} style={styles.logo} accessibilityLabel="Gepeto" />
                </View>
                <Text style={styles.wordmark}>Gepeto</Text>
              </View>
              <Text style={styles.headerDate}>
                {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <Text style={styles.eyebrow}>Today</Text>
            <Text style={styles.headerTitle} accessibilityRole="header">My Jobs</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === 'stats') {
            return <StatsRow jobs={jobs} />;
          }
          if (item.type === 'section') {
            return <Text style={styles.sectionTitle}>{item.title}</Text>;
          }
          if (item.type === 'group') {
            return <GroupHeader jobs={item.jobs} />;
          }
          const card = (
            <JobCard
              job={item.job}
              unread={unreadByJob[item.job.id] ?? 0}
              inGroup={item.inGroup}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/job/${item.job.id}`);
              }}
            />
          );
          // Grouped jobs hang off their office header on a blue rail.
          return item.inGroup
            ? <View style={[styles.groupRail, item.lastInGroup && styles.groupRailLast]}>{card}</View>
            : card;
        }}
        ListFooterComponent={
          sections.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <IconSymbol name="tray" size={28} color={Colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No jobs yet</Text>
              <Text style={styles.emptySubtitle}>{"You'll get an alert as soon as dispatch assigns you one."}</Text>
            </View>
          ) : undefined
        }
      />
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  safe: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
  },
  listContent: {
    paddingHorizontal: Spacing.xl - 4,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm + 2,
  },
  header: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    gap: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  logoTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 28,
    height: 28,
  },
  wordmark: {
    fontFamily: Fonts.bold,
    color: Colors.text,
    fontSize: 18,
    letterSpacing: -0.4,
  },
  headerDate: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  eyebrow: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
    fontSize: FontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: Fonts.bold,
    color: Colors.text,
    fontSize: FontSize.xxxl,
    letterSpacing: -0.75,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statTile: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md + 2,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 2,
  },
  statTileHighlight: {
    backgroundColor: Colors.accentBg,
    borderColor: Colors.accentBorder,
  },
  statValue: {
    fontFamily: Fonts.bold,
    fontSize: 26,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    fontSize: 12,
  },
  statLabelHighlight: {
    color: Colors.accentText,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingTop: Spacing.sm,
  },
  groupHeaderBody: {
    flex: 1,
    gap: 6,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  groupOfficeName: {
    flexShrink: 1,
  },
  groupCount: {
    flexShrink: 0,
    borderRadius: Radius.full,
    backgroundColor: Colors.accentBg,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    paddingHorizontal: Spacing.sm + 1,
    paddingVertical: 2,
  },
  groupCountText: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
    fontSize: 12,
  },
  groupNavigate: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentBg,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupRail: {
    marginLeft: Spacing.sm,
    paddingLeft: Spacing.md,
    borderLeftWidth: 2,
    borderLeftColor: Colors.accentBorder,
  },
  groupRailLast: {
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: Fonts.semibold,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: Spacing.md,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardNeedsReply: {
    borderColor: Colors.accentBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    flexShrink: 0,
  },
  unreadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.danger,
  },
  unreadBadgeText: {
    fontFamily: Fonts.bold,
    color: Colors.dangerBg,
    fontSize: 12,
  },
  caseId: {
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    flexShrink: 1,
  },
  statBadge: {
    backgroundColor: Colors.stat,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statBadgeText: {
    fontFamily: Fonts.bold,
    color: Colors.statText,
    fontSize: FontSize.xs,
    letterSpacing: 0.6,
  },
  statusBadge: {
    flexShrink: 0,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.md - 2,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
  },
  cardBody: {
    gap: 6,
  },
  officeName: {
    fontFamily: Fonts.semibold,
    color: Colors.text,
    fontSize: FontSize.lg,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    fontSize: 14,
    flexShrink: 1,
  },
  dueSoon: {
    fontFamily: Fonts.medium,
    color: Colors.warning,
  },
  dueLate: {
    fontFamily: Fonts.semibold,
    color: Colors.danger,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 4,
  },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.track,
  },
  progressSegDone: {
    backgroundColor: Colors.primary,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressLabel: {
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  progressLabelCurrent: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
  },
  replyPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.accentBg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    minHeight: 44,
  },
  replyPromptText: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
    fontSize: 14,
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing.xxl * 2,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: Fonts.semibold,
    color: Colors.text,
    fontSize: FontSize.lg,
  },
  emptySubtitle: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 19,
  },
});
