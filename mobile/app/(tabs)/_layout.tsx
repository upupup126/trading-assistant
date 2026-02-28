import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../src/constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const tabConfig: {
  name: string;
  title: string;
  icon: IoniconsName;
  iconFocused: IoniconsName;
}[] = [
  { name: 'dashboard', title: '仪表板', icon: 'grid-outline', iconFocused: 'grid' },
  { name: 'ai-analysis', title: 'AI分析', icon: 'analytics-outline', iconFocused: 'analytics' },
  { name: 'trading-plans', title: '交易计划', icon: 'document-text-outline', iconFocused: 'document-text' },
  { name: 'risk-management', title: '风险控制', icon: 'shield-outline', iconFocused: 'shield' },
  { name: 'alerts', title: '提醒', icon: 'notifications-outline', iconFocused: 'notifications' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bgCard },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: Colors.bgCard,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 85,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      {tabConfig.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.iconFocused : tab.icon}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
