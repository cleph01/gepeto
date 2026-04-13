import { useEffect, useRef, useState, useCallback } from 'react';
import { rowToCamel } from '@/lib/transform';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Job } from '@gepeto/types';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth';
import {
  Colors,
  FontSize,
  Radius,
  Spacing,
  StatusColors,
  StatusLabels,
} from '@/constants/theme';


// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Job card ─────────────────────────────────────────────────────────────────

function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  const statusColor = StatusColors[job.status];
  const isPendingResponse = job.driverResponse === 'pending' && job.status === 'assigned';
  const isStat = job.priority === 'stat';

  return (
    <TouchableOpacity
      style={[styles.card, isPendingResponse && styles.cardHighlighted]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Card header row */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.caseId}>{job.caseId}</Text>
          {isStat && (
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText}>STAT</Text>
            </View>
          )}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>
            {StatusLabels[job.status]}
          </Text>
        </View>
      </View>

      {/* Delivery address */}
      <Text style={styles.address} numberOfLines={1}>
        → {job.deliveryAddress}
      </Text>

      {/* Items summary */}
      <Text style={styles.itemsSummary}>
        {job.items.length === 1
          ? job.items[0].description
          : `${job.items.length} items`}
      </Text>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <Text style={styles.timeAgo}>{timeAgo(job.updatedAt)}</Text>
        {isPendingResponse && (
          <View style={styles.actionRequiredPill}>
            <Text style={styles.actionRequiredText}>Tap to accept or reject</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── New job banner ───────────────────────────────────────────────────────────

function NewJobBanner({ onDismiss }: { onDismiss: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(4000),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(onDismiss);
  }, []);

  return (
    <Animated.View style={[styles.banner, { opacity }]}>
      <Text style={styles.bannerText}>🔔 New job assigned — tap to review</Text>
    </Animated.View>
  );
}

// ─── Stats row ────────────────────────────────────────────────────────────────

function StatsRow({ jobs }: { jobs: Job[] }) {
  const active = jobs.filter((j) => ['assigned', 'picked_up', 'in_transit', 'arrived'].includes(j.status)).length;
  const delivered = jobs.filter((j) => j.status === 'delivered').length;
  const pending = jobs.filter((j) => j.driverResponse === 'pending').length;

  return (
    <View style={styles.statsRow}>
      <StatCell label="Active" value={active} color={Colors.primary} />
      <View style={styles.statsDivider} />
      <StatCell label="Need Response" value={pending} color={Colors.warning} />
      <View style={styles.statsDivider} />
      <StatCell label="Delivered Today" value={delivered} color={Colors.success} />
    </View>
  );
}

function StatCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function JobQueueScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  // driver_id is the drivers table UUID stored in auth metadata
  const driverId = session?.user.user_metadata?.driver_id as string | undefined;

  const fetchJobs = useCallback(async () => {
    if (!driverId) return;
    setRefreshing(true);
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setJobs(data.map((row) => rowToCamel<Job>(row)));
    }
    setRefreshing(false);
  }, [driverId]);

  // Initial fetch
  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  // Supabase Realtime — subscribe to job changes for this driver
  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel('driver-jobs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newJob = rowToCamel<Job>(payload.new as Record<string, unknown>);
            setJobs((prev) => [newJob, ...prev]);
            setShowBanner(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          } else if (payload.eventType === 'UPDATE') {
            const updated = rowToCamel<Job>(payload.new as Record<string, unknown>);
            setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [driverId]);

  const activeJobs = jobs.filter((j) => j.status !== 'delivered' && j.status !== 'rejected');
  const completedJobs = jobs.filter((j) => j.status === 'delivered' || j.status === 'rejected');

  const sections = [
    { title: 'Active', data: activeJobs },
    { title: 'Completed Today', data: completedJobs },
  ].filter((s) => s.data.length > 0);

  const flatData: Array<{ type: 'stats' } | { type: 'section'; title: string } | { type: 'job'; job: Job }> = [
    { type: 'stats' },
    ...sections.flatMap((s) => [
      { type: 'section' as const, title: s.title },
      ...s.data.map((job) => ({ type: 'job' as const, job })),
    ]),
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Jobs</Text>
        <Text style={styles.headerDate}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </Text>
      </View>

      {showBanner && <NewJobBanner onDismiss={() => setShowBanner(false)} />}

      <FlatList
        data={flatData}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchJobs}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => {
          if (item.type === 'stats') {
            return <StatsRow jobs={jobs} />;
          }
          if (item.type === 'section') {
            return (
              <Text style={styles.sectionTitle}>{item.title}</Text>
            );
          }
          return (
            <JobCard
              job={item.job}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(`/job/${item.job.id}`);
              }}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>No jobs assigned</Text>
            <Text style={styles.emptySubtitle}>You'll be notified when a new job comes in.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  headerDate: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  banner: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  bannerText: {
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statsDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  statValue: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '500',
    textAlign: 'center',
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardHighlighted: {
    borderColor: Colors.warningBorder,
    backgroundColor: '#1E2A1A',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  caseId: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  statBadge: {
    backgroundColor: '#7A2500',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  statBadgeText: {
    color: '#FF6B35',
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  address: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  itemsSummary: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  timeAgo: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  actionRequiredPill: {
    backgroundColor: Colors.warningBg,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
  },
  actionRequiredText: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing.xxl * 2,
    gap: Spacing.sm,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    maxWidth: 260,
  },
});
