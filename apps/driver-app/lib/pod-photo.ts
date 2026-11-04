import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from './supabase';
import { apiGet } from './api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!;

/** A photo ready to upload: local URI for the preview, JPEG bytes as base64. */
export type PodPhoto = { uri: string; base64: string };

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
  const saved = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) throw new Error("Couldn't read the photo. Try taking it again.");
  return { uri: saved.uri, base64: saved.base64 };
}

// Uploads the photo; returns the storage path to send with the delivery.
// Sends the JPEG bytes as the whole body: Expo's fetch doesn't accept React
// Native's { uri } FormData files ("Unsupported FormDataPart").
export async function uploadPodPhoto(photo: PodPhoto): Promise<{ path: string } | { error: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const binary = atob(photo.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  try {
    const res = await fetch(`${BASE_URL}/api/driver/pod-photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token ?? ''}`, 'Content-Type': 'image/jpeg' },
      body: bytes,
    });
    const body = await res.json();
    if (body.data?.path) return { path: body.data.path };
    return { error: body.error?.message ?? "Couldn't save the photo. Try again." };
  } catch (err) {
    console.warn('[uploadPodPhoto]', err);
    return { error: "Couldn't upload the photo. Check your signal and try again." };
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

// Whether this driver's lab asks for a photo on every delivery.
export async function isPodPhotoRequired(): Promise<boolean> {
  const res = await apiGet<{ podPhotoRequired: boolean }>('/api/driver/settings').catch(() => null);
  return res?.data?.podPhotoRequired ?? false;
}
