import { useCallback, useEffect, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Job, Message } from '@gepeto/types';
import { supabase, channelName } from '@/lib/supabase';
import { rowToCamel } from '@/lib/transform';
import { apiPost } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { useMessages } from '@/context/messages';
import { getDriverId } from '@/lib/driver';
import { dayLabel } from '@/lib/history';
import { Colors, FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// One tap sends these, so a driver on the road can answer without typing.
const QUICK_REPLIES = ['On my way', 'Running ~10 min late', 'Left at front desk', 'Call me'];

// Ids for messages shown before the server confirms them.
let optimisticSeq = 0;

// iOS navigation bar height below the status bar.
const HEADER_HEIGHT = 44;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const fromOffice = message.senderRole === 'office';
  return (
    <View style={[styles.bubbleWrapper, isOwn ? styles.bubbleRight : styles.bubbleLeft]}>
      {!isOwn && (
        <Text style={[styles.bubbleSender, fromOffice && styles.bubbleSenderOffice]}>
          {fromOffice ? 'Office' : 'Lab'}
        </Text>
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

type ListItem = { type: 'day'; label: string } | { type: 'message'; message: Message };

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const driverId = getDriverId(session);
  const { setActiveChat, markRead } = useMessages();

  const [job, setJob] = useState<Job | null>(null);
  const [jobMissing, setJobMissing] = useState(false);
  const [officeName, setOfficeName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // While this screen is in front, new messages here count as read.
  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      setActiveChat(id);
      return () => setActiveChat(null);
    }, [id, setActiveChat])
  );

  useEffect(() => {
    if (!id) return;
    supabase
      .from('jobs')
      .select('*, offices(name)')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) {
          // Rejected or reassigned: row-level security hides it now.
          setJobMissing(true);
          return;
        }
        setJob(rowToCamel<Job>(data));
        setOfficeName((data.offices as { name?: string } | null)?.name ?? null);
      });

    supabase
      .from('messages')
      .select('*')
      .eq('job_id', id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setMessages(data.map((row) => rowToCamel<Message>(row)));
        setLoaded(true);
      });

    const channel = supabase
      .channel(channelName(`chat-${id}`))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${id}` }, (payload) => {
        setJob(rowToCamel<Job>(payload.new as Record<string, unknown>));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `job_id=eq.${id}` }, (payload) => {
        const msg = rowToCamel<Message>(payload.new as Record<string, unknown>);
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (msg.senderRole !== 'driver') Haptics.selectionAsync();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Everything on screen has been seen: mark read up to the newest message.
  // Skips the optimistic copy, whose time is the phone's clock, not the server's.
  const newestAt = messages.findLast((m) => !m.id.startsWith('optimistic-'))?.createdAt ?? null;
  useEffect(() => {
    if (id && newestAt) markRead(id, newestAt);
  }, [id, newestAt, markRead]);

  const send = async (text: string) => {
    const body = text.trim();
    if (!body || !id || sending) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Optimistic update while the request lands
    const optimisticId = `optimistic-${++optimisticSeq}`;
    const optimistic: Message = {
      id: optimisticId,
      jobId: id,
      senderRole: 'driver',
      senderId: driverId ?? null,
      officeToken: null,
      body,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setMessages((prev) => [...prev, optimistic]);

    const res = await apiPost<Message>(`/api/jobs/${id}/messages`, { body });
    if (res.data) {
      // If Realtime beat the response here, the real message is already in
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

  const closed = jobMissing || job?.status === 'delivered' || job?.driverResponse === 'rejected';
  const closedNote = jobMissing
    ? "This job isn't yours anymore, so its messages are hidden."
    : 'This job is delivered. Messages are read-only.';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + HEADER_HEIGHT : 0}
      >
        {job && (
          <View style={styles.context}>
            <Text style={styles.contextCase}>{job.caseId}</Text>
            <Text style={styles.contextOffice} numberOfLines={1}>{officeName ?? job.deliveryAddress}</Text>
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
                <MessageBubble message={item.message} isOwn={item.message.senderRole === 'driver'} />
              )
            }
          />
        ) : (
          <View style={styles.emptyWrap}>
            {!loaded ? (
              <ActivityIndicator color={Colors.accent} />
            ) : !jobMissing ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}>
                  <IconSymbol name="bubble.left.and.bubble.right.fill" size={26} color={Colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptyText}>The lab and the office both see what you send here.</Text>
              </View>
            ) : null}
          </View>
        )}

        {closed ? (
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
              {QUICK_REPLIES.map((reply) => (
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
