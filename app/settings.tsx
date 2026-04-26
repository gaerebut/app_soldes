import { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/theme';
import { useAuth } from '../src/auth/AuthContext';
import { apiClient } from '../src/api/client';
import { getAllAislesWithCount, createAisle, updateAisleName, deleteAisleWithTransfer, reorderAisles, AisleWithProductCount } from '../src/database/aisles';
import { getNotificationSettings, applyNotificationSettings, NotificationSettings } from '../src/utils/notifications';
import { getOrCreateDeviceId, getDeviceName, setDeviceName, registerDevice } from '../src/utils/device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setServerUrl } from '../src/api/client';
import { useRealtimeRefresh } from '../src/realtime/useRealtimeRefresh';

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [aisles, setAisles] = useState<AisleWithProductCount[]>([]);
  const [showAisleModal, setShowAisleModal] = useState(false);
  const [editingAisle, setEditingAisle] = useState<AisleWithProductCount | null>(null);
  const [aisleName, setAisleName] = useState('');
  const [loadingAisles, setLoadingAisles] = useState(false);
  const [expandAisles, setExpandAisles] = useState(true);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({ enabled: false, hour: 8, minute: 0 });
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempHour, setTempHour] = useState('8');
  const [tempMinute, setTempMinute] = useState('00');
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrlState] = useState('http://192.168.1.63:3000');
  const [deviceName, setDeviceNameState] = useState('');
  const [showDeviceNameModal, setShowDeviceNameModal] = useState(false);
  const [editingDeviceName, setEditingDeviceName] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadAisles();
      loadNotifSettings();
      loadServerUrl();
      loadDeviceName();
      initializeDevice();
    }, [])
  );

  useRealtimeRefresh(['aisles:changed'], useCallback(() => {
    loadAisles();
  }, []));

  const loadServerUrl = async () => {
    const url = await AsyncStorage.getItem('dlc_server_url');
    const DEFAULT_URL = 'http://192.168.1.63:3000';

    if (url && url !== 'http://127.0.0.1:3000' && url !== DEFAULT_URL) {
      // Si une URL valide existe et ce n'est pas l'ancienne localhost, l'utiliser
      setServerUrlState(url);
    } else {
      // Sinon, utiliser la nouvelle URL par défaut et la sauvegarder
      setServerUrlState(DEFAULT_URL);
      await AsyncStorage.setItem('dlc_server_url', DEFAULT_URL);
    }
  };

  const loadDeviceName = async () => {
    const name = await getDeviceName();
    setDeviceNameState(name);
    setEditingDeviceName(name);
  };

  const initializeDevice = async () => {
    await registerDevice(apiClient);
  };

  const handleSaveServerUrl = async () => {
    if (!serverUrl.trim()) {
      Alert.alert('Erreur', 'L\'URL du serveur ne peut pas être vide');
      return;
    }
    try {
      await setServerUrl(serverUrl);
      setShowServerConfig(false);
      Alert.alert('Succès', `URL du serveur configurée:\n${serverUrl}`);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder l\'URL du serveur');
    }
  };

  const loadNotifSettings = async () => {
    const settings = await getNotificationSettings();
    setNotifSettings(settings);
    setTempHour(String(settings.hour));
    setTempMinute(String(settings.minute).padStart(2, '0'));
  };

  const handleToggleNotifications = async (value: boolean) => {
    const newSettings = { ...notifSettings, enabled: value };
    setNotifSettings(newSettings);
    await applyNotificationSettings(newSettings);
    if (value) {
      Alert.alert('Notifications activées', `Vous recevrez un rappel chaque jour à ${String(newSettings.hour).padStart(2, '0')}:${String(newSettings.minute).padStart(2, '0')}.`);
    }
  };

  const handleSaveTime = async () => {
    const h = parseInt(tempHour, 10);
    const m = parseInt(tempMinute, 10);
    if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
      Alert.alert('Erreur', 'Heure invalide. Entrez une heure entre 0-23 et des minutes entre 0-59.');
      return;
    }
    const newSettings = { ...notifSettings, hour: h, minute: m };
    setNotifSettings(newSettings);
    setShowTimePicker(false);
    await applyNotificationSettings(newSettings);
    if (newSettings.enabled) {
      Alert.alert('Heure mise à jour', `Rappel programmé chaque jour à ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}.`);
    }
  };

  const loadAisles = async () => {
    setLoadingAisles(true);
    try {
      const data = await getAllAislesWithCount();
      setAisles(data);
    } finally {
      setLoadingAisles(false);
    }
  };

  const handleAddAisle = () => {
    setEditingAisle(null);
    setAisleName('');
    setShowAisleModal(true);
  };

  const handleEditAisle = (aisle: AisleWithProductCount) => {
    setEditingAisle(aisle);
    setAisleName(aisle.name);
    setShowAisleModal(true);
  };

  const handleSaveAisle = async () => {
    if (!aisleName.trim()) {
      Alert.alert('Erreur', 'Le nom du rayon ne peut pas etre vide.');
      return;
    }

    try {
      if (editingAisle) {
        await updateAisleName(editingAisle.id, aisleName.trim());
      } else {
        await createAisle(aisleName.trim());
      }
      setShowAisleModal(false);
      await loadAisles();
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de sauvegarder le rayon.');
    }
  };

  const handleDeleteAisle = (aisle: AisleWithProductCount) => {
    if (aisle.productCount > 0) {
      Alert.alert(
        'Confirmation',
        `Ce rayon contient ${aisle.productCount} produit(s). Ils seront transferes vers un rayon "Sans nom". Continuer ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteAisleWithTransfer(aisle.id);
                await loadAisles();
              } catch (err) {
                Alert.alert('Erreur', 'Impossible de supprimer le rayon.');
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Confirmation',
        'Supprimer ce rayon ?',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteAisleWithTransfer(aisle.id);
                await loadAisles();
              } catch (err) {
                Alert.alert('Erreur', 'Impossible de supprimer le rayon.');
              }
            },
          },
        ]
      );
    }
  };

  const handleMoveAisle = async (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === aisles.length - 1)) {
      return;
    }

    const newAisles = [...aisles];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newAisles[index], newAisles[swapIndex]] = [newAisles[swapIndex], newAisles[index]];

    try {
      const aisleIds = newAisles.map((a) => a.id);
      await reorderAisles(aisleIds);
      setAisles(newAisles);
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de réordonner les rayons.');
    }
  };

  const handleSaveDeviceName = async () => {
    const trimmed = editingDeviceName.trim();
    if (!trimmed) {
      Alert.alert('Erreur', 'Le nom ne peut pas être vide');
      return;
    }
    if (trimmed.length > 30) {
      Alert.alert('Erreur', 'Le nom ne peut pas dépasser 30 caractères');
      return;
    }
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmed)) {
      Alert.alert('Erreur', 'Le nom ne peut contenir que des lettres, chiffres, espaces, tirets et underscores');
      return;
    }

    try {
      await setDeviceName(trimmed);
      const deviceId = await getOrCreateDeviceId();
      await apiClient.devices.rename(deviceId, trimmed);
      setDeviceNameState(trimmed);
      setShowDeviceNameModal(false);
    } catch (err) {
      Alert.alert('Erreur', 'Impossible de sauvegarder le nom de l\'appareil');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Deconnexion',
      'Etes-vous sur de vouloir vous deconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Deconnecter',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Device Name Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitleStandalone}>📱 Nom de l'appareil</Text>
        <TouchableOpacity
          style={styles.settingItem}
          onPress={() => {
            setEditingDeviceName(deviceName);
            setShowDeviceNameModal(true);
          }}
        >
          <View style={styles.settingContent}>
            <Text style={styles.settingLabel}>Nom actuel</Text>
            <Text style={styles.settingValue}>{deviceName}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Device Name Modal */}
      <Modal
        visible={showDeviceNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeviceNameModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowDeviceNameModal(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: 'flex-end' }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Renommer l'appareil</Text>
                  <TouchableOpacity onPress={() => setShowDeviceNameModal(false)}>
                    <Ionicons name="close" size={24} color={Colors.text} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Nom de l'appareil"
                  placeholderTextColor={Colors.textLight}
                  value={editingDeviceName}
                  onChangeText={setEditingDeviceName}
                  maxLength={30}
                  autoFocus
                />
                <Text style={styles.inputHint}>{editingDeviceName.length}/30 caractères</Text>
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleSaveDeviceName}
                >
                  <Text style={styles.submitButtonText}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Aisles Management Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderCollapsible}>
          <TouchableOpacity
            style={styles.sectionHeaderTitle}
            onPress={() => setExpandAisles(!expandAisles)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={expandAisles ? "chevron-down" : "chevron-forward"}
              size={20}
              color={Colors.text}
            />
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>Rayons</Text>
              <Text style={styles.sectionCount}>({aisles.length})</Text>
            </View>
          </TouchableOpacity>
          {expandAisles && (
            <TouchableOpacity style={styles.addButton} onPress={handleAddAisle}>
              <Ionicons name="add-circle" size={24} color="#E3001B" />
            </TouchableOpacity>
          )}
        </View>

        {expandAisles && (
          <>
            {loadingAisles ? (
              <ActivityIndicator size="large" color="#E3001B" />
            ) : aisles.length === 0 ? (
              <Text style={styles.emptyText}>Aucun rayon. Cliquez sur + pour en ajouter.</Text>
            ) : (
              <FlatList
                scrollEnabled={false}
                data={aisles}
                keyExtractor={(item) => String(item.id ?? item.name ?? Math.random())}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item, index }) => (
                  <View style={styles.aisleRow}>
                    <View style={styles.aisleOrder}>
                      <Text style={styles.aisleOrderText}>{index + 1}</Text>
                    </View>
                    <View style={styles.aisleInfo}>
                      <Text style={styles.aisleName}>{item.name || '(Sans nom)'}</Text>
                      <Text style={styles.aisleCount}>{item.productCount} produit{item.productCount !== 1 ? 's' : ''}</Text>
                    </View>
                    <View style={styles.aisleActions}>
                      <TouchableOpacity
                        style={[styles.aisleButton, index === 0 && styles.aisleButtonDisabled]}
                        onPress={() => handleMoveAisle(index, 'up')}
                        disabled={index === 0}
                      >
                        <Ionicons name="chevron-up" size={18} color={index === 0 ? Colors.textLight : Colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.aisleButton, index === aisles.length - 1 && styles.aisleButtonDisabled]}
                        onPress={() => handleMoveAisle(index, 'down')}
                        disabled={index === aisles.length - 1}
                      >
                        <Ionicons name="chevron-down" size={18} color={index === aisles.length - 1 ? Colors.textLight : Colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.aisleButton}
                        onPress={() => handleEditAisle(item)}
                      >
                        <Ionicons name="pencil" size={18} color={Colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.aisleButton}
                        onPress={() => handleDeleteAisle(item)}
                      >
                        <Ionicons name="trash" size={18} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />
            )}
          </>
        )}
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitleStandalone}>Notifications</Text>
        <View style={styles.notifRow}>
          <View style={styles.notifInfo}>
            <Ionicons name="notifications-outline" size={20} color={Colors.text} />
            <Text style={styles.notifLabel}>Rappel quotidien</Text>
          </View>
          <Switch
            value={notifSettings.enabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ false: Colors.border, true: '#E3001B' }}
            thumbColor="#FFF"
          />
        </View>
        {notifSettings.enabled && (
          <TouchableOpacity style={styles.notifTimeRow} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
            <Ionicons name="time-outline" size={18} color={Colors.textSecondary} />
            <Text style={styles.notifTimeLabel}>Heure du rappel</Text>
            <Text style={styles.notifTimeValue}>
              {String(notifSettings.hour).padStart(2, '0')}:{String(notifSettings.minute).padStart(2, '0')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Server Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitleStandalone}>⚙️ Serveur</Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={() => setShowServerConfig(true)}
        >
          <Ionicons name="server-outline" size={18} color="#FFF" />
          <Text style={styles.buttonText}>Configurer l'URL du serveur</Text>
        </TouchableOpacity>
        <Text style={styles.serverUrlText}>URL actuelle: {serverUrl}</Text>
      </View>

      {/* Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitleStandalone}>Information</Text>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.infoText}>
            Pour une meilleure experience, connectez-vous a un reseau WiFi lors de la synchronisation des photos.
          </Text>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      {/* Logout Button - Bottom */}
      <TouchableOpacity
        style={[styles.button, styles.buttonDanger]}
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
        <Text style={styles.buttonDangerText}>Deconnexion</Text>
      </TouchableOpacity>
    </ScrollView>

    {/* Time Picker Modal */}
    <Modal visible={showTimePicker} transparent onRequestClose={() => setShowTimePicker(false)}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.modalContainer} onPress={() => setShowTimePicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>Heure du rappel</Text>
            <View style={styles.timeInputRow}>
              <View style={styles.timeInputGroup}>
                <Text style={styles.timeInputLabel}>Heures</Text>
                <TextInput
                  style={styles.timeInput}
                  value={tempHour}
                  onChangeText={setTempHour}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="08"
                  placeholderTextColor={Colors.textLight}
                  selectTextOnFocus
                />
              </View>
              <Text style={styles.timeSeparator}>:</Text>
              <View style={styles.timeInputGroup}>
                <Text style={styles.timeInputLabel}>Minutes</Text>
                <TextInput
                  style={styles.timeInput}
                  value={tempMinute}
                  onChangeText={setTempMinute}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholder="00"
                  placeholderTextColor={Colors.textLight}
                  selectTextOnFocus
                />
              </View>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonSecondary]} onPress={() => setShowTimePicker(false)}>
                <Text style={styles.modalButtonSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalButtonPrimary]} onPress={handleSaveTime}>
                <Text style={styles.modalButtonText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>

    {/* Aisle Modal */}
    <Modal visible={showAisleModal} transparent onRequestClose={() => setShowAisleModal(false)}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.modalContainer} onPress={() => setShowAisleModal(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
          <Text style={styles.modalTitle}>{editingAisle ? 'Modifier rayon' : 'Ajouter rayon'}</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Nom du rayon (optionnel)"
            placeholderTextColor={Colors.textLight}
            value={aisleName}
            onChangeText={setAisleName}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSecondary]}
              onPress={() => setShowAisleModal(false)}
            >
              <Text style={styles.modalButtonSecondaryText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonPrimary]}
              onPress={handleSaveAisle}
            >
              <Text style={styles.modalButtonText}>Enregistrer</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>

    {/* Server URL Configuration Modal */}
    <Modal visible={showServerConfig} transparent onRequestClose={() => setShowServerConfig(false)}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={styles.modalContainer} onPress={() => setShowServerConfig(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <Text style={styles.modalTitle}>⚙️ URL du serveur</Text>
            <Text style={styles.serverConfigHelper}>
              Entrez l'adresse complète du serveur (ex: http://192.168.1.100:3000)
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="http://192.168.1.63:3000"
              placeholderTextColor={Colors.textLight}
              value={serverUrl}
              onChangeText={setServerUrlState}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.serverUrlHint}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.serverUrlHintText}>
                Android Emulator: http://10.0.2.2:3000{'\n'}
                WiFi: Utilisez l'IP locale de votre PC
              </Text>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowServerConfig(false)}
              >
                <Text style={styles.modalButtonSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleSaveServerUrl}
              >
                <Text style={styles.modalButtonText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 32 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderCollapsible: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeaderTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  sectionTitleStandalone: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  sectionDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  addButton: {
    padding: 4,
  },
  aisleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    gap: 12,
  },
  aisleOrder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E3001B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aisleOrderText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  aisleInfo: {
    flex: 1,
  },
  aisleName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  aisleCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  aisleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  aisleButton: {
    padding: 8,
  },
  aisleButtonDisabled: {
    opacity: 0.4,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  buttonPrimary: {
    backgroundColor: '#E3001B',
    shadowColor: '#E3001B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDanger: {
    backgroundColor: Colors.dangerLight,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDangerText: {
    color: Colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  infoBox: {
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  // Notification styles
  notifRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, padding: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border, marginBottom: 8,
  },
  notifInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifLabel: { fontSize: 15, fontWeight: '600', color: Colors.text },
  notifTimeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card, padding: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  notifTimeLabel: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  notifTimeValue: { fontSize: 16, fontWeight: '700', color: '#E3001B' },
  timeInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 20 },
  timeInputGroup: { alignItems: 'center', gap: 6 },
  timeInputLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },
  timeInput: {
    width: 70, height: 56, borderRadius: 12, backgroundColor: Colors.card,
    borderWidth: 1.5, borderColor: Colors.border, textAlign: 'center',
    fontSize: 24, fontWeight: '700', color: Colors.text,
  },
  timeSeparator: { fontSize: 28, fontWeight: '700', color: Colors.text, marginTop: 16 },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  modalInput: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: '#E3001B',
  },
  modalButtonSecondary: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  modalButtonSecondaryText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  buttonSecondary: {
    backgroundColor: '#FF8800',
  },
  serverUrlText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  serverConfigHelper: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  serverUrlHint: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    gap: 10,
  },
  serverUrlHintText: {
    fontSize: 12,
    color: '#FF8800',
    flex: 1,
    lineHeight: 18,
  },
  // Device name styles
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  settingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.card,
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#E3001B',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
