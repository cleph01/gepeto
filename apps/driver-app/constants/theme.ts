import { ItemFlag, JobStatus } from '@gepeto/types';

// ─── Base palette ────────────────────────────────────────────────────────────

export const Colors = {
  // Backgrounds
  bg: '#0F1923',
  card: '#1A2535',
  cardElevated: '#1F2D40',
  border: '#243044',

  // Brand
  primary: '#185FA5',
  primaryLight: '#2478C5',
  primaryDark: '#124A80',

  // Text
  text: '#FFFFFF',
  textSecondary: '#8B9AB0',
  textMuted: '#4A5568',

  // Semantic
  success: '#22C55E',
  successBg: '#052E16',
  successBorder: '#166534',
  warning: '#F59E0B',
  warningBg: '#3D2A05',
  warningBorder: '#78490A',
  danger: '#EF4444',
  dangerBg: '#2D1515',
  dangerBorder: '#7F1D1D',

  // Tab bar
  tabBar: '#111D2A',
  tabBarBorder: '#1E3048',
} as const;

// ─── Job status colors ───────────────────────────────────────────────────────

export const StatusColors: Record<JobStatus, { bg: string; text: string; border: string }> = {
  pending:         { bg: '#3D2A05', text: '#F59E0B', border: '#78490A' },
  assigned:        { bg: '#0D2B4A', text: '#60A5FA', border: '#1E4D8C' },
  picked_up:       { bg: '#2D1B69', text: '#A78BFA', border: '#4C1D95' },
  in_transit:      { bg: '#0C2D4A', text: '#38BDF8', border: '#0369A1' },
  arrived:         { bg: '#052E16', text: '#4ADE80', border: '#166534' },
  delivered:       { bg: '#052E16', text: '#4ADE80', border: '#166534' },
  rejected:        { bg: '#2D1515', text: '#F87171', border: '#7F1D1D' },
};

export const StatusLabels: Record<JobStatus, string> = {
  pending:    'Pending',
  assigned:   'Assigned',
  picked_up:  'Picked Up',
  in_transit: 'In Transit',
  arrived:    'Arrived',
  delivered:  'Delivered',
  rejected:   'Rejected',
};

// ─── Item flag colors ────────────────────────────────────────────────────────

export const FlagColors: Record<ItemFlag, { bg: string; text: string }> = {
  fragile:              { bg: '#3D2A05', text: '#F59E0B' },
  temperature_sensitive: { bg: '#0C2D4A', text: '#38BDF8' },
  rush:                 { bg: '#2D1515', text: '#F87171' },
  biohazard:            { bg: '#2D1515', text: '#F87171' },
};

export const FlagLabels: Record<ItemFlag, string> = {
  fragile:               '⚠ Fragile',
  temperature_sensitive: '❄ Temp Sensitive',
  rush:                  '🔴 Rush',
  biohazard:             '☣ Biohazard',
};

// ─── Spacing ─────────────────────────────────────────────────────────────────

export const Spacing = {
  xs:   4,
  sm:   8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
} as const;

// ─── Border radius ───────────────────────────────────────────────────────────

export const Radius = {
  sm:   6,
  md:  10,
  lg:  14,
  xl:  20,
  full: 9999,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────

export const FontSize = {
  xs:   11,
  sm:   13,
  md:   15,
  lg:   17,
  xl:   20,
  xxl:  24,
  xxxl: 30,
} as const;
