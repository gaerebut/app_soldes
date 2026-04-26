import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../src/constants/theme';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NetworkGuard from '../src/realtime/NetworkGuard';

function RootLayoutNav() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === 'login';
    if (!token && !inAuthGroup) {
      router.replace('/login');
    } else if (token && inAuthGroup) {
      router.replace('/');
    }
  }, [token, isLoading, segments]);

  const stack = (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerTitleStyle: { fontWeight: '700' },
          headerBackTitle: 'Retour',
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Parametres' }} />
        <Stack.Screen name="scanner" options={{ title: 'Scanner', headerShown: false }} />
        <Stack.Screen name="products" options={{ title: 'Gestion des produits' }} />
        <Stack.Screen name="product/add" options={{ title: 'Ajouter un produit' }} />
        <Stack.Screen name="product/[id]" options={{ title: 'Modifier le produit' }} />
        <Stack.Screen name="check/[id]" options={{ title: 'Controle' }} />
      </Stack>
    </>
  );

  // Apply NetworkGuard only when authenticated (login screen should still render)
  if (!token || isLoading) return stack;
  return <NetworkGuard>{stack}</NetworkGuard>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
