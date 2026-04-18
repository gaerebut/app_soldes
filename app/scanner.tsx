import { useState, useRef } from 'react';
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
import { Colors } from '../src/constants/theme';
import { getDatabase } from '../src/database/db';
import { Product } from '../src/database/products';
import { padEAN13 } from '../src/utils/date';

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualEAN, setManualEAN] = useState('');
  const lastScannedRef = useRef('');

  const processEAN = async (ean: string) => {
    if (!ean.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer un code-barres valide');
      return;
    }

    // Pad EAN to 13 digits
    const paddedEAN = padEAN13(ean.trim());

    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Check if product exists with this barcode
    const db = await getDatabase();
    const existing = await db.getFirstAsync<Product>(
      'SELECT * FROM products WHERE barcode = ?',
      [paddedEAN]
    );

    if (existing) {
      // Product found → go directly to edit screen
      router.replace(`/product/${existing.id}`);
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
      <CameraView
        style={styles.camera}
        facing="back"
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
      >
        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.back()}
          >
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>

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
      </CameraView>

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
