import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.tabBar,
          borderTopColor: Colors.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 0 : 4,
          height: Platform.OS === 'ios' ? 84 : 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: Fonts.medium,
          marginBottom: Platform.OS === 'ios' ? 0 : 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="list.bullet.rectangle.portrait" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="clock" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <IconSymbol name="gearshape" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
