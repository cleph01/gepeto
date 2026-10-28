import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { apiGet } from '@/lib/api';
import { dayLabel, timeLabel, type RejectedJob } from '@/lib/history';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

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
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>You rejected this job</Text>
        <Text style={styles.bannerText}>
          {dayLabel(job.rejectedAt)} at {timeLabel(job.rejectedAt)}. It went back to dispatch to be reassigned.
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.titleRow}>
          <Text style={styles.caseId}>{job.caseId}</Text>
          {job.priority === 'stat' && (
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText}>STAT</Text>
            </View>
          )}
        </View>
        {job.officeName && <Text style={styles.office}>{job.officeName}</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Pickup</Text>
        <Text style={styles.value}>{job.pickupAddress}</Text>
        <Text style={[styles.label, styles.labelSpaced]}>Delivery</Text>
        <Text style={styles.value}>{job.deliveryAddress}</Text>
        {job.scheduledAt && (
          <>
            <Text style={[styles.label, styles.labelSpaced]}>Expected delivery</Text>
            <Text style={styles.value}>
              {dayLabel(job.scheduledAt)} at {timeLabel(job.scheduledAt)}
            </Text>
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Items</Text>
        {(job.items ?? []).map((item, i) => (
          <Text key={i} style={styles.value}>• {item.description}</Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  errorText: { color: Colors.textSecondary, fontSize: FontSize.md, textAlign: 'center' },
  banner: {
    backgroundColor: Colors.dangerBg,
    borderColor: Colors.dangerBorder,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  bannerTitle: { color: Colors.danger, fontSize: FontSize.md, fontWeight: '700' },
  bannerText: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 19 },
  section: {
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  caseId: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  statBadge: { backgroundColor: '#7A2500', borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statBadgeText: { color: '#FF6B35', fontSize: FontSize.xs, fontWeight: '800', letterSpacing: 0.5 },
  office: { color: Colors.textSecondary, fontSize: FontSize.md, marginTop: Spacing.xs },
  label: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  labelSpaced: { marginTop: Spacing.md },
  value: { color: Colors.text, fontSize: FontSize.md, lineHeight: 21 },
});
