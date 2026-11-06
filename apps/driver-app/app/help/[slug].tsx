import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { HelpBody } from '@/components/help-body';
import { Colors, Fonts, FontSize, Radius, Spacing } from '@/constants/theme';
import { allArticles, useHelp } from '@/lib/help';

export default function HelpArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
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

  const articles = allArticles(manual);
  const article = articles.find((a) => a.slug === slug);
  if (!article) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>We couldn&apos;t find that help topic.</Text>
      </View>
    );
  }

  const related = article.related
    .map((relatedSlug) => articles.find((a) => a.slug === relatedSlug))
    .filter((a) => a !== undefined);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title} accessibilityRole="header">{article.title}</Text>
      <HelpBody body={article.body} />
      {related.length > 0 && (
        <View style={styles.related}>
          <Text style={styles.relatedLabel} accessibilityRole="header">Related topics</Text>
          {related.map((a) => (
            <TouchableOpacity
              key={a.slug}
              style={styles.relatedRow}
              onPress={() => router.push(`/help/${a.slug}` as Href)}
              accessibilityRole="link"
            >
              <Text style={styles.relatedText}>{a.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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
  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  title: { fontFamily: Fonts.bold, color: Colors.text, fontSize: FontSize.xxl, letterSpacing: -0.5 },
  related: { gap: Spacing.xs, marginTop: Spacing.md, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  relatedLabel: { fontFamily: Fonts.semibold, color: Colors.text, fontSize: FontSize.md },
  relatedRow: { minHeight: 44, justifyContent: 'center' },
  relatedText: { fontFamily: Fonts.medium, color: Colors.accent, fontSize: FontSize.md, textDecorationLine: 'underline' },
});
