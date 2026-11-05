import { useCallback, useEffect, useState } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fetchDeliveryPhoto, type DeliveryPhoto } from '@/lib/pod-photo';

// Matches DRIVER_PHOTO_DAYS in dispatcher-web, which is what actually enforces it.
const DRIVER_PHOTO_DAYS = 7;

function pastPhotoWindow(deliveredAt: string | null | undefined) {
  if (!deliveredAt) return false; // let the server decide
  return Date.now() - new Date(deliveredAt).getTime() > DRIVER_PHOTO_DAYS * 86400000;
}

// The drop-off photo on a delivered job, view only. The server decides whether
// the driver can still see it. Kept in memory only, so no copy stays on the
// phone after the window closes.
//
// Only render this for a job that has a photo: the frame holds its space from
// the first paint, so nothing on the screen moves when the photo arrives.
export function DeliveredPhoto({ jobId, deliveredAt }: { jobId: string; deliveredAt?: string | null }) {
  const insets = useSafeAreaInsets();
  const [expiredOnOpen] = useState(() => pastPhotoWindow(deliveredAt));
  const [photo, setPhoto] = useState<DeliveryPhoto | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [failed, setFailed] = useState(false);
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
    if (!expiredOnOpen) load();
  }, [expiredOnOpen, load]);

  // The link lasts 5 minutes, so a failed image gets a fresh one on retry.
  const onImageError = () => {
    setFullScreen(false);
    setPhoto(null);
    setImageReady(false);
    setFailed(true);
  };

  const retry = () => {
    setFailed(false);
    load();
  };

  if (expiredOnOpen || photo?.expired) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Drop-off photo</Text>
        <Text style={styles.note}>Photos stay in the app for 7 days after delivery. Ask dispatch if you need this one.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Drop-off photo</Text>
      <TouchableOpacity
        style={styles.frame}
        onPress={failed ? retry : () => setFullScreen(true)}
        disabled={!failed && !imageReady}
        activeOpacity={0.85}
        accessibilityRole={failed ? 'button' : 'imagebutton'}
        accessibilityLabel={
          failed
            ? "Couldn't load the photo. Tap to try again."
            : imageReady
              ? 'Drop-off photo. Tap to view full screen.'
              : 'Loading drop-off photo'
        }
      >
        {!failed && !imageReady && <PhotoPlaceholder />}
        {photo?.url && (
          <Image
            source={{ uri: photo.url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory"
            transition={{ duration: 250, effect: 'cross-dissolve' }}
            onLoad={() => setImageReady(true)}
            onError={onImageError}
          />
        )}
        {failed && (
          <View style={styles.frameMessage}>
            <Text style={styles.frameMessageText}>Couldn&apos;t load the photo. Tap to try again.</Text>
          </View>
        )}
      </TouchableOpacity>
      <Text style={styles.note}>Available here for 7 days after delivery.</Text>

      {photo?.url && (
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
      )}
    </View>
  );
}

// A slow, quiet pulse in the frame while the photo is on its way.
function PhotoPlaceholder() {
  const [opacity] = useState(() => new Animated.Value(0.35));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return <Animated.View style={[StyleSheet.absoluteFill, styles.placeholder, { opacity }]} />;
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
  frame: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.bg,
  },
  placeholder: {
    backgroundColor: Colors.border,
  },
  frameMessage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  frameMessageText: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 19,
    textAlign: 'center',
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
