import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

const FADE_MS = 200;
const VISIBLE_MS = 2000; // fades included

/**
 * Confirms a delivery went through. Render it last inside a screen's root view.
 * Set `overHomeIndicator` on screens with no tab bar beneath them.
 */
export function DeliveredToast({
  message,
  onDone,
  overHomeIndicator = false,
}: {
  message: string;
  onDone: () => void;
  overHomeIndicator?: boolean;
}) {
  const [opacity] = useState(() => new Animated.Value(0));
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    const animation = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.delay(VISIBLE_MS - FADE_MS * 2),
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => { if (finished) onDone(); });
    return () => animation.stop();
  }, [message, onDone, opacity]);

  return (
    <Animated.View
      style={[styles.toast, { opacity, bottom: Spacing.lg + (overHomeIndicator ? insets.bottom : 0) }]}
      pointerEvents="none"
    >
      <IconSymbol name="checkmark" size={16} color={Colors.success} />
      <Text style={styles.text} numberOfLines={2}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    backgroundColor: Colors.successBg,
  },
  text: {
    flex: 1,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    fontSize: FontSize.sm,
  },
});
