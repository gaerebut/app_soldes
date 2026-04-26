import { useCallback, useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
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
  Modal,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Animated,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paths, Directory, File as ExpoFile } from 'expo-file-system';
import { Colors, Categories } from '../../src/constants/theme';
import { Product, updateProduct, getCheckHistory, updateProductDLC, getProductById } from '../../src/database/products';
import { formatDateShort, formatDateFR, getTodayStr } from '../../src/utils/date';
import { getAllAisles, Aisle } from '../../src/database/aisles';
import { useRealtimeRefresh } from '../../src/realtime/useRealtimeRefresh';
import CameraCapture from '../../src/components/CameraCapture';
import Calendar from '../../src/components/Calendar';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BARCODE_CACHE_KEY = 'dlc_barcode_cache';
const productDataCache = new Map<number, { product: Product; history: any[] }>();

async function downloadAndCacheImage(imageUrl: string): Promise<string | null> {
  try {
    const dir = new Directory(Paths.document, 'product_images');
    if (!dir.exists) await dir.create();

    const fileName = 'off_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '.jpg';
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();
    const file = new ExpoFile(dir, fileName);
    file.write(new Uint8Array(arrayBuffer));
    return file.uri;
  } catch (error) {
    console.error('Failed to cache image:', error);
    return null;
  }
}

async function fetchProductData(id: number) {
  if (productDataCache.has(id)) return productDataCache.get(id)!;
  const p = await getProductById(id);
  const history = await getCheckHistory(id, 1);
  if (p) {
    productDataCache.set(id, { product: p, history });
    return productDataCache.get(id)!;
  }
  return null;
}

// Fetch product info from Open Food Facts using official SDK
async function fetchFromOpenFoodFacts(barcode: string): Promise<{ name?: string; imageUrl?: string } | null> {
  try {
    console.log('🔍 Fetching from Open Food Facts:', barcode);
    const url = `https://fr.openfoodfacts.org/api/v0/product/${barcode}.json`;
    console.log('URL:', url);

    const response = await fetch(url);
    console.log('Response status:', response.status);

    if (!response.ok) throw new Error(`Network error: ${response.status}`);

    const data = await response.json();
    console.log('API Response:', data);

    if (data.status === 0 || !data.product) {
      console.log('❌ Produit non trouvé');
      return null;
    }

    const imageUrl = data.product.image_front_url || data.product.image_url;
    const name = data.product.product_name;

    console.log('✓ Image URL:', imageUrl);
    console.log('✓ Product name:', name);

    if (imageUrl) {
      return {
        name: name,
        imageUrl: imageUrl,
      };
    } else {
      console.log('⚠️ No image URL found');
      return null;
    }
  } catch (error) {
    console.error('❌ Open Food Facts lookup failed:', error);
  }
  return null;
}

