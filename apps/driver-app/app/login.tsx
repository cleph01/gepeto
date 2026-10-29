import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/auth';
import { Colors, FontSize, Radius, Spacing, Fonts } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<'email' | 'password' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    if (error) setError(error);
    setLoading(false);
  };

  return (
    <View style={styles.screen}>
      {/* The landing page hero: dot grid and blue glow */}
      <Image
        source={require('@/assets/images/login-glow.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessible={false}
      />
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.inner}>
            <View style={styles.header}>
              <View style={styles.logoMark}>
                <Image
                  source={require('@/assets/images/gepeto-icon.png')}
                  style={styles.logoImage}
                  accessibilityLabel="Gepeto"
                />
              </View>
              <Text style={styles.appName} accessibilityRole="header">Gepeto</Text>
              <View style={styles.badge}>
                <View style={styles.badgeDot} />
                <Text style={styles.badgeText}>Driver app</Text>
              </View>
            </View>

            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.label} nativeID="emailLabel">Email</Text>
                <TextInput
                  style={[styles.input, focused === 'email' && styles.inputFocused]}
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  textContentType="username"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  accessibilityLabelledBy="emailLabel"
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.label} nativeID="passwordLabel">Password</Text>
                <View>
                  <TextInput
                    ref={passwordRef}
                    style={[styles.input, styles.passwordInput, focused === 'password' && styles.inputFocused]}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setFocused('password')}
                    onBlur={() => setFocused(null)}
                    placeholder="••••••••"
                    placeholderTextColor={Colors.textMuted}
                    secureTextEntry={!showPassword}
                    textContentType="password"
                    autoComplete="password"
                    returnKeyType="done"
                    onSubmitEditing={handleSignIn}
                    accessibilityLabelledBy="passwordLabel"
                  />
                  <TouchableOpacity
                    style={styles.eye}
                    onPress={() => setShowPassword((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <IconSymbol name={showPassword ? 'eye.slash' : 'eye'} size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {error && (
                <View style={styles.errorBox} accessibilityLiveRegion="polite">
                  <IconSymbol name="exclamationmark.triangle" size={16} color={Colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignIn}
                disabled={loading}
                activeOpacity={0.85}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Sign in</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.help}>Trouble signing in? Ask your dispatcher{'\n'}to resend your invite.</Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  safe: {
    flex: 1,
  },
  kav: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xxl + 8,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  // Orbital Gepeto icon on a white tile with the landing page's blue glow.
  logoMark: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: '#fff',
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    shadowColor: Colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  appName: {
    fontFamily: Fonts.bold,
    fontSize: 32,
    color: Colors.text,
    letterSpacing: -0.8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  badgeText: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  form: {
    gap: Spacing.lg,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: Fonts.semibold,
    color: '#C3CEDC',
    fontSize: FontSize.sm,
  },
  input: {
    fontFamily: Fonts.regular,
    height: 52,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: '#2E3F57',
    paddingHorizontal: Spacing.lg,
    color: Colors.text,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: Colors.accentBorder,
  },
  passwordInput: {
    paddingRight: 52,
  },
  eye: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.dangerBg,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.dangerBorder,
    padding: Spacing.md,
  },
  errorText: {
    fontFamily: Fonts.regular,
    color: Colors.danger,
    fontSize: FontSize.sm,
    flexShrink: 1,
  },
  button: {
    height: 52,
    marginTop: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: Fonts.semibold,
    color: '#fff',
    fontSize: 16,
  },
  help: {
    fontFamily: Fonts.regular,
    color: '#8E9DB2',
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
});
