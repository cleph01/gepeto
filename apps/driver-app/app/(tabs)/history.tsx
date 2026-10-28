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
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

// ─── History row ─────────────────────────────────────────────────────────────

function HistoryRow({ entry, onPress }: { entry: HistoryEntry; onPress: () => void }) {
  const rejected = entry.kind === 'rejected';
  const items = entry.items ?? [];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.caseId}>{entry.caseId}</Text>
          {entry.priority === 'stat' && (
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText}>STAT</Text>
            </View>
          )}
        </View>
        <View style={[styles.kindBadge, rejected ? styles.kindRejected : styles.kindDelivered]}>
          <Text style={[styles.kindText, { color: rejected ? Colors.danger : Colors.success }]}>
            {rejected ? 'Rejected' : 'Delivered'} {timeLabel(entry.at)}
          </Text>
        </View>
      </View>

      {entry.officeName && <Text style={styles.office} numberOfLines={1}>{entry.officeName}</Text>}
      <Text style={styles.address} numberOfLines={1}>→ {entry.deliveryAddress}</Text>

      <View style={styles.cardFooter}>
        <Text style={styles.itemsSummary} numberOfLines={1}>
          {items.length === 1 ? items[0].description : `${items.length} items`}
        </Text>
        {entry.hasProof && <Text style={styles.proof}>📷 Proof</Text>}
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
        <Text style={styles.headerTitle}>History</Text>
        <Text style={styles.headerSub}>Deliveries & rejections</Text>
      </View>

      <FlatList
        data={listData}
        keyExtractor={(item) => (item.type === 'day' ? `day-${item.label}` : item.entry.key)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={loadFirstPage} tintColor={Colors.primary} />
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
              <Text style={styles.emptyIcon}>{error ? '⚠️' : '🗂️'}</Text>
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
                <ActivityIndicator color={Colors.primary} />
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  headerTitle: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '700' },
  headerSub: { color: Colors.textSecondary, fontSize: FontSize.sm },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  dayTitle: {
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
    gap: Spacing.xs,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
  caseId: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  statBadge: { backgroundColor: '#7A2500', borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 2 },
  statBadgeText: { color: '#FF6B35', fontSize: FontSize.xs, fontWeight: '800', letterSpacing: 0.5 },
  kindBadge: { borderRadius: Radius.full, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 3 },
  kindDelivered: { backgroundColor: Colors.successBg, borderColor: Colors.successBorder },
  kindRejected: { backgroundColor: Colors.dangerBg, borderColor: Colors.dangerBorder },
  kindText: { fontSize: FontSize.xs, fontWeight: '600' },
  office: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '500' },
  address: { color: Colors.textSecondary, fontSize: FontSize.sm },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  itemsSummary: { color: Colors.textMuted, fontSize: FontSize.xs, flexShrink: 1 },
  proof: { color: Colors.textSecondary, fontSize: FontSize.xs, fontWeight: '500' },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '600', textAlign: 'center' },
  emptySubtitle: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
  loadMore: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  loadMoreText: { color: Colors.primaryLight, fontSize: FontSize.sm, fontWeight: '600' },
});
