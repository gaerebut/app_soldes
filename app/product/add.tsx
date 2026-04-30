import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paths, Directory, File as ExpoFile } from 'expo-file-system';
import { Colors } from '../../src/constants/theme';
import { addProduct, recordCheck } from '../../src/database/products';
import { apiClient } from '../../src/api/client';
import { getTodayStr, formatDateFR } from '../../src/utils/date';
import { fetchProductByEAN } from '../../src/utils/openfoodfacts';
import Calendar from '../../src/components/Calendar';
import CameraCapture from '../../src/components/CameraCapture';
import { getAllAisles, Aisle } from '../../src/database/aisles';
import { saveLastSelectedAisle, getLastSelectedAisle } from '../../src/utils/aisleStorage';

const BARCODE_CACHE_KEY = 'dlc_barcode_cache';

export default function AddProductScreen() {
  const router = useRouter();
  const { barcode: scannedBarcode } = useLocalSearchParams<{ barcode?: string }>();
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState(scannedBarcode ?? '');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState(getTodayStr());
  const [showCalendar, setShowCalendar] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showImageFullscreen, setShowImageFullscreen] = useState(false);
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [selectedAisleId, setSelectedAisleId] = useState<number | null>(null);
  const [showAisleDropdown, setShowAisleDropdown] = useState(false);
  const [isRupture, setIsRupture] = useState(false);
  const lastFetchedEAN = useRef('');

  useEffect(() => {
    loadAislesAndLastSelected();
    // Déclencher le fetch dès le montage avec le barcode scanné (évite le problème
    // où useLocalSearchParams n'est pas encore résolu lors de l'init du useState)
    const ean = (scannedBarcode ?? '').trim();
    if (ean.length >= 8) {
      lastFetchedEAN.current = ean;
      fetchFromEAN(ean);
    }
  }, []);

  const loadAislesAndLastSelected = async () => {
    const allAisles = await getAllAisles();
    setAisles(allAisles);
    const lastAisleId = await getLastSelectedAisle();
    setSelectedAisleId(lastAisleId);
  };

  // Fetch aussi si l'utilisateur saisit/modifie le code manuellement
  useEffect(() => {
    const ean = barcode.trim();
    if (ean.length >= 8 && ean !== lastFetchedEAN.current) {
      lastFetchedEAN.current = ean;
      fetchFromEAN(ean);
    }
  }, [barcode]);

  const fetchFromEAN = async (ean: string) => {
    setLoadingImage(true);
    try {
      const info = await fetchProductByEAN(ean);
      if (info) {
        if (info.name) setName((prev) => prev || info.name!);
        if (info.imageUrl) {
          const localUri = await downloadImage(info.imageUrl, ean);
          if (localUri) setImageUri(localUri);
        }
      }
    } finally {
      setLoadingImage(false);
    }
  };

  const downloadImage = async (url: string, ean: string): Promise<string | null> => {
    try {
      const dir = new Directory(Paths.document, 'product_images');
      if (!dir.exists) dir.create();

      const fileName = ean + '_' + Date.now() + '.jpg';
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      const file = new ExpoFile(dir, fileName);
      file.write(new Uint8Array(arrayBuffer));
      return file.uri;
    } catch (error) {
      console.error('Error downloading image:', error);
      return null;
    }
  };

  const takePhoto = () => {
    setShowCamera(true);
  };

  const handlePhotoCaptured = async (uri: string) => {
    const dir = new Directory(Paths.document, 'product_images');
    if (!dir.exists) dir.create();
    const fileName = 'photo_' + Date.now() + '.jpg';
    const source = new ExpoFile(uri);
    const dest = new ExpoFile(dir, fileName);
    source.copy(dest);
    setImageUri(dest.uri);
  };

  const handleSave = async (rupture = false) => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Nom requis', 'Veuillez saisir le nom du produit.');
      return;
    }
    if (!imageUri) {
      Alert.alert('Photo requise', 'Veuillez ajouter une photo du produit.');
      return;
    }
    if (!selectedAisleId) {
      Alert.alert('Rayon requis', 'Veuillez sélectionner un rayon.');
      return;
    }

    try {
      // 1. Create product
      const result = await addProduct(trimmed, 'Autre', barcode.trim() || undefined, undefined, expiryDate, selectedAisleId ?? undefined);

      // 2. Upload photo
      try {
        const photoResult = await apiClient.products.uploadPhoto(result, imageUri);
        if (photoResult?.image_uri) {
          await apiClient.products.update(result, { image_uri: photoResult.image_uri });
        }
      } catch (photoError) {
        console.error('Photo upload error (non-critical):', photoError);
      }

      // 3. If rupture, record it immediately
      if (rupture) {
        await recordCheck(result, getTodayStr(), 'rupture');
      }

      // Update barcode cache
      const finalBarcode = barcode.trim();
      if (finalBarcode) {
        const cache = await AsyncStorage.getItem(BARCODE_CACHE_KEY)
          .then((str) => (str ? JSON.parse(str) : {}))
          .catch(() => ({}));
        cache[finalBarcode] = result;
        await AsyncStorage.setItem(BARCODE_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
      }

      if (selectedAisleId) {
        await saveLastSelectedAisle(selectedAisleId);
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/check/${result}`);
    } catch (error) {
      console.error('Error saving product:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder le produit');
    }
  };

  return (
    <>
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* EAN */}
      <Text style={styles.label}>Code-barres (EAN)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ex: 3017620422003"
        placeholderTextColor={Colors.textLight}
        value={barcode}
        onChangeText={setBarcode}
        keyboardType="numeric"
        returnKeyType="done"
      />

      {/* Bandeau chargement produit */}
      {loadingImage && (
        <View style={styles.fetchingBanner}>
          <ActivityIndicator size="small" color="#E3001B" />
          <Text style={styles.fetchingBannerText}>Recherche du produit en cours…</Text>
        </View>
      )}

      {/* Photo */}
      <Text style={styles.label}>Photo du produit *</Text>
      <TouchableOpacity
        style={styles.photoContainer}
        onPress={imageUri ? () => setShowImageFullscreen(true) : takePhoto}
        activeOpacity={0.7}
      >
        {loadingImage && !imageUri ? (
          <View style={styles.photoPlaceholder}>
            <ActivityIndicator size="large" color="#E3001B" />
            <Text style={styles.photoPlaceholderText}>Chargement…</Text>
          </View>
        ) : imageUri ? (
          <>
            <Image source={{ uri: imageUri }} style={styles.photoImage} />
            <View style={styles.photoOverlay}>
              <TouchableOpacity onPress={() => setShowImageFullscreen(true)} style={{ marginRight: 15 }}>
                <Ionicons name="expand-outline" size={28} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={takePhoto}>
                <Ionicons name="refresh-outline" size={28} color="#FFF" />
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera-outline" size={40} color={Colors.textLight} />
            <Text style={styles.photoPlaceholderText}>Prendre une photo</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Product name */}
      <Text style={styles.label}>Nom du produit *</Text>
      {loadingImage && !name ? (
        <View style={styles.skeletonInput}>
          <ActivityIndicator size="small" color="#E3001B" style={{ marginRight: 10 }} />
          <Text style={styles.skeletonText}>Récupération du nom…</Text>
        </View>
      ) : (
        <TextInput
          style={styles.input}
          placeholder="Ex: Yaourt nature"
          placeholderTextColor={Colors.textLight}
          value={name}
          onChangeText={setName}
        />
      )}

      {/* Aisle/Rayon */}
      <Text style={styles.label}>Rayon *</Text>
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setShowAisleDropdown(!showAisleDropdown)}
        activeOpacity={0.7}
      >
        <Ionicons name="storefront-outline" size={20} color="#E3001B" />
        <Text style={styles.dateButtonText}>
          {selectedAisleId ? aisles.find(a => a.id === selectedAisleId)?.name || '(Sans nom)' : 'Sélectionner un rayon'}
        </Text>
        <Ionicons
          name={showAisleDropdown ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>

      {showAisleDropdown && (
        <View style={styles.dropdownContent}>
          {aisles.map((aisle) => (
            <TouchableOpacity
              key={aisle.id}
              style={styles.dropdownItem}
              onPress={() => {
                setSelectedAisleId(aisle.id);
                setShowAisleDropdown(false);
              }}
            >
              <Text style={[styles.dropdownItemText, selectedAisleId === aisle.id && styles.dropdownItemTextActive]}>
                {aisle.name || '(Sans nom)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* DLC */}
      <Text style={styles.label}>Date limite de consommation (DLC) *</Text>
      <TouchableOpacity
        style={styles.dateButton}
        onPress={() => setShowCalendar(!showCalendar)}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={20} color="#E3001B" />
        <Text style={styles.dateButtonText}>{formatDateFR(expiryDate)}</Text>
        <Ionicons
          name={showCalendar ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>

      {showCalendar && (
        <Calendar
          selectedDate={expiryDate}
          onSelectDate={(date) => {
            setExpiryDate(date);
            setShowCalendar(false);
          }}
        />
      )}

      {/* Save */}
      <TouchableOpacity style={styles.saveButton} onPress={() => handleSave(false)}>
        <Ionicons name="checkmark" size={22} color="#FFF" />
        <Text style={styles.saveButtonText}>Valider</Text>
      </TouchableOpacity>

      {/* Rupture */}
      <TouchableOpacity style={styles.ruptureButton} onPress={() => handleSave(true)}>
        <Ionicons name="alert-circle-outline" size={22} color="#FFF" />
        <Text style={styles.ruptureButtonText}>Déclarer en rupture</Text>
      </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>

    {/* Camera Capture Modal */}
    <CameraCapture
      visible={showCamera}
      onCapture={handlePhotoCaptured}
      onClose={() => setShowCamera(false)}
    />

    {/* Image Fullscreen Modal */}
    {imageUri && (
      <Modal
        visible={showImageFullscreen}
        transparent
        onRequestClose={() => setShowImageFullscreen(false)}
      >
        <Pressable
          style={styles.modalContainer}
          onPress={() => setShowImageFullscreen(false)}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
          {/* Close button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowImageFullscreen(false)}
          >
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
          {/* EAN overlay - bottom center */}
          <View style={styles.eanOverlay}>
            <Text style={styles.eanText}>{barcode || 'N/A'}</Text>
          </View>
        </Pressable>
      </Modal>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  label: {
    fontSize: 14, fontWeight: '700', color: Colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
  },
  input: {
    backgroundColor: Colors.card, padding: 14, borderRadius: 12,
    fontSize: 16, color: Colors.text, borderWidth: 1.5, borderColor: Colors.border,
  },
  photoContainer: {
    width: '100%', height: 200, borderRadius: 16, backgroundColor: Colors.card,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  photoImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 8,
  },
  photoOverlayText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  photoPlaceholder: { alignItems: 'center', gap: 8 },
  photoPlaceholderText: { fontSize: 14, color: Colors.textLight, fontWeight: '500' },
  dateButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    padding: 14, borderRadius: 12, gap: 10, borderWidth: 1.5, borderColor: Colors.border,
  },
  dateButtonText: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.text },
  saveButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#E3001B', padding: 16, borderRadius: 14, gap: 10, marginTop: 32,
    shadowColor: '#E3001B', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  saveButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  fetchingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF3F3',
    borderWidth: 1,
    borderColor: '#FFCDD2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  fetchingBannerText: {
    fontSize: 13,
    color: '#C0392B',
    fontWeight: '600',
    flex: 1,
  },
  skeletonInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minHeight: 50,
  },
  skeletonText: {
    fontSize: 15,
    color: Colors.textLight,
    fontStyle: 'italic',
  },
  ruptureButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FF6B00', padding: 16, borderRadius: 14, gap: 10, marginTop: 12,
    shadowColor: '#FF6B00', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  ruptureButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  // Fullscreen image modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
  eanOverlay: {
    position: 'absolute',
    bottom: 32,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  eanText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownContent: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    marginTop: -8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemText: {
    fontSize: 16,
    color: Colors.text,
  },
  dropdownItemTextActive: {
    fontWeight: '700',
    color: '#E3001B',
  },
});
