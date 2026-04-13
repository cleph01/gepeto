import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/auth';
import {
  clearNavPreference,
  getNavPreference,
  NavApp,
  navigate,
} from '@/lib/navigation';
import { Colors, FontSize, Radius, Spacing } from '@/constants/theme';

const NAV_APP_LABELS: Record<NavApp, string> = {
  apple_maps:     'Apple Maps',
  google_maps:    'Google Maps',
  waze:           'Waze',
  system_default: 'System Default',
};

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const [navPref, setNavPref] = useState<NavApp | null>(null);

  useEffect(() => {
    getNavPreference().then(setNavPref);
  }, []);

  const handleChangeNav = async () => {
    // Trigger the picker — choice gets saved to AsyncStorage automatically
    await navigate({ address: 'test', lat: undefined, lng: undefined });
    const updated = await getNavPreference();
    setNavPref(updated);
  };

  const handleClearNav = () => {
    Alert.alert(
      'Clear navigation preference?',
      "You'll be asked to choose again next time you navigate.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearNavPreference();
            setNavPref(null);
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', "You'll need to sign in again to access your jobs.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await signOut();
        },
      },
    ]);
  };

  const email = session?.user.email ?? '—';
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Settings</Text>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.card}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>Driver</Text>
                <Text style={styles.profileEmail}>{email}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Navigation preference */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Navigation</Text>
          <View style={styles.card}>
            <View style={styles.prefRow}>
              <View style={styles.prefInfo}>
                <Text style={styles.prefTitle}>Preferred App</Text>
                <Text style={styles.prefValue}>
                  {navPref ? NAV_APP_LABELS[navPref] : 'Ask each time'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.changeBtn}
                onPress={handleChangeNav}
                activeOpacity={0.7}
              >
                <Text style={styles.changeBtnText}>Change</Text>
              </TouchableOpacity>
            </View>
            {navPref && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.rowButton}
                  onPress={handleClearNav}
                  activeOpacity={0.7}
                >
                  <Text style={styles.rowButtonDanger}>Reset to ask each time</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* App info */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>App</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  screenTitle: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  section: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  profileInfo: {
    gap: 2,
  },
  profileName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  profileEmail: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
  },
  prefInfo: {
    gap: 2,
  },
  prefTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  prefValue: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  changeBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  changeBtnText: {
    color: Colors.primaryLight,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  rowButton: {
    padding: Spacing.lg,
  },
  rowButtonDanger: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  infoLabel: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  infoValue: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  signOutBtn: {
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  signOutText: {
    color: Colors.danger,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
