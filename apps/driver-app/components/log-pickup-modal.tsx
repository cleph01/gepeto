import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '@/lib/supabase';
import { Colors, FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ReturnPickupFields } from '@/components/return-pickup-fields';
import { EMPTY_RETURN, logReturn, type ReturnDraft } from '@/lib/returns';

type OfficeOption = { id: string; name: string; address: string };

// Log cases picked up at an office when there's no delivery to log them on
// (the office called for a pickup). The office the driver is at, if any, is
// suggested first.
export function LogPickupModal({
  visible,
  suggestedOfficeId,
  onClose,
  onLogged,
}: {
  visible: boolean;
  suggestedOfficeId?: string | null;
  onClose: () => void;
  onLogged: () => void;
}) {
  const [offices, setOffices] = useState<OfficeOption[]>([]);
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReturnDraft>({ ...EMPTY_RETURN, bringing: true });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    supabase
      .from('offices')
      .select('id, name, address')
      .order('name')
      .then(({ data }) => setOffices((data as OfficeOption[] | null) ?? []));
  }, [visible]);

  // Fresh form each time it opens.
  const reset = () => {
    setOfficeId(suggestedOfficeId ?? null);
    setDraft({ ...EMPTY_RETURN, bringing: true });
    setError(null);
  };

  const submit = async () => {
    if (!officeId || submitting) return;
    setSubmitting(true);
    setError(null);
    const err = await logReturn(draft, officeId);
    setSubmitting(false);
    if (err) {
      setError(err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onLogged();
    onClose();
  };

  // Suggested office first, then alphabetical.
  const ordered = [...offices].sort((a, b) =>
    a.id === suggestedOfficeId ? -1 : b.id === suggestedOfficeId ? 1 : a.name.localeCompare(b.name)
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} onShow={reset}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.eyebrow}>Returning to lab</Text>
              <Text style={styles.title}>Log a pickup</Text>
            </View>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7} accessibilityRole="button">
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Cases you picked up at an office to bring back. The lab sees them right away.</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Picked up from</Text>
            <View style={styles.officeList}>
              {ordered.length === 0 && <ActivityIndicator color={Colors.accent} />}
              {ordered.map((o) => {
                const active = o.id === officeId;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.officeRow, active && styles.officeRowActive]}
                    onPress={() => setOfficeId(o.id)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={styles.officeBody}>
                      <Text style={styles.officeName} numberOfLines={1}>{o.name}</Text>
                      <Text style={styles.officeAddress} numberOfLines={1}>{o.address}</Text>
                    </View>
                    {active && <IconSymbol name="checkmark" size={18} color={Colors.accent} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <ReturnPickupFields value={draft} onChange={setDraft} askFirst={false} />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.confirmBtn, (!officeId || submitting) && styles.confirmBtnDisabled]}
            onPress={submit}
            disabled={!officeId || submitting}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.confirmText}>Log {draft.caseCount} case{draft.caseCount === 1 ? '' : 's'}</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1, backgroundColor: Colors.bg },
  container: { flexGrow: 1, padding: Spacing.xl, gap: Spacing.xl },
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
  subtitle: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSize.md, lineHeight: 22, marginTop: -Spacing.md },
  field: { gap: 6 },
  label: { fontFamily: Fonts.semibold, color: Colors.textLabel, fontSize: FontSize.sm },
  officeList: { gap: Spacing.sm },
  officeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  officeRowActive: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentBg },
  officeBody: { flex: 1, gap: 2 },
  officeName: { fontFamily: Fonts.semibold, color: Colors.text, fontSize: FontSize.md },
  officeAddress: { fontFamily: Fonts.regular, color: Colors.textSecondary, fontSize: FontSize.sm },
  error: { fontFamily: Fonts.medium, color: Colors.danger, fontSize: FontSize.sm },
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmText: { fontFamily: Fonts.semibold, color: '#fff', fontSize: FontSize.lg },
});
