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
  items: JobItem[];
  pickupAddress: string;
  deliveryAddress: string;
  proofOfDelivery: ProofOfDelivery | null;
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

export type SenderRole = "dispatcher" | "driver";

export interface Message {
  id: string;
  jobId: string;
  senderId: string;
  senderRole: SenderRole;
  body: string;
  createdAt: string; // ISO 8601
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
