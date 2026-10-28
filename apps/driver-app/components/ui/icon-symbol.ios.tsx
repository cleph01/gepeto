import { SymbolView, SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ColorValue, StyleProp, ViewStyle } from 'react-native';

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: SymbolViewProps['name'];
  size?: number;
  // Tab bar icons get React Native's ColorValue (which can be null) since expo-router 58.
  color: ColorValue | null | undefined;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <SymbolView
      weight={weight}
      tintColor={typeof color === 'string' ? color : undefined}
      resizeMode="scaleAspectFit"
      name={name}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}
