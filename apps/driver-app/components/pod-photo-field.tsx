import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Colors, FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { takePodPhoto } from '@/lib/pod-photo';

// The photo step in the delivery sheets: take, preview, retake or remove.
// Holds only the local photo; the sheet uploads it when the driver confirms.
// The hint keeps paperwork (and the patient names on it) out of the picture.
export function PodPhotoField({
  uri,
  onChange,
  required,
}: {
  uri: string | null;
  onChange: (uri: string | null) => void;
  required: boolean;
}) {
  const [opening, setOpening] = useState(false);

  const take = async () => {
    setOpening(true);
    try {
      const next = await takePodPhoto();
      if (next) {
        Haptics.selectionAsync();
        onChange(next);
      }
    } catch (err) {
      Alert.alert('Camera not available', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        Photo {required ? <Text style={styles.required}>(your lab requires one)</Text> : <Text style={styles.optional}>(optional)</Text>}
      </Text>
      <Text style={styles.hint}>
        Show the drop-off: the box on the front desk or in the office. Keep labels and paperwork out of the shot.
      </Text>

      {uri ? (
        <View style={styles.preview}>
          <Image source={{ uri }} style={styles.image} contentFit="cover" accessibilityLabel="Delivery photo" />
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={take} disabled={opening} activeOpacity={0.7} accessibilityRole="button">
              {opening ? <ActivityIndicator color={Colors.accent} /> : <Text style={styles.secondaryText}>Retake</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => onChange(null)} activeOpacity={0.7} accessibilityRole="button">
              <Text style={styles.removeText}>Remove</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.takeBtn} onPress={take} disabled={opening} activeOpacity={0.8} accessibilityRole="button">
          {opening ? (
            <ActivityIndicator color={Colors.accent} />
          ) : (
            <>
              <IconSymbol name="camera" size={20} color={Colors.accent} />
              <Text style={styles.takeText}>Take a photo</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontFamily: Fonts.semibold,
    color: Colors.textLabel,
    fontSize: FontSize.sm,
  },
  required: {
    fontFamily: Fonts.medium,
    color: Colors.warning,
  },
  optional: {
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  hint: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
  takeBtn: {
    marginTop: Spacing.xs,
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.accentBorder,
    backgroundColor: Colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  takeText: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
    fontSize: FontSize.md,
  },
  preview: {
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.md,
    backgroundColor: Colors.card,
  },
  previewActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
    fontSize: FontSize.md,
  },
  removeText: {
    fontFamily: Fonts.semibold,
    color: Colors.danger,
    fontSize: FontSize.md,
  },
});
