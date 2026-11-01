import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';
import { apiGet } from './api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

// Opens the camera for a proof-of-delivery photo. Returns a small JPEG's local
// URI (about 1200px wide, a few hundred KB), or null if the driver backed out.
// Throws with a driver-facing message when the camera isn't allowed.
export async function takePodPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Gepeto needs the camera for delivery photos. Allow it in Settings → Gepeto.');
  }
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1200) context.resize({ width: 1200 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });
  return saved.uri;
}

// Uploads the photo; returns the storage path to send with the delivery.
export async function uploadPodPhoto(uri: string): Promise<{ path: string } | { error: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const form = new FormData();
  // React Native's FormData takes a file by URI.
  form.append('photo', { uri, name: 'delivery.jpg', type: 'image/jpeg' } as unknown as Blob);
  try {
    const res = await fetch(`${BASE_URL}/api/driver/pod-photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      body: form,
    });
    const body = await res.json();
    if (body.data?.path) return { path: body.data.path };
    return { error: body.error?.message ?? "Couldn't save the photo. Try again." };
  } catch {
    return { error: "Couldn't upload the photo. Check your signal and try again." };
  }
}

// Whether this driver's lab asks for a photo on every delivery.
export async function isPodPhotoRequired(): Promise<boolean> {
  const res = await apiGet<{ podPhotoRequired: boolean }>('/api/driver/settings').catch(() => null);
  return res?.data?.podPhotoRequired ?? false;
}
