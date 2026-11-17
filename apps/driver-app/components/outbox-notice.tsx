import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useOutbox } from '@/context/outbox';
import { describeItem, type OutboxItem } from '@/lib/outbox';
import { Colors, FontSize, Fonts, Radius, Spacing } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

// What the driver sees of the offline queue: a tag under anything that hasn't
// reached the server yet, and a banner on My Jobs listing everything waiting.
// Both disappear once the server confirms it saved the update.

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/** "Not sent yet · waiting for signal", under a job or return that's queued. */
export function PendingTag({ photo, style }: { photo?: boolean; style?: object }) {
  const { sending } = useOutbox();
  const text = sending
    ? 'Sending…'
    : photo
      ? 'Photo saved on your phone · not sent yet, waiting for signal'
      : 'Not sent yet · waiting for signal';
  return (
    <View style={[styles.tag, style]} accessibilityRole="text" accessibilityLabel={text}>
      <IconSymbol name={sending ? 'clock' : 'wifi.slash'} size={13} color={Colors.warning} />
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

/** Whether anything about this job is still in the queue (failed items aside). */
export function useJobPending(jobId: string | undefined): { pending: boolean; photo: boolean } {
  const { items } = useOutbox();
  const mine = items.filter((i) => i.kind === 'job_status' && i.jobId === jobId && !i.failed);
  return { pending: mine.length > 0, photo: mine.some((i) => i.kind === 'job_status' && !!i.photo && !i.photo.uploadedPath) };
}

/** The banner on My Jobs: how many updates are waiting, and what each one is. */
export function OutboxBanner() {
  const { items, sending, retryNow, dismiss } = useOutbox();
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  const failed = items.filter((i) => i.failed);
  const waiting = items.length - failed.length;
  const title = [
    waiting > 0 && `${waiting} update${waiting === 1 ? '' : 's'} ${sending ? 'sending…' : 'waiting to send'}`,
    failed.length > 0 && `${failed.length} not saved`,
  ].filter(Boolean).join(' · ');

  return (
    <View style={[styles.banner, failed.length > 0 && styles.bannerFailed]} accessibilityRole="alert">
      <TouchableOpacity
        style={styles.bannerTop}
        onPress={() => setOpen((v) => !v)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${open ? 'Hide' : 'Show'} details`}
      >
        <IconSymbol
          name={failed.length > 0 ? 'exclamationmark.triangle' : 'wifi.slash'}
          size={18}
          color={failed.length > 0 ? Colors.danger : Colors.warning}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>{title}</Text>
          {waiting > 0 && (
            <Text style={styles.bannerBody}>
              Saved on your phone. They send on their own when you have signal.
            </Text>
          )}
        </View>
        <IconSymbol name="chevron.right" size={16} color={Colors.textSecondary} style={open ? { transform: [{ rotate: '90deg' }] } : undefined} />
      </TouchableOpacity>

      {open && (
        <View style={styles.list}>
          {items.map((item) => <Row key={item.id} item={item} sending={sending} onDismiss={() => dismiss(item.id)} />)}
          {waiting > 0 && (
            <TouchableOpacity style={styles.retryBtn} onPress={retryNow} disabled={sending} activeOpacity={0.8} accessibilityRole="button">
              <Text style={styles.retryText}>{sending ? 'Sending…' : 'Try sending now'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

function Row({ item, sending, onDismiss }: { item: OutboxItem; sending: boolean; onDismiss: () => void }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{describeItem(item)}</Text>
        <Text style={[styles.rowStatus, item.failed && styles.rowStatusFailed]}>
          {item.failed ? item.failed : `${timeOf(item.occurredAt)} · ${sending ? 'sending…' : 'waiting for signal'}`}
        </Text>
      </View>
      {item.failed && (
        <TouchableOpacity onPress={onDismiss} hitSlop={8} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Dismiss">
          <Text style={styles.dismiss}>Dismiss</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  tagText: { color: Colors.warning, fontSize: FontSize.sm, fontFamily: Fonts.medium, flexShrink: 1 },
  banner: {
    backgroundColor: Colors.warningBg,
    borderColor: Colors.warningBorder,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  bannerFailed: { backgroundColor: Colors.dangerBg, borderColor: Colors.dangerBorder },
  bannerTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  bannerTitle: { color: Colors.text, fontSize: FontSize.md, fontFamily: Fonts.semibold },
  bannerBody: { color: Colors.warningText, fontSize: FontSize.sm, fontFamily: Fonts.regular, marginTop: 2 },
  list: { marginTop: Spacing.sm, gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  rowTitle: { color: Colors.text, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  rowStatus: { color: Colors.warningText, fontSize: FontSize.sm, fontFamily: Fonts.regular, marginTop: 1 },
  rowStatusFailed: { color: Colors.danger },
  dismiss: { color: Colors.accent, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
  retryBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.warningBorder },
  retryText: { color: Colors.warning, fontSize: FontSize.sm, fontFamily: Fonts.semibold },
});
