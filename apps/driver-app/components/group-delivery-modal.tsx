import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Colors, FontSize, Radius, Spacing, Fonts } from '@/constants/theme';

// Proof of delivery for several jobs at one office: the recipient's name is
// entered once and saved on every job. Same look as the single-job sheet.
export function GroupDeliveryModal({
  visible,
  officeName,
  caseIds,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  officeName: string;
  caseIds: string[];
  onCancel: () => void;
  onConfirm: (recipientName: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const confirm = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    await onConfirm(name.trim());
    setSubmitting(false);
    setName('');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.eyebrow}>{officeName}</Text>
              <Text style={styles.title}>Complete {caseIds.length} deliveries</Text>
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7} accessibilityRole="button">
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cases}>
            {caseIds.map((id) => (
              <View key={id} style={styles.caseChip}>
                <Text style={styles.caseText}>{id}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.subtitle}>
            Who received them? Their name is saved as proof of delivery on every case above.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label} nativeID="groupRecipientLabel">Recipient name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Jane Smith"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={confirm}
              autoFocus
              accessibilityLabelledBy="groupRecipientLabel"
            />
          </View>

          <TouchableOpacity
            style={[styles.confirmBtn, (!name.trim() || submitting) && styles.confirmBtnDisabled]}
            onPress={confirm}
            disabled={!name.trim() || submitting}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {submitting
              ? <ActivityIndicator color={Colors.successInk} />
              : <Text style={styles.confirmText}>Confirm {caseIds.length} deliveries</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, padding: Spacing.xl, gap: Spacing.xl },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: Spacing.md },
  heading: { gap: 4, flexShrink: 1 },
  eyebrow: {
    fontFamily: Fonts.semibold,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: { fontFamily: Fonts.bold, color: Colors.text, fontSize: FontSize.xxl, letterSpacing: -0.5 },
  cancelBtn: { minHeight: 44, paddingHorizontal: Spacing.sm, justifyContent: 'center' },
  cancel: { fontFamily: Fonts.medium, color: Colors.accent, fontSize: FontSize.md },
  cases: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: -Spacing.md },
  caseChip: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  caseText: { fontFamily: Fonts.semibold, color: Colors.textSecondary, fontSize: FontSize.sm },
  subtitle: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSize.md, lineHeight: 22, marginTop: -Spacing.sm },
  field: { gap: 6 },
  label: { fontFamily: Fonts.semibold, color: Colors.textLabel, fontSize: FontSize.sm },
  input: {
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
  confirmBtn: {
    backgroundColor: Colors.success,
    borderRadius: Radius.md,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { fontFamily: Fonts.semibold, color: Colors.successInk, fontSize: FontSize.lg },
});
