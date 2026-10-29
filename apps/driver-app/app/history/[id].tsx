import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiGet } from '@/lib/api';
import { dayLabel, timeLabel, type RejectedJob } from '@/lib/history';
import { Colors, FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Read-only summary of a job this driver rejected. The job has been unassigned
// (and may belong to another driver now), so only what the driver saw when
// they rejected it is shown, not its current status or messages.
export default function RejectedJobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<RejectedJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<RejectedJob>(`/api/driver/history/${id}`)
      .then((res) => {
        if (res.data) setJob(res.data);
        else setError(res.error?.message ?? "Couldn't load this job.");
      })
      .catch(() => setError("Couldn't load this job. Check your connection."));
  }, [id]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  if (!job) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <View style={styles.titleRow}>
          <Text style={styles.caseId}>{job.caseId}</Text>
          {job.priority === 'stat' && (
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText}>STAT</Text>
            </View>
          )}
        </View>
        <Text style={styles.title} accessibilityRole="header">{job.officeName ?? job.deliveryAddress}</Text>
      </View>

      <View style={styles.outcome}>
        <View style={styles.outcomeIcon}>
          <IconSymbol name="xmark" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.outcomeBody}>
          <Text style={styles.outcomeTitle}>You rejected this job</Text>
          <Text style={styles.outcomeSub}>
            {dayLabel(job.rejectedAt)} at {timeLabel(job.rejectedAt)}. It went back to dispatch to be reassigned.
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>Route</Text>
        <View style={styles.metaRow}>
          <IconSymbol name="tray" size={16} color={Colors.textSecondary} />
          <View style={styles.metaBody}>
            <Text style={styles.metaLabel}>Pickup</Text>
            <Text style={styles.value}>{job.pickupAddress}</Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <IconSymbol name="mappin.and.ellipse" size={16} color={Colors.textSecondary} />
          <View style={styles.metaBody}>
            <Text style={styles.metaLabel}>Delivery</Text>
            <Text style={styles.value}>{job.deliveryAddress}</Text>
          </View>
        </View>
        {job.scheduledAt && (
          <View style={styles.metaRow}>
            <IconSymbol name="clock" size={16} color={Colors.textSecondary} />
            <View style={styles.metaBody}>
              <Text style={styles.metaLabel}>Was due</Text>
              <Text style={styles.value}>
                {dayLabel(job.scheduledAt)} at {timeLabel(job.scheduledAt)}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>Case</Text>
        {(job.items ?? []).map((item, i) => (
          <Text key={i} style={styles.value}>{item.description}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.xl - 4, paddingTop: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  errorText: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSize.md, textAlign: 'center' },
  summary: { gap: Spacing.sm, marginBottom: Spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  caseId: { fontFamily: Fonts.semibold, color: Colors.textSecondary, fontSize: FontSize.sm },
  statBadge: { backgroundColor: Colors.stat, borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  statBadgeText: { color: Colors.statText, fontSize: FontSize.xs, fontFamily: Fonts.bold, letterSpacing: 0.6 },
  title: { fontFamily: Fonts.bold, color: Colors.text, fontSize: FontSize.xxl, letterSpacing: -0.5 },
  outcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.dangerBg,
    borderColor: Colors.dangerBorder,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  outcomeIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.dangerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeBody: { flex: 1, gap: 2 },
  outcomeTitle: { fontFamily: Fonts.semibold, color: Colors.danger, fontSize: FontSize.lg },
  outcomeSub: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 19 },
  section: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  eyebrow: {
    fontFamily: Fonts.semibold,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm + 2 },
  metaBody: { flex: 1, gap: 2 },
  metaLabel: { fontFamily: Fonts.medium, color: Colors.textMuted, fontSize: 12 },
  value: { fontFamily: Fonts.regular, color: Colors.text, fontSize: FontSize.md, lineHeight: 21 },
});
