import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiGet } from '@/lib/api';
import { dayLabel, timeLabel, type ReturnedCases } from '@/lib/history';
import { casesLabel, countDiffers, returnLabel } from '@/lib/returns';
import { Colors, FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

const when = (iso: string) => `${dayLabel(iso)} at ${timeLabel(iso)}`;

// Read-only summary of a return the lab has checked in.
export default function ReturnedCasesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ret, setRet] = useState<ReturnedCases | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<ReturnedCases>(`/api/driver/history/returns/${id}`)
      .then((res) => {
        if (res.data) setRet(res.data);
        else setError(res.error?.message ?? "Couldn't load this return.");
      })
      .catch(() => setError("Couldn't load this return. Check your connection."));
  }, [id]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  if (!ret) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} />
      </View>
    );
  }

  const differs = countDiffers(ret);
  const tone = differs
    ? { bg: Colors.warningBg, border: Colors.warningBorder, ink: Colors.warning }
    : { bg: Colors.successBg, border: Colors.successBorder, ink: Colors.success };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <Text style={styles.label}>{returnLabel(ret)}</Text>
        <Text style={styles.title} accessibilityRole="header">{ret.officeName ?? 'Office'}</Text>
        {ret.officeAddress && <Text style={styles.address}>{ret.officeAddress}</Text>}
      </View>

      <View style={[styles.outcome, { backgroundColor: tone.bg, borderColor: tone.border }]}>
        <View style={[styles.outcomeIcon, { backgroundColor: tone.border }]}>
          <IconSymbol name={differs ? 'exclamationmark.triangle' : 'checkmark'} size={20} color="#FFFFFF" />
        </View>
        <View style={styles.outcomeBody}>
          <Text style={[styles.outcomeTitle, { color: tone.ink }]}>
            {differs ? `Lab counted ${ret.receivedCount}, you logged ${ret.caseCount}` : `${casesLabel(ret.caseCount)} checked in`}
          </Text>
          <Text style={styles.outcomeSub}>
            {differs
              ? 'The difference is on the return\'s record. Talk to the front desk if this doesn\'t look right.'
              : 'The lab received everything you logged.'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>Timeline</Text>
        {ret.pickedUpAt && <Fact label="Picked up" value={when(ret.pickedUpAt)} />}
        {ret.droppedAt && <Fact label="Dropped at lab" value={when(ret.droppedAt)} />}
        <Fact label="Checked in" value={when(ret.checkedInAt)} />
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>Cases</Text>
        {ret.caseId && <Fact label="Lab case number" value={ret.caseId} />}
        {ret.caseNumbers.length > 0 && <Fact label="Case numbers" value={ret.caseNumbers.join(', ')} />}
        <Fact label="Cases logged" value={String(ret.caseCount)} />
        {ret.note && <Fact label="Note" value={ret.note} />}
      </View>

      <TouchableOpacity
        style={styles.messages}
        onPress={() => router.push(`/return-chat/${ret.id}`)}
        activeOpacity={0.75}
        accessibilityRole="button"
      >
        <IconSymbol name="bubble.left.and.bubble.right.fill" size={18} color={Colors.accent} />
        <Text style={styles.messagesText}>View messages</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.xl - 4, paddingTop: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },
  center: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  errorText: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSize.md, textAlign: 'center' },
  summary: { gap: Spacing.xs, marginBottom: Spacing.xs },
  label: { fontFamily: Fonts.semibold, color: Colors.textSecondary, fontSize: FontSize.sm },
  title: { fontFamily: Fonts.bold, color: Colors.text, fontSize: FontSize.xxl, letterSpacing: -0.5 },
  address: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSize.sm },
  outcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  outcomeIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeBody: { flex: 1, gap: 2 },
  outcomeTitle: { fontFamily: Fonts.semibold, fontSize: FontSize.lg },
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
  fact: { gap: 2 },
  factLabel: { fontFamily: Fonts.medium, color: Colors.textMuted, fontSize: 12 },
  value: { fontFamily: Fonts.regular, color: Colors.text, fontSize: FontSize.md, lineHeight: 21 },
  messages: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    backgroundColor: Colors.card,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  messagesText: { fontFamily: Fonts.semibold, color: Colors.accent, fontSize: FontSize.md },
});
