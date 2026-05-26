import { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  ActivityIndicator, Pressable, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/theme';
import { useZebraPrinter } from '../hooks/useZebraPrinter';
import type { FoundDevice } from '../services/ZebraPrinterService';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function PrinterConfigModal({ visible, onClose }: Props) {
  const printer = useZebraPrinter();
  const [connectError, setConnectError] = useState('');

  async function handleConnect(device: FoundDevice) {
    setConnectError('');
    try {
      await printer.connect(device.id, device.name);
    } catch (e: any) {
      setConnectError(e.message || 'Connexion échouée');
    }
  }

  async function handleScan() {
    setConnectError('');
    try {
      await printer.startScan();
    } catch (e: any) {
      setConnectError(e.message || 'Bluetooth indisponible');
    }
  }

  return (
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
                  : printer.isScanning
                    ? 'Recherche en cours…'
                    : 'Non connectée'}
              </Text>

              {printer.isConnecting ? (
                <ActivityIndicator size="small" color={Colors.textSecondary} />
              ) : printer.isConnected ? (
                <TouchableOpacity
                  style={styles.disconnectBtn}
                  onPress={() => printer.disconnect()}
                >
                  <Text style={styles.disconnectText}>Déconnecter</Text>
                </TouchableOpacity>
              ) : printer.isScanning ? (
                <TouchableOpacity
                  style={styles.stopBtn}
                  onPress={() => printer.stopScan()}
                >
                  <Text style={styles.stopText}>Arrêter</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.scanBtn}
                  onPress={handleScan}
                >
                  <Ionicons name="bluetooth" size={16} color="#fff" style={styles.scanBtnIcon} />
                  <Text style={styles.scanBtnText}>Rechercher</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Scanning spinner */}
            {printer.isScanning && printer.foundDevices.length === 0 && (
              <View style={styles.scanningRow}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.scanningText}>Recherche des imprimantes Zebra…</Text>
              </View>
            )}

            {/* Found devices list */}
            {printer.foundDevices.length > 0 && (
              <FlatList
                data={printer.foundDevices}
                keyExtractor={(d) => d.id}
                scrollEnabled={false}
                style={styles.deviceList}
                renderItem={({ item }) => (
                  <View style={styles.deviceRow}>
                    <Ionicons name="print-outline" size={20} color={Colors.textSecondary} />
                    <View style={styles.deviceInfo}>
                      <Text style={styles.deviceName}>{item.name}</Text>
                      <Text style={styles.deviceId} numberOfLines={1}>{item.id}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.connectBtn, printer.isConnecting && styles.connectBtnOff]}
                      onPress={() => handleConnect(item)}
                      disabled={printer.isConnecting}
                    >
                      {printer.isConnecting ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.connectBtnText}>Connecter</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              />
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
  stopBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border,
  },
  stopText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  scanBtnIcon: {},
  scanBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  scanningRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scanningText: { fontSize: 13, color: Colors.textSecondary },
  deviceList: { maxHeight: 200 },
  deviceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  deviceId: { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  connectBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#16A34A', minWidth: 80, alignItems: 'center',
  },
  connectBtnOff: { opacity: 0.5 },
  connectBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
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
});
