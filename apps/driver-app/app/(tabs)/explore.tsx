import * as WebBrowser from 'expo-web-browser';
import { PRIVACY_URL, TERMS_URL } from '@/lib/legal';
import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/context/auth';
import { getDriverId } from '@/lib/driver';
import { supabase } from '@/lib/supabase';
import {
  chooseNavApp,
  clearNavPreference,
  getNavPreference,
  NavApp,
} from '@/lib/navigation';
import { Colors, FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

const NAV_APP_LABELS: Record<NavApp, string> = {
  apple_maps:     'Apple Maps',
  google_maps:    'Google Maps',
  waze:           'Waze',
  system_default: 'System Default',
};

/** "Sofia Reyes" -> "SR"; a single word uses its first two letters. */
function initialsFrom(text: string): string {
  const words = text.trim().split(/\s+/);
  const letters = words.length > 1 ? words[0][0] + words[words.length - 1][0] : text.trim().slice(0, 2);
  return letters.toUpperCase();
}

export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const driverId = getDriverId(session);
  const [navPref, setNavPref] = useState<NavApp | null>(null);
  // undefined = first load still running; null = no name could be loaded.
  const [driverName, setDriverName] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getNavPreference().then(setNavPref);
  }, []);

  // Reload on each visit so a rename by the lab shows up without a restart.
  useFocusEffect(
    useCallback(() => {
      if (!driverId) {
        setDriverName(null);
        return;
      }
      let active = true;
      supabase
        .from('drivers')
        .select('name')
        .eq('id', driverId)
        .maybeSingle()
        .then(({ data }) => {
          // A failed refresh keeps the name already on screen.
          if (active) setDriverName((current) => data?.name ?? current ?? null);
        });
      return () => {
        active = false;
      };
    }, [driverId])
  );

  const handleChangeNav = async () => {
    const chosen = await chooseNavApp();
    if (chosen) setNavPref(chosen);
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
  const displayName = driverName === undefined ? ' ' : driverName ?? 'Driver';
  const initials = driverName === undefined ? '' : initialsFrom(driverName ?? email);

  const version = Constants.expoConfig?.version ?? '—';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Your account</Text>
          <Text style={styles.screenTitle} accessibilityRole="header">Settings</Text>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Signed in as</Text>
          <View style={styles.card}>
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
                <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Navigation preference */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Navigation</Text>
          <View style={styles.card}>
            <View style={styles.prefRow}>
              <View style={styles.prefIcon}>
                <IconSymbol name="mappin.and.ellipse" size={20} color={Colors.accent} />
              </View>
              <View style={styles.prefInfo}>
                <Text style={styles.prefTitle}>Maps app</Text>
                <Text style={styles.prefValue}>
                  {navPref ? NAV_APP_LABELS[navPref] : 'Ask each time'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.changeBtn}
                onPress={handleChangeNav}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Change maps app"
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
                  accessibilityRole="button"
                >
                  <Text style={styles.rowButtonText}>Ask me each time instead</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
          <Text style={styles.sectionHint}>Used when you tap Navigate on a job.</Text>
        </View>

        {/* Help */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Help</Text>
          <TouchableOpacity
            style={[styles.card, styles.helpRow]}
            onPress={() => router.push('/help')}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <View style={styles.prefIcon}>
              <IconSymbol name="questionmark.circle" size={20} color={Colors.accent} />
            </View>
            <Text style={styles.helpRowText}>How to use the app</Text>
            <IconSymbol name="chevron.right" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.card, styles.helpRow]}
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
            activeOpacity={0.8}
            accessibilityRole="link"
          >
            <Text style={styles.helpRowText}>Privacy Policy</Text>
            <IconSymbol name="chevron.right" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.card, styles.helpRow]}
            onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
            activeOpacity={0.8}
            accessibilityRole="link"
          >
            <Text style={styles.helpRowText}>Terms of Service</Text>
            <IconSymbol name="chevron.right" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        {/* About */}
        <View style={styles.about}>
          <View style={styles.logoTile}>
            <Image source={require('@/assets/images/gepeto-icon.png')} style={styles.logo} accessibilityLabel="Gepeto" />
          </View>
          <Text style={styles.aboutText}>Gepeto Driver · Version {version}</Text>
        </View>
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
    paddingHorizontal: Spacing.xl - 4,
    paddingTop: Spacing.lg,
    gap: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  header: {
    gap: 4,
  },
  eyebrow: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
    fontSize: FontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  screenTitle: {
    fontFamily: Fonts.bold,
    color: Colors.text,
    fontSize: FontSize.xxxl,
    letterSpacing: -0.75,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontFamily: Fonts.semibold,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sectionHint: {
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    fontSize: 12,
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
    backgroundColor: Colors.accentBg,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
    fontSize: FontSize.lg,
  },
  profileInfo: {
    gap: 2,
    flex: 1,
  },
  profileName: {
    fontFamily: Fonts.semibold,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  profileEmail: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  helpRowText: {
    flex: 1,
    fontFamily: Fonts.semibold,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  prefIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefInfo: {
    gap: 2,
    flex: 1,
  },
  prefTitle: {
    fontFamily: Fonts.medium,
    color: Colors.text,
    fontSize: FontSize.md,
  },
  prefValue: {
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  changeBtn: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: Colors.accentBg,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
  },
  changeBtnText: {
    fontFamily: Fonts.semibold,
    color: Colors.accent,
    fontSize: FontSize.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  rowButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  rowButtonText: {
    fontFamily: Fonts.medium,
    color: Colors.accent,
    fontSize: FontSize.sm,
  },
  signOutBtn: {
    height: 52,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontFamily: Fonts.semibold,
    color: Colors.danger,
    fontSize: FontSize.md,
  },
  about: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  logoTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 28,
    height: 28,
  },
  aboutText: {
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    fontSize: 12,
  },
});
