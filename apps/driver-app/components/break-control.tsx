import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, FontSize, Fonts, Radius, Spacing } from '@/constants/theme';

/** "Take a break" button, or while on one, the banner with "End break". */
export function BreakControl({
  since,
  busy,
  onChange,
}: {
  since: string | null;
  busy: boolean;
  onChange: (onBreak: boolean) => Promise<boolean>;
}) {
  const change = async (onBreak: boolean) => {
    Haptics.selectionAsync();
    if (await onChange(onBreak)) return;
    Alert.alert(
      onBreak ? "Your break didn't start" : "Your break didn't end",
      onBreak
        ? 'Your location is still being shared. Check your signal and try again.'
        : 'Your location is still paused. Check your signal and try again.'
    );
  };

  if (!since) {
    return (
      <TouchableOpacity
        style={styles.startBtn}
        onPress={() => change(true)}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityHint="Pauses your location until you end the break"
      >
        {busy ? <ActivityIndicator size="small" color={Colors.textSecondary} /> : <IconSymbol name="pause.circle" size={18} color={Colors.textSecondary} />}
        <Text style={styles.startText}>Take a break</Text>
      </TouchableOpacity>
    );
  }

  const time = new Date(since).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <View style={styles.bannerText}>
        <IconSymbol name="pause.circle" size={20} color={Colors.warning} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>On break since {time}</Text>
          <Text style={styles.body}>
            Your location is paused. The lab and offices can&apos;t see where you are until you end your break.
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.endBtn}
        onPress={() => change(false)}
        disabled={busy}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityHint="Starts sharing your location again"
      >
        {busy ? <ActivityIndicator size="small" color={Colors.text} /> : <Text style={styles.endText}>End break</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  startText: {
    fontFamily: Fonts.semibold,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  banner: {
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    backgroundColor: Colors.warningBg,
  },
  bannerText: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  title: {
    fontFamily: Fonts.semibold,
    color: Colors.warningText,
    fontSize: FontSize.md,
  },
  body: {
    fontFamily: Fonts.regular,
    color: Colors.warningText,
    fontSize: FontSize.sm,
    lineHeight: 19,
    marginTop: 2,
  },
  endBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
  },
  endText: {
    fontFamily: Fonts.semibold,
    color: Colors.text,
    fontSize: FontSize.md,
  },
});
