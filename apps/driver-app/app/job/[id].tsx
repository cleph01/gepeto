import { useEffect, useRef, useState } from 'react';
import { rowToCamel } from '@/lib/transform';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Job, JobStatus, Message } from '@gepeto/types';
import { supabase } from '@/lib/supabase';
import { apiPatch, apiPost } from '@/lib/api';
import { useAuth } from '@/context/auth';
import { navigate } from '@/lib/navigation';
import {
  Colors,
  FlagColors,
  FlagLabels,
  FontSize,
  Radius,
  Spacing,
  StatusColors,
  StatusLabels,
} from '@/constants/theme';


const STATUS_PROGRESSION: Partial<Record<JobStatus, JobStatus>> = {
  picked_up:  'in_transit',
  in_transit: 'arrived',
};

const NEXT_ACTION_LABEL: Partial<Record<JobStatus, string>> = {
  picked_up:  'Mark En Route',
  in_transit: 'Mark Arrived',
  arrived:    'Proof of Delivery',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.sectionCard}>{children}</View>;
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <View style={[styles.bubbleWrapper, isOwn ? styles.bubbleRight : styles.bubbleLeft]}>
      {!isOwn && (
        <Text style={styles.bubbleSender}>
          {message.senderRole === 'dispatcher' ? 'Lab' : 'Office'}
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

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { session } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const listRef = useRef<FlatList>(null);
  const driverId = session?.user.user_metadata?.driver_id as string | undefined;

  // Set nav title to case ID
  useEffect(() => {
    if (job) navigation.setOptions({ title: job.caseId });
  }, [job?.caseId]);

  // Fetch job
  useEffect(() => {
    if (!id) return;
    supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setJob(rowToCamel<Job>(data));
      });
  }, [id]);

  // Fetch messages
  useEffect(() => {
    if (!id) return;
    supabase
      .from('messages')
      .select('*')
      .eq('job_id', id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setMessages(data.map((row) => rowToCamel<Message>(row)));
          setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
        }
      });
  }, [id]);

  // Realtime — job updates + new messages
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`job-${id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `id=eq.${id}`,
      }, (payload) => {
        setJob(rowToCamel<Job>(payload.new as Record<string, unknown>));
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `job_id=eq.${id}`,
      }, (payload) => {
        const msg = rowToCamel<Message>(payload.new as Record<string, unknown>);
        setMessages((prev) => {
          // Avoid duplicating optimistic messages by checking id
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const handleAccept = async () => {
    if (!job) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const res = await apiPatch<Job>(`/api/jobs/${job.id}/response`, { driverResponse: 'accepted' });
    if (res.data) setJob(res.data);
  };

  const handleReject = () => {
    Alert.alert(
      'Reject this job?',
      'The dispatcher will be notified and will need to reassign.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            if (!job) return;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            // API resets status to 'pending' and clears driver_id so the dispatcher can reassign
            const res = await apiPatch<Job>(`/api/jobs/${job.id}/response`, { driverResponse: 'rejected' });
            if (res.data) setJob(res.data);
          },
        },
      ]
    );
  };

  const handleStatusAdvance = async () => {
    if (!job) return;

    if (job.status === 'arrived') {
      Alert.alert('Coming soon', 'Proof of delivery capture is in Phase 3.');
      return;
    }

    const nextStatus = STATUS_PROGRESSION[job.status];
    if (!nextStatus) return;

    setUpdatingStatus(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await apiPatch<Job>(`/api/jobs/${job.id}/status`, { status: nextStatus });
    if (res.data) setJob(res.data);
    setUpdatingStatus(false);
  };

  const handleMarkPickedUp = async () => {
    if (!job) return;
    setUpdatingStatus(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await apiPatch<Job>(`/api/jobs/${job.id}/status`, { status: 'picked_up' });
    if (res.data) setJob(res.data);
    setUpdatingStatus(false);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !job) return;
    setSendingMessage(true);
    const body = messageText.trim();
    setMessageText('');

    // Optimistic update while the request lands
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      jobId: job.id,
      senderRole: 'driver',
      senderId: driverId ?? null,
      officeToken: null,
      body,
      createdAt: new Date().toISOString(),
      readAt: null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    const res = await apiPost<Message>(`/api/jobs/${job.id}/messages`, { body });

    if (res.data) {
      // Replace the optimistic entry with the real server message so the
      // incoming Realtime event (which carries the same UUID) gets deduped.
      setMessages((prev) => prev.map((m) => (m.id === optimisticId ? res.data! : m)));
    }

    setSendingMessage(false);
  };

  if (!job) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const isPendingResponse = job.driverResponse === 'pending' && job.status === 'assigned';
  const isAccepted = job.driverResponse === 'accepted';
  const isDelivered = job.status === 'delivered';
  const isRejected = job.status === 'rejected' || job.driverResponse === 'rejected';
  const showPickUpButton = isAccepted && job.status === 'assigned';
  const showAdvanceButton = isAccepted && !!STATUS_PROGRESSION[job.status] || job.status === 'arrived';
  const statusColor = StatusColors[job.status];

  // FlatList data: header + messages
  type ListItem =
    | { type: 'header' }
    | { type: 'message'; message: Message }
    | { type: 'messages_empty' };

  const listData: ListItem[] = [
    { type: 'header' },
    ...(messages.length === 0
      ? [{ type: 'messages_empty' as const }]
      : messages.map((m) => ({ type: 'message' as const, message: m }))),
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={listData}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => {
            if (messages.length > 0) listRef.current?.scrollToEnd({ animated: false });
          }}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.headerContent}>
                  {/* Status + priority row */}
                  <View style={styles.topRow}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor.bg, borderColor: statusColor.border }]}>
                      <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>
                        {StatusLabels[job.status]}
                      </Text>
                    </View>
                    {job.priority === 'stat' && (
                      <View style={styles.statBadge}>
                        <Text style={styles.statBadgeText}>STAT</Text>
                      </View>
                    )}
                  </View>

                  {/* Accept / Reject buttons */}
                  {isPendingResponse && (
                    <SectionCard>
                      <Text style={styles.responsePrompt}>
                        New job assigned — accept or reject?
                      </Text>
                      <View style={styles.responseButtons}>
                        <TouchableOpacity
                          style={[styles.responseBtn, styles.rejectBtn]}
                          onPress={handleReject}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.rejectBtnText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.responseBtn, styles.acceptBtn]}
                          onPress={handleAccept}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        </TouchableOpacity>
                      </View>
                    </SectionCard>
                  )}

                  {/* Status action button */}
                  {showPickUpButton && (
                    <TouchableOpacity
                      style={[styles.actionBtn, updatingStatus && styles.actionBtnDisabled]}
                      onPress={handleMarkPickedUp}
                      disabled={updatingStatus}
                      activeOpacity={0.8}
                    >
                      {updatingStatus
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.actionBtnText}>Mark Picked Up</Text>
                      }
                    </TouchableOpacity>
                  )}

                  {showAdvanceButton && !showPickUpButton && (
                    <TouchableOpacity
                      style={[styles.actionBtn, updatingStatus && styles.actionBtnDisabled]}
                      onPress={handleStatusAdvance}
                      disabled={updatingStatus}
                      activeOpacity={0.8}
                    >
                      {updatingStatus
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.actionBtnText}>{NEXT_ACTION_LABEL[job.status]}</Text>
                      }
                    </TouchableOpacity>
                  )}

                  {isDelivered && (
                    <View style={[styles.actionBtn, { backgroundColor: Colors.successBg, borderColor: Colors.successBorder, borderWidth: 1 }]}>
                      <Text style={[styles.actionBtnText, { color: Colors.success }]}>Delivered ✓</Text>
                    </View>
                  )}

                  {isRejected && (
                    <View style={[styles.actionBtn, { backgroundColor: Colors.dangerBg, borderColor: Colors.dangerBorder, borderWidth: 1 }]}>
                      <Text style={[styles.actionBtnText, { color: Colors.danger }]}>Job Rejected</Text>
                    </View>
                  )}

                  {/* Delivery section */}
                  <SectionCard>
                    <SectionHeader title="Delivery" />
                    <Text style={styles.addressLabel}>To</Text>
                    <Text style={styles.addressText}>{job.deliveryAddress}</Text>
                    {!isDelivered && !isRejected && (
                      <TouchableOpacity
                        style={styles.navigateBtn}
                        onPress={() => navigate({ address: job.deliveryAddress })}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.navigateBtnText}>Navigate</Text>
                      </TouchableOpacity>
                    )}
                  </SectionCard>

                  {/* Case info */}
                  <SectionCard>
                    <SectionHeader title="Case Info" />
                    {job.items.map((item, i) => (
                      <View key={i} style={styles.itemRow}>
                        <View style={styles.itemLeft}>
                          <Text style={styles.itemDescription}>{item.description}</Text>
                          <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                        </View>
                        {item.flags.length > 0 && (
                          <View style={styles.flagsRow}>
                            {item.flags.map((flag) => (
                              <View
                                key={flag}
                                style={[styles.flag, { backgroundColor: FlagColors[flag].bg }]}
                              >
                                <Text style={[styles.flagText, { color: FlagColors[flag].text }]}>
                                  {FlagLabels[flag]}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                        {i < job.items.length - 1 && <View style={styles.itemDivider} />}
                      </View>
                    ))}
                  </SectionCard>

                  {/* Messages section header */}
                  <SectionHeader title="Messages" />
                </View>
              );
            }

            if (item.type === 'messages_empty') {
              return (
                <Text style={styles.messagesEmpty}>
                  No messages yet. Start the conversation.
                </Text>
              );
            }

            return (
              <MessageBubble
                message={item.message}
                isOwn={item.message.senderRole === 'driver'}
              />
            );
          }}
        />

        {/* Message input */}
        {!isDelivered && !isRejected && (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Message the lab or office…"
              placeholderTextColor={Colors.textMuted}
              multiline
              returnKeyType="send"
              onSubmitEditing={handleSendMessage}
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!messageText.trim() || sendingMessage) && styles.sendBtnDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || sendingMessage}
              activeOpacity={0.8}
            >
              {sendingMessage
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.sendBtnText}>Send</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  kav: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerContent: {
    gap: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  statusBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  statusBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  statBadge: {
    backgroundColor: '#7A2500',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  statBadgeText: {
    color: '#FF6B35',
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  responsePrompt: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    textAlign: 'center',
  },
  responseButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  responseBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: Colors.dangerBg,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
  },
  rejectBtnText: {
    color: Colors.danger,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  acceptBtn: {
    backgroundColor: Colors.primary,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  actionBtn: {
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  addressLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressText: {
    color: Colors.text,
    fontSize: FontSize.md,
  },
  navigateBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  navigateBtnText: {
    color: Colors.primaryLight,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  itemRow: {
    gap: Spacing.sm,
  },
  itemLeft: {
    gap: 2,
  },
  itemDescription: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  itemQty: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  flagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  flag: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  flagText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  itemDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: Spacing.sm,
  },
  messagesEmpty: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
  },
  bubbleWrapper: {
    maxWidth: '78%',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  bubbleRight: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleLeft: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubbleSender: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    paddingHorizontal: Spacing.sm,
  },
  bubble: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  bubbleDriver: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: Radius.sm,
  },
  bubbleOther: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: Radius.sm,
  },
  bubbleText: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  bubbleTextOwn: {
    color: '#fff',
  },
  bubbleTextOther: {
    color: Colors.text,
  },
  bubbleTime: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    paddingHorizontal: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: FontSize.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
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
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
});
