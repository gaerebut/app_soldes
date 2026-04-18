import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../src/constants/theme';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SyncManager } from '../src/sync';

function RootLayoutNav() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    console.log('🔍 Navigation check:', { token: !!token, segments: segments.join('/'), isLoading });

    const inAuthGroup = segments[0] === 'login';
    if (!token && !inAuthGroup) {
      console.log('→ Navigating to /login');
      router.replace('/login');
    } else if (token && inAuthGroup) {
      console.log('→ Navigating to / (home)');
      router.replace('/');
    }
  }, [token, isLoading, segments]);

  // Initialize SyncManager when app is ready
  useEffect(() => {
    const initSync = async () => {
      try {
        const syncMgr = SyncManager.getInstance();
        await syncMgr.initialize();
        console.log('✅ SyncManager initialized');
      } catch (error) {
        console.error('❌ Failed to initialize SyncManager:', error);
      }
    };

    if (token && !isLoading) {
      initSync();
    }
  }, [token, isLoading]);

  return (
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
        <Stack.Screen
          name="settings"
          options={{ title: 'Parametres' }}
        />
        <Stack.Screen
          name="scanner"
          options={{ title: 'Scanner', headerShown: false }}
        />
        <Stack.Screen
          name="products"
          options={{ title: 'Gestion des produits' }}
        />
        <Stack.Screen
          name="product/add"
          options={{ title: 'Ajouter un produit' }}
        />
        <Stack.Screen
          name="product/[id]"
          options={{ title: 'Modifier le produit' }}
        />
        <Stack.Screen
          name="check/[id]"
          options={{ title: 'Controle' }}
        />
      </Stack>
    </>
  );
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