export default function EditProductScreen() {
  const { id, ids } = useLocalSearchParams<{ id: string; ids?: string }>();
  const router = useRouter();
  const [currentId, setCurrentId] = useState(Number(id));
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());
  const [showImageFullscreen, setShowImageFullscreen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const productList = useMemo(() => {
    const ids_arr = ids ? ids.split(',').map(Number).filter(Boolean) : [];
    return ids_arr.filter((nid) => !skippedIds.has(nid)).map((nid) => ({ id: nid }));
  }, [ids, skippedIds]);

  const currentIndex = useMemo(() => {
    const idx = productList.findIndex((p) => p.id === currentId);
    return idx >= 0 ? idx : 0;
  }, [productList, currentId]);

  const prevId = productList.length > 1 ? productList[(currentIndex - 1 + productList.length) % productList.length]?.id : null;
  const nextId = productList.length > 1 ? productList[(currentIndex + 1) % productList.length]?.id : null;

  useEffect(() => {
    setCurrentId(Number(id));
    slideAnim.setValue(0);
  }, [id]);

  useLayoutEffect(() => {
    slideAnim.setValue(0);
  }, [currentId]);

  useEffect(() => {
    if (prevId) fetchProductData(prevId);
    fetchProductData(currentId);
    if (nextId) fetchProductData(nextId);
  }, [currentId, prevId, nextId]);

  useRealtimeRefresh(
    ['products:changed', 'checks:changed', 'aisles:changed'],
    useCallback(() => {
      productDataCache.delete(currentId);
      fetchProductData(currentId);
    }, [currentId])
  );

  const animateAndSwipe = (direction: 'left' | 'right', newId: number) => {
    const exitValue = direction === 'left' ? -SCREEN_WIDTH : SCREEN_WIDTH;
    Animated.timing(slideAnim, {
      toValue: exitValue,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setCurrentId(newId);
    });
  };

  const handleSwipeLeft = async () => {
    if (productList.length <= 1 || !nextId) return;
    await fetchProductData(nextId);
    animateAndSwipe('left', nextId);
  };

  const handleSwipeRight = async () => {
    if (productList.length <= 1 || !prevId) return;
    await fetchProductData(prevId);
    animateAndSwipe('right', prevId);
  };

  const swipeGesture = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      if (productList.length <= 1) return;
      slideAnim.setValue(e.translationX);
    })
    .onEnd((e) => {
      if (productList.length <= 1) return;
      if (e.translationX < -80) {
        handleSwipeLeft();
      } else if (e.translationX > 80) {
        handleSwipeRight();
      } else {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      }
    }), [currentIndex, productList, nextId, prevId]);

  return (
    <>
      <Stack.Screen
        options={{
          title: productDataCache.get(currentId)?.product?.name || 'Produit',
          headerBackTitle: 'Retour',
        }}
      />

      <View style={styles.carouselContainer}>
        <GestureDetector gesture={swipeGesture}>
          <Animated.View
            style={[
              styles.carouselRow,
              { transform: [{ translateX: -SCREEN_WIDTH }, { translateX: slideAnim }] },
            ]}
          >
            {[prevId, currentId, nextId].map((pId, index) => (
              pId && <ProductEditView
                key={index}
                id={pId}
                isActive={pId === currentId}
                pointerEvents={pId === currentId ? 'auto' : 'none'}
              />
            ))}
          </Animated.View>
        </GestureDetector>
      </View>

      <Modal visible={showImageFullscreen} transparent onRequestClose={() => setShowImageFullscreen(false)}>
        <Pressable style={styles.modalContainer} onPress={() => setShowImageFullscreen(false)}>
          <Image
            source={{ uri: productDataCache.get(currentId)?.product?.image_uri! }}
            style={styles.fullscreenImage}
            resizeMode="contain"
          />
          <TouchableOpacity style={styles.closeButton} onPress={() => setShowImageFullscreen(false)}>
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </Pressable>
      </Modal>

      <CameraCapture
        visible={showCamera}
        onCapture={async (uri) => {
          const dir = new Directory(Paths.document, 'product_images');
          if (!dir.exists) dir.create();
          const fileName = 'photo_' + Date.now() + '.jpg';
          const source = new ExpoFile(uri);
          const dest = new ExpoFile(dir, fileName);
          source.copy(dest);
          const prod = productDataCache.get(currentId)?.product;
          if (prod) {
            await updateProduct(prod.id, prod.name, prod.category, prod.barcode ?? undefined, dest.uri, prod.aisle_id);
            productDataCache.delete(currentId);
            fetchProductData(currentId);
          }
          setShowCamera(false);
        }}
        onClose={() => setShowCamera(false)}
      />

      <Modal visible={showEditNameModal} transparent animationType="slide" onRequestClose={() => setShowEditNameModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowEditNameModal(false)}>
          <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={styles.editNameModalContent}>
                <View style={styles.editNameModalHeader}>
                  <Text style={styles.editNameModalTitle}>Modifier le nom du produit</Text>
                  <TouchableOpacity onPress={() => setShowEditNameModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={24} color={Colors.text} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.editNameInput}
                  placeholder="Nom du produit"
                  placeholderTextColor={Colors.textLight}
                  defaultValue={productDataCache.get(currentId)?.product?.name}
                  onChangeText={(text) => {
                    const prod = productDataCache.get(currentId)?.product;
                    if (prod) prod.name = text;
                  }}
                  autoFocus
                  selectTextOnFocus
                />
                <TouchableOpacity
                  style={styles.editNameButtonSubmit}
                  onPress={async () => {
                    const prod = productDataCache.get(currentId)?.product;
                    if (prod) {
                      await updateProduct(prod.id, prod.name, prod.category, prod.barcode ?? undefined, prod.image_uri, prod.aisle_id);
                      productDataCache.delete(currentId);
                    }
                    setShowEditNameModal(false);
                  }}
                >
                  <Text style={styles.editNameButtonText}>Valider</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
}

interface ProductEditViewProps {
  id: number;
  isActive: boolean;
  pointerEvents: 'auto' | 'none';
}

