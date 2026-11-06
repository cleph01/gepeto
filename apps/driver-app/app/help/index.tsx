import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { useHelp } from '@/lib/help';

export default function HelpScreen() {
  const router = useRouter();
  const { manual, failed, retry } = useHelp();

  if (!manual) {
    return (
      <View style={styles.center}>
        {failed ? (
          <>
            <Text style={styles.message}>Help couldn&apos;t load. Check your signal and try again.</Text>
            <TouchableOpacity style={styles.retry} onPress={retry} accessibilityRole="button">
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color={Colors.accent} accessibilityLabel="Loading help" />
        )}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {manual.sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionLabel} accessibilityRole="header">{section.title}</Text>
          <View style={styles.card}>
            {section.articles.map((article, i) => (
              <TouchableOpacity
                key={article.slug}
                style={[styles.row, i > 0 && styles.rowDivider]}
                onPress={() => router.push(`/help/${article.slug}` as Href)}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <View style={styles.rowText}>
                  <Text style={styles.title}>{article.title}</Text>
                  <Text style={styles.summary}>{article.summary}</Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg },
  message: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },
  retry: {
    minHeight: 44,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
  },
  retryText: { fontFamily: Fonts.semibold, color: Colors.text, fontSize: FontSize.md },
  content: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: Spacing.xxl },
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontFamily: Fonts.semibold,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, minHeight: 44 },
  rowDivider: { borderTopWidth: 1, borderTopColor: Colors.border },
  rowText: { flex: 1, gap: 2 },
  title: { fontFamily: Fonts.semibold, color: Colors.text, fontSize: FontSize.md },
  summary: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 18 },
});
