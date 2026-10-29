import { ItemFlag, JobStatus } from '@gepeto/types';

// ─── Base palette ────────────────────────────────────────────────────────────
// Matches the landing page: deep navy ground, brand blue, and the dispatcher's
// muted amber/olive/red family, lightened just enough to read in sunlight.

export const Colors = {
  // Backgrounds
  bg: '#0F1B2D',            // landing hero navy
  card: '#16263B',
  cardElevated: '#1C2F48',
  border: '#26384F',
  borderStrong: '#3A4C66',

  // Brand
  primary: '#185FA5',       // fills: buttons, solid chips, progress
  primaryLight: '#2478C5',
  primaryDark: '#124A80',
  accent: '#7DB4EA',        // brand blue for text and icons on navy (primary is too dark to read)
  accentBg: '#102E4D',
  accentBorder: '#2E6AAA',
  accentText: '#C9DDF2',    // light blue text on accentBg

  // Text
  text: '#FFFFFF',
  textSecondary: '#A3B1C4',
  textMuted: '#7F8FA6',
  textLabel: '#C3CEDC',     // form field labels
  textHelp: '#8E9DB2',      // help lines under forms

  // Controls
  inputBorder: '#2E3F57',
  track: '#2A3C55',         // progress bar background

  // Semantic
  success: '#9CCB6A',
  successBg: '#182A0B',
  successBorder: '#3B6D11',
  successInk: '#132108',     // text on a solid success fill
  warning: '#E8B04F',
  warningBg: '#3A2606',
  warningBorder: '#7A4F10',
  warningText: '#E9D3AA',
  danger: '#F1958B',
  dangerBg: '#361616',
  dangerBorder: '#7A2A2A',

  // STAT: solid amber, so it never reads as a status
  stat: '#E8B04F',
  statText: '#241500',

  // Tab bar
  tabBar: '#0B1524',
  tabBarBorder: '#1E2F45',
} as const;

// ─── Fonts ───────────────────────────────────────────────────────────────────
// Inter (the landing page's typeface), one family per weight; loaded in app/_layout.tsx.

export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

// ─── Job status colors ───────────────────────────────────────────────────────
// Same family as the dispatcher site: grey pending, blue while the driver has
// it (solid once picked up), amber arrived, olive delivered, red rejected.

export const StatusColors: Record<JobStatus, { bg: string; text: string; border: string }> = {
  pending:    { bg: '#232F3F', text: '#C5CCD6', border: '#3A4658' },
  assigned:   { bg: '#102E4D', text: '#7DB4EA', border: '#1F4F80' },
  picked_up:  { bg: '#185FA5', text: '#FFFFFF', border: '#185FA5' },
  in_transit: { bg: '#185FA5', text: '#FFFFFF', border: '#185FA5' },
  arrived:    { bg: '#3A2606', text: '#E8B04F', border: '#7A4F10' },
  delivered:  { bg: '#182A0B', text: '#9CCB6A', border: '#3B6D11' },
  rejected:   { bg: '#361616', text: '#F1958B', border: '#7A2A2A' },
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
  fragile:               { bg: '#3A2606', text: '#E8B04F' },
  temperature_sensitive: { bg: '#102E4D', text: '#7DB4EA' },
  rush:                  { bg: '#361616', text: '#F1958B' },
  biohazard:             { bg: '#361616', text: '#F1958B' },
};

export const FlagLabels: Record<ItemFlag, string> = {
  fragile:               'Fragile',
  temperature_sensitive: 'Temp sensitive',
  rush:                  'Rush',
  biohazard:             'Biohazard',
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
  md:  12,
  lg:  16,
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
