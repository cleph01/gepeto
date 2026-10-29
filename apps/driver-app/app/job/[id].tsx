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
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Job, JobStatus, Message } from '@gepeto/types';
import { supabase, channelName } from '@/lib/supabase';
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
  Fonts,
} from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { forgetJob } from '@/components/job-alerts';
import { getDriverId } from '@/lib/driver';
import { STEPS, dueInfo } from '@/lib/jobs';

const STATUS_PROGRESSION: Partial<Record<JobStatus, JobStatus>> = {
  picked_up:  'in_transit',
  in_transit: 'arrived',
};

// The one big button for each step, with a line telling the driver when to tap it.
const NEXT_ACTION: Partial<Record<JobStatus, { label: string; hint: string }>> = {
  assigned:   { label: 'Mark picked up',    hint: 'Tap once the case is in your hands.' },
  picked_up:  { label: 'Mark en route',     hint: 'Tap when you start driving to the office.' },
  in_transit: { label: 'Mark arrived',      hint: 'Tap when you reach the office.' },
  arrived:    { label: 'Complete delivery', hint: "You'll enter who received it." },
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

function Eyebrow({ title }: { title: string }) {
  return <Text style={styles.eyebrow}>{title}</Text>;
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

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { session } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [officeName, setOfficeName] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showPod, setShowPod] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [submittingPod, setSubmittingPod] = useState(false);

  const listRef = useRef<FlatList>(null);
  const driverId = getDriverId(session);

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

  // Office name, re-read when dispatch moves the job to another office
  useEffect(() => {
    if (!job?.officeId) return;
    supabase
      .from('offices')
      .select('name')
      .eq('id', job.officeId)
      .maybeSingle()
      .then(({ data }) => setOfficeName((data?.name as string | undefined) ?? null));
  }, [job?.officeId]);

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
      .channel(channelName(`job-${id}`))
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
            if (res.data) {
              setJob(res.data);
              forgetJob(job.id);
            }
          },
        },
      ]
    );
  };

  const handleStatusAdvance = async () => {
    if (!job) return;

    if (job.status === 'arrived') {
      setRecipientName('');
      setShowPod(true);
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

  const handleConfirmDelivery = async () => {
    if (!job || !recipientName.trim()) return;
    setSubmittingPod(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const res = await apiPatch<Job>(`/api/jobs/${job.id}/status`, {
      status: 'delivered',
      proofOfDelivery: {
        recipientName: recipientName.trim(),
        timestamp: new Date().toISOString(),
      },
    });
    setSubmittingPod(false);
    if (res.data) {
      setJob(res.data);
      setShowPod(false);
    }
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
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.accent} />
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
  const nextAction = showPickUpButton || showAdvanceButton ? NEXT_ACTION[job.status] : undefined;
  const statusColor = StatusColors[job.status];
  const due = dueInfo(job);
  const step = isRejected ? -1 : STEPS.findIndex((s) => s.status === job.status);
  const deliveredAt = job.deliveredAt ?? job.updatedAt;

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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={listData}
          keyExtractor={(item, i) => (item.type === 'message' ? item.message.id : `${item.type}-${i}`)}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => {
            if (messages.length > 0) listRef.current?.scrollToEnd({ animated: false });
          }}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.headerContent}>
                  {/* Summary: who, when, where it stands */}
                  <View style={styles.summary}>
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
                    <Text style={styles.title} accessibilityRole="header">{officeName ?? job.deliveryAddress}</Text>
                    {due && (
                      <View style={styles.metaRow}>
                        <IconSymbol
                          name="clock"
                          size={16}
                          color={due.tone === 'late' ? Colors.danger : due.tone === 'soon' ? Colors.warning : Colors.textSecondary}
                        />
                        <Text style={[styles.metaText, due.tone === 'late' && styles.dueLate, due.tone === 'soon' && styles.dueSoon]}>
                          {due.text}
                        </Text>
                      </View>
                    )}
                    {step >= 0 && !isDelivered && (
                      <View accessibilityLabel={`Step ${step + 1} of 4: ${STEPS[step].label}`}>
                        <View style={styles.progressTrack}>
                          {STEPS.map((s, i) => (
                            <View key={s.status} style={[styles.progressSeg, i <= step && styles.progressSegDone]} />
                          ))}
                        </View>
                        <View style={styles.progressLabels}>
                          {STEPS.map((s, i) => (
                            <Text key={s.status} style={[styles.progressLabel, i === step && styles.progressLabelCurrent]}>
                              {s.label}
                            </Text>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Accept / Reject */}
                  {isPendingResponse && (
                    <View style={[styles.sectionCard, styles.responseCard]}>
                      <Text style={styles.responsePrompt}>New job for you. Accept or reject?</Text>
                      <View style={styles.responseButtons}>
                        <TouchableOpacity
                          style={[styles.responseBtn, styles.rejectBtn]}
                          onPress={handleReject}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                        >
                          <Text style={styles.rejectBtnText}>Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.responseBtn, styles.acceptBtn]}
                          onPress={handleAccept}
                          activeOpacity={0.8}
                          accessibilityRole="button"
                        >
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* The next step, front and center */}
                  {nextAction && (
                    <View style={styles.nextStep}>
                      <TouchableOpacity
                        style={[styles.actionBtn, job.status === 'arrived' && styles.actionBtnFinish, updatingStatus && styles.actionBtnDisabled]}
                        onPress={showPickUpButton ? handleMarkPickedUp : handleStatusAdvance}
                        disabled={updatingStatus}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityHint={nextAction.hint}
                      >
                        {updatingStatus
                          ? <ActivityIndicator color={job.status === 'arrived' ? Colors.successInk : '#fff'} />
                          : <Text style={[styles.actionBtnText, job.status === 'arrived' && styles.actionBtnTextFinish]}>{nextAction.label}</Text>
                        }
                      </TouchableOpacity>
                      <Text style={styles.nextHint}>{nextAction.hint}</Text>
                    </View>
                  )}

                  {isDelivered && (
                    <View style={[styles.outcome, styles.outcomeDelivered]}>
                      <View style={[styles.outcomeIcon, { backgroundColor: Colors.successBorder }]}>
                        <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
                      </View>
                      <View style={styles.outcomeBody}>
                        <Text style={[styles.outcomeTitle, { color: Colors.success }]}>Delivered</Text>
                        {deliveredAt && <Text style={styles.outcomeSub}>{formatTime(deliveredAt)}</Text>}
                      </View>
                    </View>
                  )}

                  {isRejected && (
                    <View style={[styles.outcome, styles.outcomeRejected]}>
                      <View style={[styles.outcomeIcon, { backgroundColor: Colors.dangerBorder }]}>
                        <IconSymbol name="xmark" size={20} color="#FFFFFF" />
                      </View>
                      <View style={styles.outcomeBody}>
                        <Text style={[styles.outcomeTitle, { color: Colors.danger }]}>You rejected this job</Text>
                        <Text style={styles.outcomeSub}>It went back to dispatch to be reassigned.</Text>
                      </View>
                    </View>
                  )}

                  {/* Where it's going */}
                  <SectionCard>
                    <Eyebrow title="Deliver to" />
                    {officeName && <Text style={styles.cardTitle}>{officeName}</Text>}
                    <View style={styles.metaRow}>
                      <IconSymbol name="mappin.and.ellipse" size={16} color={Colors.textSecondary} />
                      <Text style={styles.addressText}>{job.deliveryAddress}</Text>
                    </View>
                    {!isDelivered && !isRejected && (
                      <TouchableOpacity
                        style={styles.navigateBtn}
                        onPress={() => navigate({ address: job.deliveryAddress })}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                      >
                        <IconSymbol name="mappin.and.ellipse" size={18} color={Colors.accent} />
                        <Text style={styles.navigateBtnText}>Navigate</Text>
                      </TouchableOpacity>
                    )}
                  </SectionCard>

                  {/* What's in the case */}
                  <SectionCard>
                    <Eyebrow title={job.items.length === 1 ? 'Case' : `Case · ${job.items.length} items`} />
                    {job.items.map((item, i) => (
                      <View key={i} style={styles.itemRow}>
                        <View style={styles.itemLine}>
                          <Text style={styles.itemDescription}>{item.description}</Text>
                          <Text style={styles.itemQty}>× {item.quantity}</Text>
                        </View>
                        {item.flags.length > 0 && (
                          <View style={styles.flagsRow}>
                            {item.flags.map((flag) => (
                              <View
                                key={flag}
                                style={[styles.flag, { backgroundColor: FlagColors[flag].bg }]}
                              >
                                <IconSymbol name="exclamationmark.triangle" size={12} color={FlagColors[flag].text} />
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

                  <Eyebrow title="Messages" />
                </View>
              );
            }

            if (item.type === 'messages_empty') {
              return (
                <Text style={styles.messagesEmpty}>
                  No messages yet. The lab and office will see anything you send here.
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

        {/* Proof of delivery modal */}
        <Modal
          visible={showPod}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowPod(false)}
        >
          <KeyboardAvoidingView
            style={styles.podKav}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.podContainer}>
              <View style={styles.podHeader}>
                <View style={styles.podHeading}>
                  <Text style={styles.eyebrow}>{job.caseId}</Text>
                  <Text style={styles.podTitle}>Complete delivery</Text>
                </View>
                <TouchableOpacity
                  style={styles.podCancelBtn}
                  onPress={() => setShowPod(false)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <Text style={styles.podCancel}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.podSubtitle}>
                Who received it? Their name is saved as proof of delivery.
              </Text>

              <View style={styles.podField}>
                <Text style={styles.podLabel} nativeID="recipientLabel">Recipient name</Text>
                <TextInput
                  style={styles.podInput}
                  value={recipientName}
                  onChangeText={setRecipientName}
                  placeholder="e.g. Jane Smith"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleConfirmDelivery}
                  autoFocus
                  accessibilityLabelledBy="recipientLabel"
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.podConfirmBtn,
                  (!recipientName.trim() || submittingPod) && styles.podConfirmBtnDisabled,
                ]}
                onPress={handleConfirmDelivery}
                disabled={!recipientName.trim() || submittingPod}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {submittingPod
                  ? <ActivityIndicator color={Colors.successInk} />
                  : <Text style={styles.podConfirmText}>Confirm delivery</Text>
                }
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>

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
              // Return adds a new line; the button beside the field sends.
              submitBehavior="newline"
              accessibilityLabel="Message"
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!messageText.trim() || sendingMessage) && styles.sendBtnDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || sendingMessage}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              {sendingMessage
                ? <ActivityIndicator color="#fff" size="small" />
                : <IconSymbol name="paperplane.fill" size={20} color={messageText.trim() ? '#fff' : Colors.textMuted} />
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
    paddingHorizontal: Spacing.xl - 4,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerContent: {
    gap: Spacing.md,
  },
  eyebrow: {
    fontFamily: Fonts.semibold,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // ── Summary ────────────────────────────────────────────────────────────────
  summary: {
    gap: Spacing.sm + 2,
    marginBottom: Spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  statusBadge: {
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.md - 2,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
  },
  statBadge: {
    backgroundColor: Colors.stat,
    borderRadius: Radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statBadgeText: {
    fontFamily: Fonts.bold,
    color: Colors.statText,
    fontSize: FontSize.xs,
    letterSpacing: 0.6,
  },
  title: {
    fontFamily: Fonts.bold,
    color: Colors.text,
    fontSize: FontSize.xxl,
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  dueSoon: {
    fontFamily: Fonts.medium,
    color: Colors.warning,
  },
  dueLate: {
    fontFamily: Fonts.semibold,
    color: Colors.danger,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 4,
    marginTop: Spacing.xs,
  },
  progressSeg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#2A3C55',
  },
  progressSegDone: {
    backgroundColor: Colors.primary,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressLabel: {
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  progressLabelCurrent: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
  },

  // ── Cards ──────────────────────────────────────────────────────────────────
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm + 2,
  },
  cardTitle: {
    fontFamily: Fonts.semibold,
    color: Colors.text,
    fontSize: FontSize.lg,
    letterSpacing: -0.2,
  },

  // ── Accept / reject ────────────────────────────────────────────────────────
  responseCard: {
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentBg,
    gap: Spacing.md,
  },
  responsePrompt: {
    fontFamily: Fonts.semibold,
    color: Colors.text,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  responseButtons: {
    flexDirection: 'row',
    gap: Spacing.sm + 2,
  },
  responseBtn: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  rejectBtnText: {
    fontFamily: Fonts.semibold,
    color: Colors.danger,
    fontSize: FontSize.md,
  },
  acceptBtn: {
    backgroundColor: Colors.primary,
  },
  acceptBtnText: {
    fontFamily: Fonts.semibold,
    color: '#fff',
    fontSize: FontSize.md,
  },

  // ── Next step ──────────────────────────────────────────────────────────────
  nextStep: {
    gap: Spacing.sm,
  },
  actionBtn: {
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  actionBtnFinish: {
    backgroundColor: Colors.success,
    shadowColor: Colors.success,
  },
  actionBtnDisabled: {
    opacity: 0.6,
  },
  actionBtnText: {
    fontFamily: Fonts.semibold,
    color: '#fff',
    fontSize: FontSize.lg,
  },
  actionBtnTextFinish: {
    color: Colors.successInk,
  },
  nextHint: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },

  // ── Outcome (delivered / rejected) ─────────────────────────────────────────
  outcome: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  outcomeDelivered: {
    backgroundColor: Colors.successBg,
    borderColor: Colors.successBorder,
  },
  outcomeRejected: {
    backgroundColor: Colors.dangerBg,
    borderColor: Colors.dangerBorder,
  },
  outcomeIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeBody: {
    flex: 1,
    gap: 2,
  },
  outcomeTitle: {
    fontFamily: Fonts.semibold,
    fontSize: FontSize.lg,
  },
  outcomeSub: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },

  // ── Delivery + case ────────────────────────────────────────────────────────
  addressText: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    flexShrink: 1,
  },
  navigateBtn: {
    flexDirection: 'row',
    gap: Spacing.sm,
    height: 48,
    backgroundColor: Colors.accentBg,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  navigateBtnText: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
    fontSize: FontSize.md,
  },
  itemRow: {
    gap: Spacing.sm,
  },
  itemLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  itemDescription: {
    fontFamily: Fonts.medium,
    color: Colors.text,
    fontSize: FontSize.md,
    flexShrink: 1,
  },
  itemQty: {
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  flagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs + 2,
  },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
  },
  flagText: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
  },
  itemDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: Spacing.xs,
  },

  // ── Messages ───────────────────────────────────────────────────────────────
  messagesEmpty: {
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    lineHeight: 19,
  },
  bubbleWrapper: {
    maxWidth: '80%',
    gap: 4,
    marginBottom: Spacing.xs,
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
    fontFamily: Fonts.semibold,
    color: Colors.accent,
    fontSize: FontSize.xs,
    paddingHorizontal: Spacing.sm,
  },
  bubbleSenderOffice: {
    color: Colors.warning,
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.sm + 2,
  },
  bubbleDriver: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: Radius.sm,
  },
  bubbleOther: {
    backgroundColor: Colors.cardElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomLeftRadius: Radius.sm,
  },
  bubbleText: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    lineHeight: 21,
  },
  bubbleTextOwn: {
    color: '#fff',
  },
  bubbleTextOther: {
    color: Colors.text,
  },
  bubbleTime: {
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    paddingHorizontal: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: Colors.tabBarBorder,
    backgroundColor: Colors.tabBar,
  },
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
  sendBtnDisabled: {
    backgroundColor: Colors.cardElevated,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },

  // ── Proof of delivery modal ───────────────────────────────────────────────
  podKav: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  podContainer: {
    flex: 1,
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  podHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
  },
  podHeading: {
    gap: 4,
  },
  podTitle: {
    fontFamily: Fonts.bold,
    color: Colors.text,
    fontSize: FontSize.xxl,
    letterSpacing: -0.5,
  },
  podCancelBtn: {
    minHeight: 44,
    paddingHorizontal: Spacing.sm,
    justifyContent: 'center',
  },
  podCancel: {
    fontFamily: Fonts.medium,
    color: Colors.accent,
    fontSize: FontSize.md,
  },
  podSubtitle: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 22,
    marginTop: -Spacing.md,
  },
  podField: {
    gap: 6,
  },
  podLabel: {
    fontFamily: Fonts.semibold,
    color: '#C3CEDC',
    fontSize: FontSize.sm,
  },
  podInput: {
    fontFamily: Fonts.regular,
    backgroundColor: Colors.card,
    color: Colors.text,
    fontSize: 16,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    paddingHorizontal: Spacing.lg,
    height: 52,
  },
  podConfirmBtn: {
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  podConfirmBtnDisabled: {
    opacity: 0.4,
  },
  podConfirmText: {
    fontFamily: Fonts.semibold,
    color: Colors.successInk,
    fontSize: FontSize.lg,
  },
});
