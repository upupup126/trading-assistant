import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { Colors } from '../src/constants/theme';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, restoreSession } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    restoreSession().finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === 'login' || segments[0] === 'register';
    if (!isAuthenticated && !inAuth) {
      router.replace('/login');
    } else if (isAuthenticated && inAuth) {
      router.replace('/(tabs)/dashboard');
    }
  }, [ready, isAuthenticated, segments]);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthGate>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </AuthGate>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg,
  },
});
