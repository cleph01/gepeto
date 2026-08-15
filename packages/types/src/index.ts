// ─── Job ────────────────────────────────────────────────────────────────────

export type JobStatus =
  | "pending"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "arrived"
  | "delivered"
  | "rejected";

export type JobPriority = "stat" | "standard";

export type DriverResponse = "pending" | "accepted" | "rejected";

export type ItemFlag =
  | "fragile"
  | "temperature_sensitive"
  | "rush"
  | "biohazard";

export interface JobItem {
  description: string;
  quantity: number;
  flags: ItemFlag[];
}

export interface ProofOfDelivery {
  photoUrl: string;
  recipientName: string;
  signatureUrl: string;
  timestamp: string; // ISO 8601
}

export interface Job {
  id: string;
  caseId: string;
  labId: string;
  driverId: string | null;
  officeId: string;
  status: JobStatus;
  priority: JobPriority;
  driverResponse: DriverResponse;
  items: JobItem[];
  pickupAddress: string;
  deliveryAddress: string;
  proofOfDelivery: ProofOfDelivery | null;
  scheduledAt: string | null; // ISO 8601 — optional expected delivery time
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
}

// ─── Driver ─────────────────────────────────────────────────────────────────

export type DriverStatus = "available" | "on_delivery" | "off_duty";

export interface DriverLocation {
  lat: number;
  lng: number;
  updatedAt: string; // ISO 8601
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  labId: string;
  status: DriverStatus;
  currentLocation: DriverLocation | null;
}

// ─── Lab user ────────────────────────────────────────────────────────────────

export type LabRole = 'owner' | 'dispatcher';

export interface LabUser {
  id: string;
  labId: string;
  userId: string;
  name: string;
  email: string;
  labRole: LabRole;
  createdAt: string;
}

// ─── Lab ────────────────────────────────────────────────────────────────────

export interface LabSettings {
  notificationEmail: string;
  smsEnabled: boolean;
}

export interface Lab {
  id: string;
  name: string;
  address: string;
  phone: string;
  settings: LabSettings;
}

// ─── Office ─────────────────────────────────────────────────────────────────

export interface Office {
  id: string;
  name: string;
  address: string;
  phone: string;
  contactName: string;
  labId: string;
  /** Unguessable token used to generate the magic-link tracking URL */
  trackingToken: string;
}

// ─── Message ────────────────────────────────────────────────────────────────

export type SenderRole = "dispatcher" | "driver" | "office";

export interface Message {
  id: string;
  jobId: string;
  senderRole: SenderRole;
  senderId: string | null;
  officeToken: string | null;
  body: string;
  createdAt: string;
  readAt: string | null;
}

// ─── API response envelopes ──────────────────────────────────────────────────

export interface ApiSuccess<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
