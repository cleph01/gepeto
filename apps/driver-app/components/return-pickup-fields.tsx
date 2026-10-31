import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import type { ReturnDraft } from '@/lib/returns';

const MAX_CASES = 99;

// "Bringing anything back?": the return step in the delivery sheets, and the
// body of the Log a pickup form (askFirst=false). Defaults to No so a driver
// with nothing to return isn't slowed down.
export function ReturnPickupFields({
  value,
  onChange,
  askFirst = true,
}: {
  value: ReturnDraft;
  onChange: (next: ReturnDraft) => void;
  askFirst?: boolean;
}) {
  const [caseText, setCaseText] = useState('');
  const set = (patch: Partial<ReturnDraft>) => onChange({ ...value, ...patch });

  const addCase = () => {
    const id = caseText.trim().toUpperCase();
    setCaseText('');
    if (!id || value.caseNumbers.includes(id)) return;
    const caseNumbers = [...value.caseNumbers, id];
    // Typing more case numbers than the count means the count was low.
    set({ caseNumbers, caseCount: Math.max(value.caseCount, caseNumbers.length) });
  };

  const step = (delta: number) => {
    const next = Math.min(MAX_CASES, Math.max(1, value.caseCount + delta));
    if (next !== value.caseCount) Haptics.selectionAsync();
    set({ caseCount: next });
  };

  return (
    <View style={styles.wrap}>
      {askFirst && (
        <View style={styles.askRow}>
          <Text style={styles.label} nativeID="returnAskLabel">Bringing anything back to the lab?</Text>
          <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabelledBy="returnAskLabel">
            {[false, true].map((yes) => {
              const active = value.bringing === yes;
              return (
                <TouchableOpacity
                  key={String(yes)}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                  onPress={() => set({ bringing: yes })}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{yes ? 'Yes' : 'No'}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {(value.bringing || !askFirst) && (
        <View style={styles.details}>
          <View style={styles.countRow}>
            <Text style={styles.label}>How many cases?</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={[styles.stepBtn, value.caseCount <= 1 && styles.stepBtnDisabled]}
                onPress={() => step(-1)}
                disabled={value.caseCount <= 1}
                accessibilityRole="button"
                accessibilityLabel="One fewer case"
              >
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.count} accessibilityLiveRegion="polite">{value.caseCount}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => step(1)}
                accessibilityRole="button"
                accessibilityLabel="One more case"
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Case numbers <Text style={styles.optional}>(optional)</Text>
            </Text>
            {value.caseNumbers.length > 0 && (
              <View style={styles.chips}>
                {value.caseNumbers.map((id) => (
                  <TouchableOpacity
                    key={id}
                    style={styles.chip}
                    onPress={() => set({ caseNumbers: value.caseNumbers.filter((c) => c !== id) })}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${id}`}
                  >
                    <Text style={styles.chipText}>{id}</Text>
                    <IconSymbol name="xmark" size={12} color={Colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.addRow}>
              <TextInput
                style={[styles.input, styles.addInput]}
                value={caseText}
                onChangeText={setCaseText}
                placeholder="e.g. LAB-2042"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                submitBehavior="submit"
                onSubmitEditing={addCase}
                accessibilityLabel="Case number"
              />
              <TouchableOpacity
                style={[styles.addBtn, !caseText.trim() && styles.addBtnDisabled]}
                onPress={addCase}
                disabled={!caseText.trim()}
                accessibilityRole="button"
                accessibilityLabel="Add case number"
              >
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Note <Text style={styles.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.noteInput]}
              value={value.note}
              onChangeText={(note) => set({ note })}
              placeholder="e.g. Remake, shade too dark"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={500}
              accessibilityLabel="Note for the lab"
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  askRow: { gap: Spacing.sm },
  label: { fontFamily: Fonts.semibold, color: Colors.textLabel, fontSize: FontSize.sm },
  optional: { fontFamily: Fonts.regular, color: Colors.textMuted },
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
  },
  segmentBtn: { flex: 1, height: 42, borderRadius: Radius.md - 3, alignItems: 'center', justifyContent: 'center' },
  segmentBtnActive: { backgroundColor: Colors.accentBg, borderWidth: 1, borderColor: Colors.accentBorder },
  segmentText: { fontFamily: Fonts.medium, color: Colors.textSecondary, fontSize: FontSize.md },
  segmentTextActive: { fontFamily: Fonts.semibold, color: Colors.accent },
  details: {
    gap: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardElevated,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: { opacity: 0.4 },
  stepBtnText: { fontFamily: Fonts.semibold, color: Colors.text, fontSize: 22, lineHeight: 26 },
  count: { fontFamily: Fonts.bold, color: Colors.text, fontSize: FontSize.xl, minWidth: 32, textAlign: 'center' },
  field: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.cardElevated,
    paddingHorizontal: Spacing.md,
  },
  chipText: { fontFamily: Fonts.semibold, color: Colors.text, fontSize: FontSize.sm },
  addRow: { flexDirection: 'row', gap: Spacing.sm },
  input: {
    fontFamily: Fonts.regular,
    backgroundColor: Colors.bg,
    color: Colors.text,
    fontSize: 16,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: Spacing.lg,
  },
  addInput: { flex: 1, height: 46 },
  addBtn: {
    height: 46,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentBg,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    justifyContent: 'center',
  },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { fontFamily: Fonts.semibold, color: Colors.accent, fontSize: FontSize.sm },
  noteInput: { minHeight: 64, maxHeight: 120, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' },
});