function ProductEditView({ id, isActive, pointerEvents }: ProductEditViewProps) {
  // Only keep UI state, derive data synchronously
  const [aisles, setAisles] = useState<Aisle[]>([]);
  const [showAisleDropdown, setShowAisleDropdown] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const [cacheVersion, setCacheVersion] = useState(0);

  // Editable form fields - these can be modified
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Autre');
  const [barcode, setBarcode] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [selectedAisleId, setSelectedAisleId] = useState<number | null>(null);
  const [dlcDate, setDlcDate] = useState(getTodayStr());

  // Calculate data synchronously from cache - changes immediately with id or when cache updates
  const { product, isRupture } = useMemo(() => {
    const cached = productDataCache.get(id);
    const prod = cached?.product ?? null;
    const isRup = cached?.history && cached.history.length > 0 && cached.history[0].status === 'rupture';
    return { product: prod, isRupture: isRup };
  }, [id, cacheVersion]);

  const loadProduct = useCallback(async () => {
    const data = await fetchProductData(id);
    if (data) {
      const p = data.product;
      setName(p.name);
      setCategory(p.category);
      setBarcode(p.barcode ?? '');
      setImageUri(p.image_uri);
      setSelectedAisleId(p.aisle_id);
      let dlc = getTodayStr();
      if (data.history.length > 0 && data.history[0].next_expiry_date) {
        dlc = data.history[0].next_expiry_date;
      } else if (p.initial_expiry_date) {
        dlc = p.initial_expiry_date;
      }
      setDlcDate(dlc);
      const allAisles = await getAllAisles();
      setAisles(allAisles);
    }
  }, [id]);

  // Reset all state synchronously when id changes - BEFORE render
  useLayoutEffect(() => {
    const cached = productDataCache.get(id);
    setName(cached?.product?.name ?? '');
    setCategory(cached?.product?.category ?? 'Autre');
    setBarcode(cached?.product?.barcode ?? '');
    setImageUri(cached?.product?.image_uri ?? null);
    setSelectedAisleId(cached?.product?.aisle_id ?? null);

    // Then load fresh data
    loadProduct();
  }, [id, loadProduct]);

  // Auto-fetch image from Open Food Facts if barcode changes
  useEffect(() => {
    if (barcode && barcode.trim()) {
      const lookupImage = async () => {
        try {
          const result = await fetchFromOpenFoodFacts(barcode.trim());
          console.log('📦 API Result:', JSON.stringify(result));

          if (result?.imageUrl) {
            console.log('✓ Image URL found:', result.imageUrl);

            // Download and cache image locally
            const localImagePath = await downloadAndCacheImage(result.imageUrl);
            const finalImageUri = localImagePath || result.imageUrl;

            setImageUri(finalImageUri);

            if (result.name && !name) {
              setName(result.name);
            }

            // Save to database immediately so it persists
            if (product) {
              console.log('💾 Saving image to database...');
              await updateProduct(
                product.id,
                name || product.name,
                category || product.category,
                barcode.trim() || undefined,
                finalImageUri,
                selectedAisleId || product.aisle_id || undefined
              );
              // Update cache with new image
              const cached = productDataCache.get(product.id);
              if (cached) {
                cached.product.image_uri = finalImageUri;
                productDataCache.set(product.id, cached);
              }
            }
          } else {
            console.log('⚠️ No image URL in result:', result);
          }
        } catch (error) {
          console.error('❌ Erreur:', error);
        }
      };

      lookupImage();
    }
  }, [barcode]);

  if (!product) return <View style={{ flex: 1, width: SCREEN_WIDTH }} />;

  return (
    <View style={[styles.carouselSlot, { pointerEvents }]}>
      {isRupture && (
        <View style={styles.ruptureBanner}>
          <Ionicons name="alert-circle" size={20} color="#FFF" />
          <Text style={styles.ruptureBannerText}>En rupture de stock</Text>
        </View>
      )}

      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" scrollEnabled={isActive}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: 'red', marginBottom: 10 }}>
            ❌ NOM DU PRODUIT EN ROUGE
          </Text>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 10 }}>
            🔍 Barcode: {barcode || '(vide)'}
          </Text>
          <Text style={{ fontSize: 12, color: '#666', marginBottom: 20 }}>
            Nom: {name || '(vide)'} | Image URI: {imageUri ? '✓ Défini' : '✗ Vide'}
          </Text>

          <Text style={styles.label}>Photo du produit</Text>
          <TouchableOpacity
            style={styles.photoContainer}
            onPress={() => {}}
            activeOpacity={0.7}
            disabled={!isActive}
          >
            {imageUri ? (
              <>
                <Text style={{ fontSize: 12, color: '#333', textAlign: 'center', paddingHorizontal: 10 }}>
                  {imageUri}
                </Text>
              </>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera-outline" size={40} color={Colors.textLight} />
                <Text style={styles.photoPlaceholderText}>Prendre une photo</Text>
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Categorie</Text>
          <View style={styles.categoryGrid}>
            {Categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, category === cat && styles.categoryChipSelected]}
                onPress={() => setCategory(cat)}
                disabled={!isActive}
              >
                <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextSelected]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Rayon (optionnel)</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowAisleDropdown(!showAisleDropdown)}
            activeOpacity={0.7}
            disabled={!isActive}
          >
            <Ionicons name="storefront-outline" size={20} color="#E3001B" />
            <Text style={styles.dateButtonText}>
              {selectedAisleId ? aisles.find(a => a.id === selectedAisleId)?.name || '(Sans nom)' : 'Sélectionner un rayon'}
            </Text>
            <Ionicons name={showAisleDropdown ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          {showAisleDropdown && (
            <View style={styles.dropdownContent}>
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setSelectedAisleId(null); setShowAisleDropdown(false); }}
              >
                <Text style={[styles.dropdownItemText, !selectedAisleId && styles.dropdownItemTextActive]}>
                  Aucun rayon
                </Text>
              </TouchableOpacity>
              {aisles.map((aisle) => (
                <TouchableOpacity
                  key={aisle.id}
                  style={styles.dropdownItem}
                  onPress={() => { setSelectedAisleId(aisle.id); setShowAisleDropdown(false); }}
                >
                  <Text style={[styles.dropdownItemText, selectedAisleId === aisle.id && styles.dropdownItemTextActive]}>
                    {aisle.name || '(Sans nom)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.label}>Date limite de consommation (DLC) *</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowCalendar(!showCalendar)}
            activeOpacity={0.7}
            disabled={!isActive}
          >
            <Ionicons name="calendar-outline" size={20} color="#E3001B" />
            <Text style={styles.dateButtonText}>{dlcDate ? formatDateFR(dlcDate) : 'Sélectionner une date'}</Text>
            <Ionicons name={showCalendar ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
          </TouchableOpacity>

          {showCalendar && (
            <Calendar
              selectedDate={dlcDate}
              onSelectDate={(date) => { setDlcDate(date); setShowCalendar(false); }}
            />
          )}

          <Text style={styles.label}>Code-barres (optionnel)</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: 3017620422003"
            placeholderTextColor={Colors.textLight}
            value={barcode}
            onChangeText={(text) => {
              console.log('📝 Barcode changed to:', text);
              setBarcode(text);
            }}
            keyboardType="numeric"
            editable={isActive}
          />

          <TouchableOpacity
            style={styles.saveButton}
            onPress={async () => {
              if (product) {
                const finalBarcode = barcode.trim();
                await updateProduct(product.id, name, category, finalBarcode || undefined, imageUri ?? undefined, selectedAisleId ?? undefined);

                // Update barcode cache
                if (finalBarcode) {
                  const cache = await AsyncStorage.getItem(BARCODE_CACHE_KEY)
                    .then((str) => (str ? JSON.parse(str) : {}))
                    .catch(() => ({}));
                  cache[finalBarcode] = product.id;
                  await AsyncStorage.setItem(BARCODE_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
                }

                productDataCache.delete(product.id);
              }
            }}
            disabled={!isActive}
          >
            <Ionicons name="checkmark" size={22} color="#FFF" />
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  carouselContainer: { flex: 1, overflow: 'hidden' },
  carouselRow: { flex: 1, flexDirection: 'row', width: SCREEN_WIDTH * 3 },
  carouselSlot: { width: SCREEN_WIDTH, flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 40 },
  ruptureBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#DC2626', paddingVertical: 12, paddingHorizontal: 20 },
  ruptureBannerText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  label: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  photoContainer: { width: '100%', height: 200, borderRadius: 16, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 8 },
  photoOverlayText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  photoPlaceholder: { alignItems: 'center', gap: 8 },
  photoPlaceholderText: { fontSize: 14, color: Colors.textLight, fontWeight: '500' },
  input: { backgroundColor: Colors.card, padding: 14, borderRadius: 12, fontSize: 16, color: Colors.text, borderWidth: 1.5, borderColor: Colors.border },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border },
  categoryChipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  categoryChipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  categoryChipTextSelected: { color: '#FFF' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, padding: 16, borderRadius: 14, gap: 10, marginTop: 32, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  saveButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  fullscreenImage: { width: '100%', height: '100%' },
  closeButton: { position: 'absolute', top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  dateButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: 14, borderRadius: 12, gap: 10, borderWidth: 1.5, borderColor: Colors.border },
  dateButtonText: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.text },
  dropdownContent: { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12, marginTop: -8, marginBottom: 8, overflow: 'hidden' },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dropdownItemText: { fontSize: 16, color: Colors.text },
  dropdownItemTextActive: { fontWeight: '700', color: '#E3001B' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  editNameModalContent: { backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 16 },
  editNameModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  editNameModalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  editNameInput: { backgroundColor: Colors.card, padding: 14, borderRadius: 12, fontSize: 16, color: Colors.text, borderWidth: 1.5, borderColor: Colors.border },
  editNameButtonSubmit: { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  editNameButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
