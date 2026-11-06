import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Colors, Fonts, FontSize, Radius, Spacing } from '@/constants/theme';

// Renders the guide's small Markdown set: "## " headings, "- " bullets,
// "1. " steps, "> " callouts, **bold** and [links](/help/slug).
export function HelpBody({ body }: { body: string }) {
  const router = useRouter();

  const inline = (text: string): ReactNode[] =>
    text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
      if (part.startsWith('**')) return <Text key={i} style={styles.bold}>{part.slice(2, -2)}</Text>;
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (!link) return part;
      return (
        <Text key={i} style={styles.link} accessibilityRole="link" onPress={() => router.push(link[2] as Href)}>
          {link[1]}
        </Text>
      );
    });

  const lines = body.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;

  const listRows = (marker: RegExp, prefix: (n: number) => string) => {
    const rows: ReactNode[] = [];
    while (i < lines.length && marker.test(lines[i])) {
      rows.push(
        <View key={rows.length} style={styles.row}>
          <Text style={styles.marker}>{prefix(rows.length)}</Text>
          <Text style={[styles.text, styles.rowText]}>{inline(lines[i].replace(marker, ''))}</Text>
        </View>
      );
      i++;
    }
    return rows;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
    } else if (line.startsWith('## ')) {
      blocks.push(<Text key={i} style={styles.heading} accessibilityRole="header">{line.slice(3).trim()}</Text>);
      i++;
    } else if (/^\d+\. /.test(line)) {
      const start = i;
      blocks.push(<View key={start} style={styles.list}>{listRows(/^\d+\. /, (n) => `${n + 1}.`)}</View>);
    } else if (line.startsWith('- ')) {
      const start = i;
      blocks.push(<View key={start} style={styles.list}>{listRows(/^- /, () => '•')}</View>);
    } else if (line.startsWith('> ')) {
      blocks.push(
        <View key={i} style={styles.note}>
          <Text style={styles.noteText}>{inline(line.slice(2))}</Text>
        </View>
      );
      i++;
    } else {
      blocks.push(<Text key={i} style={styles.text}>{inline(line)}</Text>);
      i++;
    }
  }

  return <View style={styles.body}>{blocks}</View>;
}

const styles = StyleSheet.create({
  body: { gap: Spacing.md },
  text: { fontFamily: Fonts.regular, color: Colors.textLabel, fontSize: FontSize.md, lineHeight: 23 },
  bold: { fontFamily: Fonts.semibold, color: Colors.text },
  link: { fontFamily: Fonts.medium, color: Colors.accent, textDecorationLine: 'underline' },
  heading: { fontFamily: Fonts.semibold, color: Colors.text, fontSize: FontSize.lg, marginTop: Spacing.md },
  list: { gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  marker: { fontFamily: Fonts.semibold, color: Colors.accent, fontSize: FontSize.md, lineHeight: 23, minWidth: 18 },
  rowText: { flex: 1 },
  note: {
    backgroundColor: Colors.accentBg,
    borderColor: Colors.accentBorder,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  noteText: { fontFamily: Fonts.regular, color: Colors.accentText, fontSize: FontSize.sm, lineHeight: 20 },
});
