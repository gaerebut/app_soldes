/**
 * Sync Status Component
 * Displays synchronization status and device information
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { SyncManager, SyncQueue, DeviceRegistry } from '../sync';
import { apiClient } from '../api/client';

interface SyncStatusInfo {
  synced: boolean;
  pending_count: number;
  last_sync: string | null;
  device_id: string;
  device_name: string;
  devices: any[];
}

export default function SyncStatus() {
  const [status, setStatus] = useState<SyncStatusInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const syncMgr = SyncManager.getInstance();
      const deviceReg = DeviceRegistry.getInstance();

      const metadata = await syncMgr.getSyncMetadata();
      const pendingCount = await SyncQueue.getPendingCount();
      const deviceId = deviceReg.getDeviceId();
      const deviceName = deviceReg.getDeviceName();

      let devices = [];
      try {
        const devicesResponse = await apiClient.sync.getDevices();
        devices = devicesResponse.devices || [];
      } catch (error) {
        console.error('Failed to fetch devices:', error);
      }

      setStatus({
        synced: pendingCount === 0,
        pending_count: pendingCount,
        last_sync: metadata.last_sync,
        device_id: deviceId,
        device_name: deviceName,
        devices,
      });
    } catch (error) {
      console.error('Failed to load sync status:', error);
      Alert.alert('Erreur', 'Impossible de charger le statut de synchronisation');
    } finally {
      setLoading(false);
    }
  };

  const handleFullPush = async () => {
    try {
      setSyncing(true);
      const syncMgr = SyncManager.getInstance();
      await syncMgr.fullPush();
      await loadStatus();
      Alert.alert('Succès', 'Tous les données locales ont été envoyées au serveur');
    } catch (error) {
      console.error('Full push error:', error);
      Alert.alert('Erreur', 'Erreur lors de l\'envoi des données');
    } finally {
      setSyncing(false);
    }
  };

  const handleFullPull = async () => {
    Alert.alert(
      'Attention',
      'Cette action va remplacer votre base locale par celle du serveur. Tous les changements locaux non synchronisés seront perdus.',
      [
        { text: 'Annuler', onPress: () => {}, style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              setSyncing(true);
              const syncMgr = SyncManager.getInstance();
              await syncMgr.fullPull();
              await loadStatus();
              Alert.alert('Succès', 'Votre base locale a été mise à jour avec les données du serveur');
            } catch (error) {
              console.error('Full pull error:', error);
              Alert.alert('Erreur', 'Erreur lors de la récupération des données');
            } finally {
              setSyncing(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!status) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Erreur lors du chargement du statut</Text>
      </View>
    );
  }

  const lastSyncTime = status.last_sync
    ? new Date(status.last_sync).toLocaleString('fr-FR')
    : 'Jamais';

  return (
    <ScrollView style={styles.container}>
      {/* Status Header */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <View style={[styles.statusIndicator, status.synced && styles.syncedIndicator]}>
            <Ionicons
              name={status.synced ? 'checkmark-circle' : 'sync'}
              size={24}
              color="#FFF"
            />
          </View>
          <View style={styles.statusText}>
            <Text style={styles.statusTitle}>
              {status.synced ? 'Synchronisé' : 'Changements en attente'}
            </Text>
            <Text style={styles.statusSubtitle}>
              {status.pending_count === 0
                ? 'Toutes les données sont à jour'
                : `${status.pending_count} changement(s) à synchroniser`}
            </Text>
          </View>
        </View>

        {/* Sync Buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.syncButton, styles.pushButton, syncing && styles.syncButtonDisabled]}
            onPress={handleFullPush}
            disabled={syncing}
            activeOpacity={0.7}
          >
            {syncing ? (
              <ActivityIndicator color="#FFF" size="small" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="arrow-up" size={18} color="#FFF" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.syncButtonText}>
              {syncing ? 'Envoi...' : 'Synchroniser maintenant'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.syncButton, styles.pullButton, syncing && styles.syncButtonDisabled]}
            onPress={handleFullPull}
            disabled={syncing}
            activeOpacity={0.7}
          >
            {syncing ? (
              <ActivityIndicator color="#FFF" size="small" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="arrow-down" size={18} color="#FFF" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.syncButtonText}>Resynchroniser</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Device Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cet appareil</Text>
        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nom :</Text>
            <Text style={styles.infoValue}>{status.device_name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID :</Text>
            <Text style={styles.infoValueMono}>{status.device_id.substring(0, 20)}...</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Dernier sync :</Text>
            <Text style={styles.infoValue}>{lastSyncTime}</Text>
          </View>
        </View>
      </View>

      {/* Other Devices */}
      {status.devices && status.devices.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Autres appareils ({status.devices.length})</Text>
          {status.devices.map((device, index) => (
            <View key={index} style={styles.deviceItem}>
              <View style={styles.deviceHeader}>
                <Ionicons name="phone-portrait" size={20} color={Colors.primary} />
                <Text style={styles.deviceName}>{device.device_name || 'Unknown Device'}</Text>
              </View>
              <Text style={styles.deviceDetail}>
                Dernier accès: {device.last_seen ? new Date(device.last_seen).toLocaleString('fr-FR') : 'Jamais'}
              </Text>
              <Text style={styles.deviceDetail}>
                Version: {device.app_version || 'unknown'}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Pending Changes */}
      {status.pending_count > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Changements en attente</Text>
          <View style={styles.warningBox}>
            <Ionicons name="alert-circle" size={20} color="#FFA500" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.warningTitle}>Données non synchronisées</Text>
              <Text style={styles.warningText}>
                Vous avez {status.pending_count} changement(s) qui n'ont pas encore été synchronisés avec
                le serveur. Appuyez sur "Synchroniser maintenant" pour les envoyer.
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Sync Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>À propos de la synchronisation</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            • La synchronisation est automatique tous les 5 minutes{'\n'}
            • Les modifications sont mises en attente en mode hors-ligne{'\n'}
            • Chaque appareil peut modifier les données indépendamment{'\n'}
            • Les conflits sont résolus automatiquement (dernière version gagne)
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFA500',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  syncedIndicator: {
    backgroundColor: '#4CAF50',
  },
  statusText: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  statusSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  syncButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  pushButton: {
    backgroundColor: '#E3001B',
  },
  pullButton: {
    backgroundColor: '#FF8800',
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  infoBox: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: Colors.text,
  },
  infoValueMono: {
    fontSize: 12,
    color: Colors.text,
    fontFamily: 'monospace',
  },
  infoText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
  deviceItem: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
  },
  deviceDetail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 28,
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF8800',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#FF8800',
    lineHeight: 18,
  },
  errorText: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
  },
});
