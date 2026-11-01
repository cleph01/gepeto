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

// Web links that open the app when it's installed (iOS universal links,
// Android app links) and the website when it isn't.
function webUrl(app: NavApp, dest: NavDestination): string {
  const { address, lat, lng } = dest;
  const coords = lat != null && lng != null ? `${lat},${lng}` : null;
  const encoded = encodeURIComponent(address);
  if (app === 'waze') {
    return coords ? `https://waze.com/ul?ll=${coords}&navigate=yes` : `https://waze.com/ul?q=${encoded}&navigate=yes`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${coords ?? encoded}&travelmode=driving`;
}

async function open(app: NavApp, dest: NavDestination): Promise<void> {
  const url = buildUrl(app, dest);
  // canOpenURL is false when the app isn't installed, and also when the build
  // can't ask (Expo Go doesn't declare Google Maps' scheme), so fall back to
  // the web link rather than hiding the app.
  const canOpen = await Linking.canOpenURL(url).catch(() => false);
  await Linking.openURL(canOpen ? url : webUrl(app, dest));
}

// Every choice is always offered: an app that isn't installed opens on the web.
function getOptions(): NavOption[] {
  return Platform.OS === 'ios'
    ? [
        { label: 'Apple Maps',   app: 'apple_maps' },
        { label: 'Google Maps',  app: 'google_maps' },
        { label: 'Waze',         app: 'waze' },
      ]
    : [
        { label: 'Google Maps',  app: 'google_maps' },
        { label: 'Waze',         app: 'waze' },
        { label: 'Default Maps', app: 'system_default' },
      ];
}

function showPicker(
  options: NavOption[],
  onSelect: (app: NavApp) => void,
  message = 'Your choice will be saved for next time',
  onCancel: () => void = () => {}
): void {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Open navigation in…',
        message,
        options: [...options.map((o) => o.label), 'Cancel'],
        cancelButtonIndex: options.length,
      },
      (index) => {
        if (index < options.length) onSelect(options[index].app);
        else onCancel();
      }
    );
  } else {
    Alert.alert(
      'Open navigation in…',
      message,
      [
        ...options.map((option) => ({
          text: option.label,
          onPress: () => onSelect(option.app),
        })),
        { text: 'Cancel', style: 'cancel' as const, onPress: onCancel },
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

  showPicker(getOptions(), async (chosen) => {
    await AsyncStorage.setItem(NAV_PREF_KEY, chosen);
    await open(chosen, dest);
  });
}

export async function getNavPreference(): Promise<NavApp | null> {
  return (await AsyncStorage.getItem(NAV_PREF_KEY)) as NavApp | null;
}

// Settings → Maps app: pick and save, without starting a trip. Resolves to
// the new choice, or null if the driver cancelled.
export function chooseNavApp(): Promise<NavApp | null> {
  return new Promise((resolve) => {
    showPicker(
      getOptions(),
      async (chosen) => {
        await AsyncStorage.setItem(NAV_PREF_KEY, chosen);
        resolve(chosen);
      },
      'Used every time you tap Navigate',
      () => resolve(null)
    );
  });
}

export async function clearNavPreference(): Promise<void> {
  await AsyncStorage.removeItem(NAV_PREF_KEY);
}
