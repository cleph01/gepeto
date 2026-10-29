import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/context/auth';
import { JobAlerts } from '@/components/job-alerts';
import { Colors, Fonts } from '@/constants/theme';

// Keep the splash up until Inter has loaded, so text never flashes in the system font.
SplashScreen.preventAutoHideAsync().catch(() => {});

function RouteGuard() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthScreen = segments[0] === 'login';
    if (!session && !inAuthScreen) {
      router.replace('/login');
    } else if (session && inAuthScreen) {
      router.replace('/(tabs)');
    }
  }, [session, loading, segments]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });
  const ready = fontsLoaded || !!fontError; // a font failure falls back to the system font

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <AuthProvider>
      <RouteGuard />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.card },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontFamily: Fonts.semibold },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: Colors.bg },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="history/[id]"
          options={{
            title: 'Rejected Job',
            headerBackTitle: 'History',
          }}
        />
        <Stack.Screen
          name="job/[id]"
          options={{
            title: 'Job Detail',
            headerBackTitle: 'Jobs',
          }}
        />
      </Stack>
      <JobAlerts />
      <StatusBar style="light" />
    </AuthProvider>
  );
}
