import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NAV_PREF_KEY = 'preferred_nav_app';

export type NavApp = 'apple_maps' | 'google_maps' | 'waze' | 'system_default';

export interface NavDestination {
  address: string;
  lat?: number;
  lng?: number;
}

interface NavOption {
  label: string;
  app: NavApp;
  scheme: string;
}

function buildUrl(app: NavApp, dest: NavDestination): string {
  const { address, lat, lng } = dest;
  const coords = lat != null && lng != null ? `${lat},${lng}` : null;
  const encoded = encodeURIComponent(address);

  switch (app) {
    case 'apple_maps':
      return coords ? `maps://?daddr=${coords}` : `maps://?daddr=${encoded}`;
    case 'google_maps':
      if (Platform.OS === 'ios') {
        return coords
          ? `comgooglemaps://?daddr=${coords}&directionsmode=driving`
          : `comgooglemaps://?daddr=${encoded}&directionsmode=driving`;
      }
      return coords ? `google.navigation:q=${coords}` : `google.navigation:q=${encoded}`;
    case 'waze':
      return coords
        ? `waze://?ll=${coords}&navigate=yes`
        : `waze://?q=${encoded}&navigate=yes`;
    case 'system_default':
    default:
      if (Platform.OS === 'ios') {
        return coords ? `maps://?daddr=${coords}` : `maps://?daddr=${encoded}`;
      }
      return coords ? `geo:${coords}?q=${coords}` : `geo:0,0?q=${encoded}`;
  }
}

async function open(app: NavApp, dest: NavDestination): Promise<void> {
  const url = buildUrl(app, dest);
  const canOpen = await Linking.canOpenURL(url).catch(() => false);
  if (canOpen) {
    await Linking.openURL(url);
  } else {
    // Fallback to Google Maps web
    const encoded = encodeURIComponent(dest.address);
    await Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${encoded}`
    );
  }
}

async function getAvailableOptions(): Promise<NavOption[]> {
  const candidates: NavOption[] = Platform.OS === 'ios'
    ? [
        { label: 'Apple Maps',   app: 'apple_maps',      scheme: 'maps://'             },
        { label: 'Google Maps',  app: 'google_maps',     scheme: 'comgooglemaps://'    },
        { label: 'Waze',         app: 'waze',            scheme: 'waze://'             },
      ]
    : [
        { label: 'Default Maps', app: 'system_default',  scheme: 'geo:'                },
        { label: 'Google Maps',  app: 'google_maps',     scheme: 'google.navigation:q='},
        { label: 'Waze',         app: 'waze',            scheme: 'waze://'             },
      ];

  const available: NavOption[] = [];
  for (const option of candidates) {
    const can = await Linking.canOpenURL(option.scheme).catch(() => false);
    if (can) available.push(option);
  }

  // Always guarantee at least the system default
  if (available.length === 0) {
    available.push(
      Platform.OS === 'ios'
        ? { label: 'Apple Maps', app: 'apple_maps', scheme: 'maps://' }
        : { label: 'Default Maps', app: 'system_default', scheme: 'geo:' }
    );
  }

  return available;
}

function showPicker(
  options: NavOption[],
  onSelect: (app: NavApp) => void
): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Open navigation in…',
        message: 'Your choice will be saved for next time',
        options: [...options.map((o) => o.label), 'Cancel'],
        cancelButtonIndex: options.length,
      },
      (index) => {
        if (index < options.length) onSelect(options[index].app);
      }
    );
  } else {
    Alert.alert(
      'Open navigation in…',
      'Your choice will be saved for next time',
      [
        ...options.map((option) => ({
          text: option.label,
          onPress: () => onSelect(option.app),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }
}

export async function navigate(dest: NavDestination): Promise<void> {
  const saved = (await AsyncStorage.getItem(NAV_PREF_KEY)) as NavApp | null;
  if (saved) {
    await open(saved, dest);
    return;
  }

  const options = await getAvailableOptions();

  if (options.length === 1) {
    await AsyncStorage.setItem(NAV_PREF_KEY, options[0].app);
    await open(options[0].app, dest);
    return;
  }

  showPicker(options, async (chosen) => {
    await AsyncStorage.setItem(NAV_PREF_KEY, chosen);
    await open(chosen, dest);
  });
}

export async function getNavPreference(): Promise<NavApp | null> {
  return (await AsyncStorage.getItem(NAV_PREF_KEY)) as NavApp | null;
}

export async function changeNavPreference(dest: NavDestination): Promise<void> {
  const options = await getAvailableOptions();
  showPicker(options, async (chosen) => {
    await AsyncStorage.setItem(NAV_PREF_KEY, chosen);
    await open(chosen, dest);
  });
}

export async function clearNavPreference(): Promise<void> {
  await AsyncStorage.removeItem(NAV_PREF_KEY);
}
