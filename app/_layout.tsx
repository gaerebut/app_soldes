import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../src/constants/theme';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import NetworkGuard from '../src/realtime/NetworkGuard';
import SocketManager from '../src/realtime/SocketManager';
import { getOrCreateDeviceId } from '../src/utils/device';

function RootLayoutNav() {
  const { token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const navigate = async () => {
      const onLogin = segments[0] === 'login';
      const onDevice = segments[0] === 'device';

      if (!token) {
        if (!onLogin) router.replace('/login');
        return;
      }

      const storedName = await AsyncStorage.getItem('dlc_device_name');
      if (!storedName) {
        if (!onDevice) router.replace('/device');
      } else {
        if (onLogin || onDevice) router.replace('/');
      }
    };

    navigate();
  }, [token, isLoading, segments]);

  // Sync device name from server when backoffice renames it
  useEffect(() => {
    if (!token) return;
    const off = SocketManager.on('devices:changed', async (payload) => {
      if (payload?.action === 'update' && payload?.device?.name) {
        const myId = await getOrCreateDeviceId();
        if (payload.device.id === myId) {
          await AsyncStorage.setItem('dlc_device_name', payload.device.name);
        }
      }
    });
    return off;
  }, [token]);

  const spinner = (
    <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );

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
        <Stack.Screen name="device" options={{ headerShown: false }} />
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

  if (isLoading) return spinner;

  // Pas encore sur le bon écran, on attend la redirection
  if (!token && segments[0] !== 'login') return spinner;

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
