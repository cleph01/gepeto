import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { SenderRole } from '@gepeto/types';
import { apiPost } from '@/lib/api';
import { dayLabel } from '@/lib/history';
import { Colors, FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// One conversation with the lab and office, for a job or a return. The screen
// that shows it loads the messages; this draws them and sends new ones.

export type ChatMessage = { id: string; senderRole: SenderRole; body: string; createdAt: string; aboutCaseId?: string | null };

// Ids for messages shown before the server confirms them.
let optimisticSeq = 0;
export const isOptimistic = (m: ChatMessage) => m.id.startsWith('optimistic-');

// iOS navigation bar height below the status bar.
const HEADER_HEIGHT = 44;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function MessageBubble({ message, isOwn, labLabel }: { message: ChatMessage; isOwn: boolean; labLabel: string }) {
  const fromOffice = message.senderRole === 'office';
  return (
    <View style={[styles.bubbleWrapper, isOwn ? styles.bubbleRight : styles.bubbleLeft]}>
      {(!isOwn || message.aboutCaseId) && (
        <View style={[styles.bubbleMeta, isOwn && styles.bubbleMetaOwn]}>
          {!isOwn && (
            <Text style={[styles.bubbleSender, fromOffice && styles.bubbleSenderOffice]}>
              {fromOffice ? 'Office' : labLabel}
            </Text>
          )}
          {message.aboutCaseId ? <Text style={styles.aboutCase}>{message.aboutCaseId}</Text> : null}
        </View>
      )}
      <View style={[styles.bubble, isOwn ? styles.bubbleDriver : styles.bubbleOther]}>
        <Text style={[styles.bubbleText, isOwn ? styles.bubbleTextOwn : styles.bubbleTextOther]}>
          {message.body}
        </Text>
      </View>
      <Text style={styles.bubbleTime}>{formatTime(message.createdAt)}</Text>
    </View>
  );
}

type ListItem = { type: 'day'; label: string } | { type: 'message'; message: ChatMessage };

export function ChatThread({
  title,
  subtitle,
  messages,
  setMessages,
  loaded,
  hideEmpty,
  sendPath,
  closedNote,
  quickReplies,
  labLabel = 'Lab',
  emptyText = 'The lab and the office both see what you send here.',
}: {
  /** Shown in the bar above the conversation, once known. */
  title?: string | null;
  subtitle?: string | null;
  messages: ChatMessage[];
  setMessages: (update: (prev: ChatMessage[]) => ChatMessage[]) => void;
  loaded: boolean;
  /** No longer this driver's, so there's nothing to invite them to say. */
  hideEmpty: boolean;
  sendPath: string;
  /** Set when messages are read-only, saying why. */
  closedNote: string | null;
  /** One tap sends these, so a driver on the road can answer without typing. */
  quickReplies: string[];
  /** What to call the lab's messages. */
  labLabel?: string;
  /** Under "No messages yet": who will see what the driver sends. */
  emptyText?: string;
}) {
  const insets = useSafeAreaInsets();
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (text: string) => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic update while the request lands
    const optimisticId = `optimistic-${++optimisticSeq}`;
    const optimistic: ChatMessage = { id: optimisticId, senderRole: 'driver', body, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);

    const res = await apiPost<ChatMessage>(sendPath, { body }).catch(() => null);
    if (res?.data) {
      // If a live update beat the response here, the real message is already in
      // the list: just drop the optimistic one (two copies = duplicate keys).
      const real = res.data;
      setMessages((prev) =>
        prev.some((m) => m.id === real.id)
          ? prev.filter((m) => m.id !== optimisticId)
          : prev.map((m) => (m.id === optimisticId ? real : m))
      );
    } else {
      // Didn't go through: take it back out and put the text back to retry.
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setMessageText(body);
    }
    setSending(false);
  };

  const sendTyped = () => {
    const text = messageText;
    setMessageText('');
    send(text);
  };

  const listData: ListItem[] = [];
  let lastDay = '';
  for (const message of messages) {
    const label = dayLabel(message.createdAt);
    if (label !== lastDay) {
      listData.push({ type: 'day', label });
      lastDay = label;
    }
    listData.push({ type: 'message', message });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + HEADER_HEIGHT : 0}
      >
        {title && (
          <View style={styles.context}>
            <Text style={styles.contextCase}>{title}</Text>
            <Text style={styles.contextOffice} numberOfLines={1}>{subtitle}</Text>
          </View>
        )}

        {listData.length > 0 ? (
          // Inverted, newest first: the list is anchored to the latest message
          // from the first frame, however long the thread.
          <FlatList
            inverted
            data={[...listData].reverse()}
            keyExtractor={(item) => (item.type === 'day' ? `day-${item.label}` : item.message.id)}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            renderItem={({ item }) =>
              item.type === 'day' ? (
                <Text style={styles.dayLabel}>{item.label}</Text>
              ) : (
                <MessageBubble message={item.message} isOwn={item.message.senderRole === 'driver'} labLabel={labLabel} />
              )
            }
          />
        ) : (
          <View style={styles.emptyWrap}>
            {!loaded ? (
              <ActivityIndicator color={Colors.accent} />
            ) : !hideEmpty ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <IconSymbol name="bubble.left.and.bubble.right.fill" size={26} color={Colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyText}>{emptyText}</Text>
              </View>
            ) : null}
          </View>
        )}

        {closedNote ? (
          <View style={styles.closedBar}>
            <Text style={styles.closedText}>{closedNote}</Text>
          </View>
        ) : (
          <View style={styles.composer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.quickRow}
            >
              {quickReplies.map((reply) => (
                <TouchableOpacity
                  key={reply}
                  style={styles.quickChip}
                  onPress={() => send(reply)}
                  disabled={sending}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityHint="Sends this message right away"
                >
                  <Text style={styles.quickText}>{reply}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Message the lab or office…"
                placeholderTextColor={Colors.textMuted}
                multiline
                // Return adds a new line; the button beside the field sends.
                submitBehavior="newline"
                accessibilityLabel="Message"
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!messageText.trim() || sending) && styles.sendBtnDisabled]}
                onPress={sendTyped}
                disabled={!messageText.trim() || sending}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Send message"
              >
                {sending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <IconSymbol name="paperplane.fill" size={20} color={messageText.trim() ? '#fff' : Colors.textMuted} />
                }
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  kav: { flex: 1 },
  context: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl - 4,
    paddingBottom: Spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contextCase: { fontFamily: Fonts.semibold, color: Colors.textSecondary, fontSize: FontSize.sm },
  contextOffice: { fontFamily: Fonts.medium, color: Colors.text, fontSize: FontSize.sm, flexShrink: 1 },
  listContent: {
    paddingHorizontal: Spacing.xl - 4,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  dayLabel: {
    alignSelf: 'center',
    fontFamily: Fonts.semibold,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginVertical: Spacing.sm,
  },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.accentBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: { fontFamily: Fonts.semibold, color: Colors.text, fontSize: FontSize.lg },
  emptyText: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 19 },

  bubbleWrapper: { maxWidth: '80%', gap: 4, marginBottom: Spacing.xs },
  bubbleRight: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleLeft: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubbleSender: { fontFamily: Fonts.semibold, color: Colors.accent, fontSize: FontSize.xs, paddingHorizontal: Spacing.sm },
  bubbleSenderOffice: { color: Colors.warning },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bubbleMetaOwn: { justifyContent: 'flex-end', paddingRight: Spacing.sm },
  aboutCase: {
    fontFamily: Fonts.medium,
    fontSize: 10,
    color: Colors.textSecondary,
    backgroundColor: Colors.cardElevated,
    borderRadius: 4,
    paddingHorizontal: 5,
    overflow: 'hidden',
  },
  bubble: { borderRadius: 18, paddingHorizontal: Spacing.md + 2, paddingVertical: Spacing.sm + 2 },
  bubbleDriver: { backgroundColor: Colors.primary, borderBottomRightRadius: Radius.sm },
  bubbleOther: {
    backgroundColor: Colors.cardElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: Radius.sm,
  },
  bubbleText: { fontFamily: Fonts.regular, fontSize: FontSize.md, lineHeight: 21 },
  bubbleTextOwn: { color: '#fff' },
  bubbleTextOther: { color: Colors.text },
  bubbleTime: { fontFamily: Fonts.regular, color: Colors.textMuted, fontSize: FontSize.xs, paddingHorizontal: Spacing.sm },

  composer: {
    borderTopWidth: 1,
    borderTopColor: Colors.tabBarBorder,
    backgroundColor: Colors.tabBar,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.sm + 2,
    gap: Spacing.sm + 2,
  },
  quickRow: { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  quickChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md + 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentBg,
  },
  quickText: { fontFamily: Fonts.medium, color: Colors.accent, fontSize: FontSize.sm },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  input: {
    fontFamily: Fonts.regular,
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: 11,
    paddingBottom: 11,
    minHeight: 44,
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Stays clearly visible while empty, so drivers know where Send is.
  sendBtnDisabled: { backgroundColor: Colors.cardElevated, borderWidth: 1, borderColor: Colors.borderStrong },
  closedBar: {
    borderTopWidth: 1,
    borderTopColor: Colors.tabBarBorder,
    backgroundColor: Colors.tabBar,
    padding: Spacing.lg,
  },
  closedText: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
});
