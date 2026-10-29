import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { apiGet } from '@/lib/api';
import { dayLabel, timeLabel, type HistoryEntry, type HistoryPage } from '@/lib/history';
import { Colors, FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// ─── History row ─────────────────────────────────────────────────────────────

function HistoryRow({ entry, onPress }: { entry: HistoryEntry; onPress: () => void }) {
  const rejected = entry.kind === 'rejected';
  const items = entry.items ?? [];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.caseId} numberOfLines={1}>{entry.caseId}</Text>
          {entry.priority === 'stat' && (
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText}>STAT</Text>
            </View>
          )}
        </View>
        <View style={[styles.kindBadge, rejected ? styles.kindRejected : styles.kindDelivered]}>
          <IconSymbol name={rejected ? 'xmark' : 'checkmark'} size={12} color={rejected ? Colors.danger : Colors.success} />
          <Text style={[styles.kindText, { color: rejected ? Colors.danger : Colors.success }]}>
            {rejected ? 'Rejected' : 'Delivered'}
          </Text>
        </View>
      </View>

      <Text style={styles.office} numberOfLines={1}>{entry.officeName ?? entry.deliveryAddress}</Text>
      {entry.officeName && (
        <View style={styles.metaRow}>
          <IconSymbol name="mappin.and.ellipse" size={15} color={Colors.textSecondary} />
          <Text style={styles.address} numberOfLines={1}>{entry.deliveryAddress}</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <Text style={styles.itemsSummary} numberOfLines={1}>
          {items.length === 1 ? items[0].description : `${items.length} items`}
        </Text>
        <View style={styles.footerRight}>
          {entry.hasProof && (
            <View style={styles.proofRow}>
              <IconSymbol name="camera" size={14} color={Colors.textSecondary} />
              <Text style={styles.proof}>Proof</Text>
            </View>
          )}
          <Text style={styles.time}>{timeLabel(entry.at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

type ListItem = { type: 'day'; label: string } | { type: 'entry'; entry: HistoryEntry };

export default function HistoryScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await apiGet<HistoryPage>('/api/driver/history');
      if (res.data) {
        setEntries(res.data.entries);
        setNextBefore(res.data.nextBefore);
      } else {
        setError(res.error?.message ?? "Couldn't load your history.");
      }
    } catch {
      setError("Couldn't load your history. Check your connection.");
    }
    setLoaded(true);
    setRefreshing(false);
  }, []);

  // Reload whenever the tab comes into view, so a delivery made on the Jobs tab shows up.
  useFocusEffect(
    useCallback(() => {
      loadFirstPage();
    }, [loadFirstPage])
  );

  const loadMore = async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await apiGet<HistoryPage>(`/api/driver/history?before=${encodeURIComponent(nextBefore)}`);
      if (res.data) {
        setEntries((prev) => [...prev, ...res.data!.entries]);
        setNextBefore(res.data.nextBefore);
      }
    } catch {
      // Leave the button in place so the driver can try again.
    }
    setLoadingMore(false);
  };

  const listData: ListItem[] = [];
  let lastDay = '';
  for (const entry of entries) {
    const label = dayLabel(entry.at);
    if (label !== lastDay) {
      listData.push({ type: 'day', label });
      lastDay = label;
    }
    listData.push({ type: 'entry', entry });
  }

  const openEntry = (entry: HistoryEntry) => {
    Haptics.selectionAsync();
    if (entry.kind === 'rejected') router.push(`/history/${entry.jobId}`);
    else router.push(`/job/${entry.jobId}`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Last 30 days</Text>
        <Text style={styles.headerTitle} accessibilityRole="header">History</Text>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => (item.type === 'day' ? `day-${item.label}` : item.entry.key)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadFirstPage} tintColor={Colors.accent} />
        }
        renderItem={({ item }) =>
          item.type === 'day' ? (
            <Text style={styles.dayTitle}>{item.label}</Text>
          ) : (
            <HistoryRow entry={item.entry} onPress={() => openEntry(item.entry)} />
          )
        }
        ListEmptyComponent={
          loaded ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <IconSymbol name={error ? 'exclamationmark.triangle' : 'tray'} size={28} color={error ? Colors.danger : Colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>{error ?? 'Nothing in the last 30 days'}</Text>
              {!error && (
                <Text style={styles.emptySubtitle}>
                  Jobs you deliver or reject will show up here.
                </Text>
              )}
            </View>
          ) : undefined
        }
        ListFooterComponent={
          nextBefore ? (
            <TouchableOpacity style={styles.loadMore} onPress={loadMore} disabled={loadingMore} activeOpacity={0.75}>
              {loadingMore ? (
                <ActivityIndicator color={Colors.accent} />
              ) : (
                <Text style={styles.loadMoreText}>Load older jobs</Text>
              )}
            </TouchableOpacity>
          ) : undefined
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingHorizontal: Spacing.xl - 4,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: 4,
  },
  eyebrow: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
    fontSize: FontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  headerTitle: { color: Colors.text, fontSize: FontSize.xxxl, fontFamily: Fonts.bold, letterSpacing: -0.75 },
  listContent: { paddingHorizontal: Spacing.xl - 4, paddingBottom: Spacing.xxl, gap: Spacing.sm + 2 },
  dayTitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semibold,
    letterSpacing: 1.5,
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
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
  caseId: { color: Colors.textSecondary, fontSize: FontSize.sm, fontFamily: Fonts.semibold, flexShrink: 1 },
  statBadge: { backgroundColor: Colors.stat, borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  statBadgeText: { color: Colors.statText, fontSize: FontSize.xs, fontFamily: Fonts.bold, letterSpacing: 0.6 },
  kindBadge: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: Spacing.md - 2, paddingVertical: 4 },
  kindDelivered: { backgroundColor: Colors.successBg, borderColor: Colors.successBorder },
  kindRejected: { backgroundColor: Colors.dangerBg, borderColor: Colors.dangerBorder },
  kindText: { fontSize: FontSize.xs, fontFamily: Fonts.semibold },
  office: { color: Colors.text, fontSize: FontSize.lg, fontFamily: Fonts.semibold, letterSpacing: -0.2 },
  address: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: 14, flexShrink: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  itemsSummary: { fontFamily: Fonts.regular, color: Colors.textMuted, fontSize: FontSize.xs, flexShrink: 1 },
  proof: { color: Colors.textSecondary, fontSize: FontSize.xs, fontFamily: Fonts.medium },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  proofRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexShrink: 0 },
  time: { fontFamily: Fonts.medium, color: Colors.textSecondary, fontSize: FontSize.xs },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontFamily: Fonts.semibold, textAlign: 'center' },
  emptySubtitle: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
  loadMore: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  loadMoreText: { color: Colors.accent, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
