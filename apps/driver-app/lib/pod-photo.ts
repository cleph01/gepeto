import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';
import { apiGet } from './api';
import { timeLimit, withTimeout } from './fetch-timeout';

const uploadFetch = withTimeout(45_000);

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

/** A photo just taken: the small JPEG's local URI (preview, and copied into the outbox). */
export type PodPhoto = { uri: string };

// Opens the camera for a proof-of-delivery photo. Returns a small JPEG (about
// 1200px wide, a few hundred KB), or null if the driver backed out.
// Throws with a driver-facing message when the camera isn't allowed.
export async function takePodPhoto(): Promise<PodPhoto | null> {
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
  return { uri: saved.uri };
}

// Uploads a photo's JPEG bytes; returns the storage path to send with the
// delivery. { offline } means try again later; { error } means the server
// refused it. Sends the bytes as the whole body: Expo's fetch doesn't accept
// React Native's { uri } FormData files ("Unsupported FormDataPart").
export async function uploadPodPhotoBytes(
  bytes: Uint8Array<ArrayBuffer>
): Promise<{ path: string } | { error: string } | { offline: true }> {
  try {
    // The login token may need renewing over the network, so it's time-limited too.
    const { data: { session } } = await timeLimit(supabase.auth.getSession(), 15_000);
    // A photo can take a while on weak signal, but not forever.
    const res = await uploadFetch(`${BASE_URL}/api/driver/pod-photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'image/jpeg' },
      body: bytes,
    });
    const body = await res.json();
    if (body.data?.path) return { path: body.data.path };
    if (!body.error?.code || body.error.code === 'INTERNAL_ERROR') return { offline: true };
    return { error: body.error.message ?? "Couldn't save the photo." };
  } catch (err) {
    console.warn('[uploadPodPhoto]', err);
    return { offline: true };
  }
}

/** A saved delivery photo: a short-lived link, or why there isn't one. */
export type DeliveryPhoto = { url: string | null; expired: boolean };

// Throws when it can't be checked (no signal, server error).
export async function fetchDeliveryPhoto(jobId: string): Promise<DeliveryPhoto> {
  const res = await apiGet<DeliveryPhoto>(`/api/jobs/${jobId}/pod-photo`);
  if (!res.data) throw new Error(res.error?.message ?? "Couldn't load the photo.");
  return res.data;
}

const PHOTO_REQUIRED_KEY = 'gepeto.podPhotoRequired';

// Whether this driver's lab asks for a photo on every delivery. The last
// answer is kept on the phone, so a delivery made with no signal still asks
// for the photo the server will want when it's sent.
export async function isPodPhotoRequired(): Promise<boolean> {
  const res = await apiGet<{ podPhotoRequired: boolean }>('/api/driver/settings').catch(() => null);
  if (res?.data) {
    AsyncStorage.setItem(PHOTO_REQUIRED_KEY, res.data.podPhotoRequired ? '1' : '0').catch(() => {});
    return res.data.podPhotoRequired;
  }
  const saved = await AsyncStorage.getItem(PHOTO_REQUIRED_KEY).catch(() => null);
  return saved === '1';
}
