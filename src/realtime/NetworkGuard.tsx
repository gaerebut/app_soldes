import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { apiClient, getServerUrl } from '../api/client';
import SocketManager from './SocketManager';
import { useAuth } from '../auth/AuthContext';

const POLL_INTERVAL_MS = 3000;

export default function NetworkGuard({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [serverUrl, setServerUrl] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const { logout } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const url = await getServerUrl();
      if (isMountedRef.current) setServerUrl(url);
      const ok = await apiClient.ping();
      if (!isMountedRef.current) return;
      if (ok) {
        setOnline(true);
        SocketManager.connect().catch(() => {});
      } else {
        setOnline(false);
      }
    } finally {
      if (isMountedRef.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    check();
    intervalRef.current = setInterval(check, POLL_INTERVAL_MS);
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      SocketManager.disconnect();
    };
  }, [check]);

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Êtes-vous sûr ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  if (online === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Connexion au serveur…</Text>
      </View>
    );
  }

  if (!online) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorIconWrap}>
          <Ionicons name="cloud-offline-outline" size={64} color="#DC2626" />
        </View>
        <Text style={styles.errorTitle}>Pas de connexion au serveur</Text>
        <Text style={styles.errorText}>
          L'application doit pouvoir joindre le serveur pour fonctionner.
        </Text>
        <View style={styles.urlBox}>
          <Text style={styles.urlLabel}>Serveur configuré :</Text>
          <Text style={styles.urlValue}>{serverUrl || '—'}</Text>
        </View>
        <View style={styles.checkRow}>
          {checking ? (
            <ActivityIndicator size="small" color={Colors.textSecondary} />
          ) : (
            <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
          )}
          <Text style={styles.checkText}>
            {checking ? 'Vérification en cours…' : 'Nouvelle vérification toutes les 3s'}
          </Text>
        </View>
        <TouchableOpacity style={styles.retryButton} onPress={check} disabled={checking}>
          <Ionicons name="refresh" size={18} color="#FFF" />
          <Text style={styles.retryText}>Réessayer maintenant</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.logoutText}>Déconnexion</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: { fontSize: 14, color: Colors.textSecondary },
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 14,
  },
  errorIconWrap: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  errorTitle: { fontSize: 20, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  errorText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  urlBox: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginTop: 4,
  },
  urlLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 4 },
  urlValue: { fontSize: 14, fontFamily: 'monospace', color: Colors.text },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkText: { fontSize: 13, color: Colors.textSecondary },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E3001B',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    marginTop: 8,
  },
  retryText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.dangerLight,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  logoutText: { color: Colors.danger, fontSize: 14, fontWeight: '700' },
});
