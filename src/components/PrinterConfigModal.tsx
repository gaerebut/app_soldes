import { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, Pressable, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors } from '../constants/theme';
import { useZebraPrinter } from '../hooks/useZebraPrinter';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function PrinterConfigModal({ visible, onClose }: Props) {
  const printer = useZebraPrinter();
  const [connectError, setConnectError] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const scannedRef = useRef(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  async function openScanner() {
    scannedRef.current = false;
    setConnectError('');
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        setConnectError('Permission caméra refusée');
        return;
      }
    }
    setShowScanner(true);
  }

  async function handleBarcode(data: string) {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setShowScanner(false);
    setConnectError('');
    const clean = data.replace(/[:\-\s]/g, '').toUpperCase();
    const mac = clean.length === 12 && /^[0-9A-F]{12}$/.test(clean)
      ? clean.match(/.{2}/g)!.join(':')
      : data;
    try {
      await printer.connect(mac, 'Zebra ZQ620');
    } catch (e: any) {
      setConnectError(e.message || 'Connexion échouée');
    }
  }

  const disconnected = !printer.isConnected && !printer.isConnecting;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.content}>

              <View style={styles.header}>
                <Text style={styles.title}>Imprimante Zebra</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>

              {/* Status row */}
              <View style={styles.statusRow}>
                <View style={[styles.dot, printer.isConnected ? styles.dotGreen : styles.dotRed]} />
                <Text style={styles.statusText} numberOfLines={1}>
                  {printer.isConnected
                    ? `Connectée — ${printer.savedName || printer.savedDeviceId}`
                    : 'Non connectée'}
                </Text>
                {printer.isConnecting ? (
                  <ActivityIndicator size="small" color={Colors.textSecondary} />
                ) : printer.isConnected ? (
                  <TouchableOpacity style={styles.disconnectBtn} onPress={() => printer.disconnect()}>
                    <Text style={styles.disconnectText}>Déconnecter</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Barcode scan button */}
              {disconnected && (
                <TouchableOpacity style={styles.barcodeBtn} onPress={openScanner}>
                  <Ionicons name="camera-outline" size={20} color={Colors.primary} />
                  <Text style={styles.barcodeBtnText}>Scanner le code-barres de l'imprimante</Text>
                </TouchableOpacity>
              )}

              {/* BLE scan button */}
              {disconnected && !printer.isScanning && (
                <TouchableOpacity style={styles.bleBtn} onPress={() => printer.startScan()}>
                  <Ionicons name="bluetooth-outline" size={20} color="#3B82F6" />
                  <Text style={styles.bleBtnText}>Rechercher via Bluetooth</Text>
                </TouchableOpacity>
              )}

              {printer.isScanning && (
                <View style={styles.scanningRow}>
                  <ActivityIndicator size="small" color="#3B82F6" />
                  <Text style={styles.scanningText}>Recherche en cours…</Text>
                  <TouchableOpacity onPress={() => printer.stopScan()}>
                    <Text style={styles.stopScanText}>Arrêter</Text>
                  </TouchableOpacity>
                </View>
              )}

              {printer.foundDevices.length > 0 && (
                <ScrollView style={styles.deviceList} nestedScrollEnabled>
                  {printer.foundDevices.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={styles.deviceItem}
                      onPress={async () => {
                        setConnectError('');
                        try {
                          await printer.connect(d.id, d.name || d.id);
                        } catch (e: any) {
                          setConnectError(e.message || 'Connexion échouée');
                        }
                      }}
                    >
                      <Ionicons name="print-outline" size={18} color={Colors.text} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.deviceName}>{d.name || 'Zebra'}</Text>
                        <Text style={styles.deviceId}>{d.id}</Text>
                      </View>
                      <Text style={styles.deviceRssi}>{d.rssi} dBm</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {!!connectError && <Text style={styles.errorText}>{connectError}</Text>}

              <View style={styles.separator} />

              {/* Discount stepper */}
              <Text style={styles.discountLabel}>Remise</Text>
              <View style={styles.discountRow}>
                <TouchableOpacity
                  style={[styles.discountBtn, printer.discount <= 10 && styles.discountBtnOff]}
                  onPress={printer.decrementDiscount}
                  disabled={printer.discount <= 10}
                >
                  <Ionicons name="remove" size={22} color={printer.discount <= 10 ? Colors.textLight : Colors.text} />
                </TouchableOpacity>
                <Text style={styles.discountValue}>{printer.discount}%</Text>
                <TouchableOpacity
                  style={[styles.discountBtn, printer.discount >= 80 && styles.discountBtnOff]}
                  onPress={printer.incrementDiscount}
                  disabled={printer.discount >= 80}
                >
                  <Ionicons name="add" size={22} color={printer.discount >= 80 ? Colors.textLight : Colors.text} />
                </TouchableOpacity>
              </View>

            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Barcode scanner overlay */}
      <Modal visible={showScanner} transparent animationType="fade" onRequestClose={() => setShowScanner(false)}>
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'code93', 'qr'] }}
            onBarcodeScanned={({ data }) => handleBarcode(data)}
          />
          <View style={styles.scannerFrame}>
            <Text style={styles.scannerHint}>Scannez le code-barres de l'imprimante</Text>
          </View>
          <TouchableOpacity style={styles.scannerCloseBtn} onPress={() => setShowScanner(false)}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  content: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36, gap: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  dotGreen: { backgroundColor: '#16A34A' },
  dotRed: { backgroundColor: '#DC2626' },
  statusText: { fontSize: 14, color: Colors.textSecondary, flex: 1 },
  disconnectBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA',
  },
  disconnectText: { color: '#DC2626', fontSize: 13, fontWeight: '700' },
  barcodeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  barcodeBtnText: { color: Colors.primary, fontSize: 15, fontWeight: '600' },
  bleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#3B82F6',
  },
  bleBtnText: { color: '#3B82F6', fontSize: 15, fontWeight: '600' },
  scanningRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scanningText: { flex: 1, fontSize: 14, color: Colors.textSecondary },
  stopScanText: { fontSize: 13, color: '#DC2626', fontWeight: '600' },
  deviceList: { maxHeight: 180, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  deviceItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  deviceName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  deviceId: { fontSize: 11, color: Colors.textSecondary },
  deviceRssi: { fontSize: 12, color: Colors.textSecondary },
  errorText: { fontSize: 13, color: '#DC2626', textAlign: 'center' },
  separator: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  discountLabel: {
    fontSize: 13, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  discountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  discountBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  discountBtnOff: { opacity: 0.35 },
  discountValue: { fontSize: 24, fontWeight: '800', color: Colors.text, minWidth: 80, textAlign: 'center' },
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerFrame: {
    position: 'absolute', bottom: 100, left: 0, right: 0,
    alignItems: 'center', padding: 16,
  },
  scannerHint: {
    color: '#FFF', fontSize: 15, fontWeight: '600', textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
  },
  scannerCloseBtn: {
    position: 'absolute', top: 52, right: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
});
