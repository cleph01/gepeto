import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fetchDeliveryPhoto, type DeliveryPhoto } from '@/lib/pod-photo';

// The drop-off photo on a delivered job, view only. The server decides whether
// the driver can still see it (7 days, DRIVER_PHOTO_DAYS in dispatcher-web).
// Kept in memory only, so no copy stays on the phone after the window closes.
export function DeliveredPhoto({ jobId }: { jobId: string }) {
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<DeliveryPhoto | null>(null);
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);

  const load = useCallback(
    () =>
      fetchDeliveryPhoto(jobId)
        .then((next) => {
          setPhoto(next);
          setFailed(false);
        })
        .catch(() => setFailed(true)),
    [jobId]
  );

  useEffect(() => {
    load();
  }, [load]);

  // The link lasts 5 minutes, so a failed image gets a fresh one on retry.
  const onImageError = () => {
    setFullScreen(false);
    setPhoto(null);
    setFailed(true);
  };

  const retry = async () => {
    setRetrying(true);
    await load();
    setRetrying(false);
  };

  if (failed) {
    return (
      <TouchableOpacity style={styles.card} onPress={retry} disabled={retrying} activeOpacity={0.8} accessibilityRole="button">
        <Text style={styles.eyebrow}>Drop-off photo</Text>
        {retrying
          ? <ActivityIndicator color={Colors.accent} />
          : <Text style={styles.note}>Couldn&apos;t load the photo. Tap to try again.</Text>}
      </TouchableOpacity>
    );
  }

  if (photo?.expired) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Drop-off photo</Text>
        <Text style={styles.note}>Photos stay in the app for 7 days after delivery. Ask dispatch if you need this one.</Text>
      </View>
    );
  }

  if (!photo?.url) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Drop-off photo</Text>
      <TouchableOpacity
        onPress={() => setFullScreen(true)}
        activeOpacity={0.85}
        accessibilityRole="imagebutton"
        accessibilityLabel="Drop-off photo. Tap to view full screen."
      >
        <Image source={{ uri: photo.url }} style={styles.image} contentFit="cover" cachePolicy="memory" onError={onImageError} />
      </TouchableOpacity>
      <Text style={styles.note}>Available here for 7 days after delivery.</Text>

      <Modal visible={fullScreen} animationType="fade" onRequestClose={() => setFullScreen(false)}>
        <View style={styles.viewer}>
          <Image
            source={{ uri: photo.url }}
            style={styles.viewerImage}
            contentFit="contain"
            cachePolicy="memory"
            onError={onImageError}
            accessibilityLabel="Drop-off photo"
          />
          <TouchableOpacity
            style={[styles.closeBtn, { top: insets.top + Spacing.sm }]}
            onPress={() => setFullScreen(false)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Close photo"
          >
            <IconSymbol name="xmark" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  eyebrow: {
    fontFamily: Fonts.semibold,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.md,
    backgroundColor: Colors.bg,
  },
  note: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
  viewer: { flex: 1, backgroundColor: '#000000' },
  viewerImage: { flex: 1 },
  closeBtn: {
    position: 'absolute',
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
});
