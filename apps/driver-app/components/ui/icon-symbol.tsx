// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { type ColorValue, type StyleProp, type TextStyle } from 'react-native';

// SymbolViewProps['name'] also accepts a per-platform object since SDK 55; the mapping keys are plain SF Symbol names.
type IconMapping = Record<Extract<SymbolViewProps['name'], string>, ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'list.bullet.rectangle.portrait.fill': 'list-alt',
  'gearshape.fill': 'settings',
  'clock.fill': 'history',
  // Line icons for the brand restyle (outline, like the landing page)
  'list.bullet.rectangle.portrait': 'list-alt',
  'clock': 'schedule',
  'gearshape': 'settings',
  'mappin.and.ellipse': 'place',
  'tray': 'inbox',
  'checkmark': 'check',
  'xmark': 'close',
  'bell.fill': 'notifications',
  'bolt.fill': 'bolt',
  'arrow.uturn.left': 'undo',
  'camera': 'photo-camera',
  'exclamationmark.triangle': 'warning-amber',
  'eye': 'visibility',
  'eye.slash': 'visibility-off',
  'arrow.down': 'south',
  'square.and.pencil': 'edit',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: ColorValue | null | undefined;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color == null || typeof color === 'number' ? undefined : color} size={size} name={MAPPING[name]} style={style} />;
}
