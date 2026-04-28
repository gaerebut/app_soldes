import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { apiClient, getServerUrl, setServerUrl } from '../api/client';
import SocketManager from './SocketManager';
import { useAuth } from '../auth/AuthContext';

const POLL_INTERVAL_MS = 3000;
const DEFAULT_SERVER_URL = 'https://dlc-manager.cloud';

export default function NetworkGuard({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState<boolean | null>(null);
  const [serverUrl, setServerUrlState] = useState<string>('');
  const [checking, setChecking] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingUrl, setEditingUrl] = useState('');
  const { logout, token } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const url = await getServerUrl();
      if (isMountedRef.current) setServerUrlState(url);
      const ok = await apiClient.ping();
      if (!isMountedRef.current) return;
      if (ok) {
        setOnline(true);
        if (token) SocketManager.connect().catch(() => {});
      } else {
        setOnline(false);
      }
    } finally {
      if (isMountedRef.current) setChecking(false);
    }
  }, []);

  const handleOpenConfigModal = useCallback(async () => {
    const url = await getServerUrl();
    setEditingUrl(url);
    setShowConfigModal(true);
  }, []);

  const handleSaveUrl = useCallback(async () => {
    const trimmed = editingUrl.trim();
    if (!trimmed) {
      Alert.alert('URL requise', 'Veuillez entrer une URL valide.');
      return;
    }
    try {
      await setServerUrl(trimmed);
      setShowConfigModal(false);
      check();
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de configurer l\'URL.');
    }
  }, [editingUrl, check]);

  const handleResetUrl = useCallback(async () => {
    setEditingUrl(DEFAULT_SERVER_URL);
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
      <>
        <View style={styles.errorContainer}>
          <TouchableOpacity style={styles.configIconButton} onPress={handleOpenConfigModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.errorIconWrap}>
            <Ionicons name="cloud-offline-outline" size={64} color="#DC2626" />
          </View>
          <Text style={styles.errorTitle}>Pas de connexion au serveur</Text>
          <Text style={styles.errorText}>
            L'application doit pouvoir joindre le serveur pour fonctionner.
          </Text>
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
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showConfigModal} transparent animationType="slide" onRequestClose={() => setShowConfigModal(false)}>
          <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Configuration du serveur</Text>
                <TouchableOpacity onPress={() => setShowConfigModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>URL du serveur</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={styles.input}
                  placeholder="http://..."
                  placeholderTextColor={Colors.textLight}
                  value={editingUrl}
                  onChangeText={setEditingUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={handleResetUrl} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveUrl}>
                <Ionicons name="checkmark" size={20} color="#FFF" />
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </>
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
    paddingTop: 12,
    gap: 14,
  },
  configIconButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkText: { fontSize: 13, color: Colors.textSecondary },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  label: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
    color: Colors.text,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  saveButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
