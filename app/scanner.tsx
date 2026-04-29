import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors } from '../src/constants/theme';
import { getProductByBarcode } from '../src/database/products';
import { padEAN13 } from '../src/utils/date';

const BARCODE_CACHE_KEY = 'dlc_barcode_cache';

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualEAN, setManualEAN] = useState('');
  const [zoom, setZoom] = useState(0);
  const lastScannedRef = useRef('');
  const zoomRef = useRef(0);
  const initialZoomRef = useRef(0);

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .minPointers(1)
    .maxPointers(1)
    .onStart(() => {
      initialZoomRef.current = zoomRef.current;
    })
    .onUpdate((e) => {
      // glisser vers le haut (translationY négatif) = zoom+
      const next = Math.min(1, Math.max(0, initialZoomRef.current - e.translationY / 600));
      setZoom(next);
      zoomRef.current = next;
    });

  const processEAN = async (ean: string) => {
    if (!ean.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un code-barres valide');
      return;
    }

    const paddedEAN = padEAN13(ean.trim());

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Check cache first
    const cache = await AsyncStorage.getItem(BARCODE_CACHE_KEY).then(
      (str) => (str ? JSON.parse(str) : {})
    ).catch(() => ({}));

    if (cache[paddedEAN]) {
      // Product found in cache → go to check screen
      router.replace(`/check/${cache[paddedEAN]}`);
      return;
    }

    // Not in cache → check with API
    const existing = await getProductByBarcode(paddedEAN);

    if (existing) {
      // Update cache
      cache[paddedEAN] = existing.id;
      await AsyncStorage.setItem(BARCODE_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
      // Product found → go to check screen
      router.replace(`/check/${existing.id}`);
    } else {
      // Product not found → go directly to add screen
      router.replace(`/product/add?barcode=${paddedEAN}`);
    }
  };

  const handleBarcodeScanned = async ({ data, type }: { data: string; type: string }) => {
    if (scanned || data === lastScannedRef.current) return;
    setScanned(true);
    lastScannedRef.current = data;
    processEAN(data);
  };

  const handleManualEAN = async () => {
    await processEAN(manualEAN);
    setManualEAN('');
    // Le modal disparaîtra automatiquement quand on navigue vers l'autre écran
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.message}>Chargement...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Ionicons name="camera-outline" size={64} color={Colors.textLight} />
        <Text style={styles.permTitle}>Acces camera requis</Text>
        <Text style={styles.message}>
          L'appareil photo est necessaire pour scanner les codes-barres.
        </Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Autoriser la camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.camera}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            zoom={zoom}
            barcodeScannerSettings={{
              barcodeTypes: [
                'ean13',
                'ean8',
                'upc_a',
                'upc_e',
                'code128',
                'code39',
                'code93',
                'itf14',
              ],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          />
          <View style={styles.overlay}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.zoomHint}>
              <View style={styles.zoomHintFinger}>
                <View style={styles.zoomArrowUp} />
                <View style={styles.zoomFingerIcon} />
                <View style={styles.zoomArrowDown} />
              </View>
              <Text style={styles.zoomHintText}>Glisser ↑↓ pour zoomer</Text>
            </View>

            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={styles.scanText}>
              Placez le code-barres dans le cadre
            </Text>
            {scanned && (
              <TouchableOpacity
                style={styles.rescanButton}
                onPress={() => {
                  setScanned(false);
                  lastScannedRef.current = '';
                }}
              >
                <Ionicons name="refresh" size={20} color="#FFF" />
                <Text style={styles.rescanText}>Scanner a nouveau</Text>
              </TouchableOpacity>
            )}
            {!scanned && (
              <TouchableOpacity
                style={styles.manualButton}
                onPress={() => setShowManualInput(true)}
              >
                <Ionicons name="pencil" size={20} color="#FFF" />
                <Text style={styles.manualButtonText}>Saisir l'EAN manuellement</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </GestureDetector>

      {/* Modal for manual EAN input */}
      <Modal
        visible={showManualInput}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManualInput(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Saisir le code-barres</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Entrez l'EAN (ex: 3017620422003)"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={manualEAN}
                onChangeText={setManualEAN}
                autoFocus
              />
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowManualInput(false);
                    setManualEAN('');
                  }}
                >
                  <Text style={styles.modalButtonCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={handleManualEAN}
                >
                  <Text style={styles.modalButtonConfirmText}>Confirmer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_WIDTH = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomHint: {
    alignItems: 'center',
    marginBottom: 16,
    opacity: 0.65,
  },
  zoomHintFinger: {
    alignItems: 'center',
    gap: 3,
  },
  zoomArrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(255,255,255,0.85)',
  },
  zoomFingerIcon: {
    width: 11,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 6,
  },
  zoomArrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 9,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(255,255,255,0.85)',
  },
  zoomHintText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    marginTop: 4,
  },
  scanArea: {
    width: 280,
    height: 180,
    backgroundColor: 'transparent',
    borderRadius: 12,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0, left: 0,
    borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,
    borderColor: '#FFF', borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0, right: 0,
    borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH,
    borderColor: '#FFF', borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0, left: 0,
    borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,
    borderColor: '#FFF', borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0, right: 0,
    borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH,
    borderColor: '#FFF', borderBottomRightRadius: 12,
  },
  scanText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    backgroundColor: '#E3001B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  rescanText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  manualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 32,
    backgroundColor: '#666666',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  manualButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 20,
    backgroundColor: Colors.card,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  modalButtonCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  modalButtonConfirm: {
    backgroundColor: '#E3001B',
  },
  modalButtonConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  permTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 16,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  permButton: {
    backgroundColor: '#E3001B',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  permButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
