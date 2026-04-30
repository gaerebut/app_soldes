import { useCallback, useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  Platform,
  Image,
  Modal,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  TextInput,
  Animated,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Paths, Directory, File as ExpoFile } from 'expo-file-system';
import { Colors } from '../../src/constants/theme';
import { getPricerToken, getCodeAnabel } from '../../src/api/client';
import {
  Product,
  recordCheck,
  getCheckHistory,
  updateProduct,
  getProductById,
} from '../../src/database/products';
import { apiClient } from '../../src/api/client';
import { getTodayStr, formatDateFR } from '../../src/utils/date';
import { useRealtimeRefresh } from '../../src/realtime/useRealtimeRefresh';
import Calendar from '../../src/components/Calendar';
import CameraCapture from '../../src/components/CameraCapture';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { getAllAisles, Aisle } from '../../src/database/aisles';

const SCREEN_WIDTH = Dimensions.get('window').width;

// Cache module-level
const productDataCache = new Map<number, { product: Product; ruptureHistory: any[] }>();
let aislesCache: Aisle[] | null = null;

async function fetchAislesOnce(): Promise<Aisle[]> {
  if (aislesCache) return aislesCache;
  const all = await getAllAisles();
  aislesCache = all;
  return all;
}

async function fetchProductData(id: number) {
  if (productDataCache.has(id)) return productDataCache.get(id)!;
  const p = await getProductById(id);
  const history = await getCheckHistory(id, 100);
  if (p) {
    productDataCache.set(id, { product: p, ruptureHistory: history });
    return productDataCache.get(id)!;
  }
  return null;
}

// Fetch product info from Open Food Facts using official SDK
async function fetchFromOpenFoodFacts(barcode: string): Promise<{ name?: string; imageUrl?: string } | null> {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    if (!response.ok) throw new Error('Network error');

    const data = await response.json();

    if (data.status === 0 || !data.product) {
      console.log('Produit non trouvé');
      return null;
    }

    const imageUrl = data.product.image_front_url || data.product.image_url;
    const name = data.product.product_name;

    if (imageUrl) {
      return {
        name: name,
        imageUrl: imageUrl,
      };
    }
  } catch (error) {
    console.log('Open Food Facts lookup failed:', error);
  }
  return null;
}

export default function CheckScreen() {
  const { id, ids } = useLocalSearchParams<{ id: string; ids?: string }>();
  const router = useRouter();
  const [currentId, setCurrentId] = useState(Number(id));
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());
  const [showImageFullscreen, setShowImageFullscreen] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const today = getTodayStr();
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Appelé quand un produit est introuvable (ex: BDD réinitialisée)
  const handleProductNotFound = useCallback(async () => {
    // Retrouve le code-barres lié à cet ID avant de vider le cache
    const cacheStr = await AsyncStorage.getItem('dlc_barcode_cache').catch(() => null);
    const cache = cacheStr ? JSON.parse(cacheStr) : {};
    const barcode = Object.keys(cache).find((k) => cache[k] === currentId) ?? '';
    // Vide tout le cache (les autres IDs sont aussi périmés après une réinit BDD)
    await AsyncStorage.removeItem('dlc_barcode_cache').catch(() => {});
    // Redirige vers l'ajout, avec le barcode si on l'a (déclenche la recherche auto)
    router.replace(barcode ? `/product/add?barcode=${barcode}` : '/product/add');
  }, [router, currentId]);

  const todayProductList = useMemo(() => {
    const navIds = ids ? ids.split(',').map(Number).filter(Boolean) : [];
    return navIds.filter((nid) => !skippedIds.has(nid)).map((nid) => ({ id: nid }));
  }, [ids, skippedIds]);

  const currentProductIndex = useMemo(() => {
    const idx = todayProductList.findIndex((p) => p.id === currentId);
    return idx >= 0 ? idx : 0;
  }, [todayProductList, currentId]);

  const prevId = todayProductList.length > 1 ? todayProductList[(currentProductIndex - 1 + todayProductList.length) % todayProductList.length]?.id : null;
  const nextId = todayProductList.length > 1 ? todayProductList[(currentProductIndex + 1) % todayProductList.length]?.id : null;

  useEffect(() => {
    setCurrentId(Number(id));
    slideAnim.setValue(0);
  }, [id]);

  useEffect(() => {
    fetchAislesOnce();
    if (prevId) fetchProductData(prevId);
    fetchProductData(currentId);
    if (nextId) fetchProductData(nextId);
  }, [currentId, prevId, nextId]);

  useRealtimeRefresh(
    ['products:changed', 'checks:changed', 'aisles:changed'],
    useCallback(() => {
      productDataCache.delete(currentId);
      aislesCache = null;
      fetchProductData(currentId);
    }, [currentId])
  );

  useLayoutEffect(() => {
    slideAnim.setValue(0);
  }, [currentId]);

  useLayoutEffect(() => {
    slideAnim.setValue(0);
  }, [currentId]);

  const animateAndSwipe = (direction: 'left' | 'right', newId: number) => {
    const exitValue = direction === 'left' ? -SCREEN_WIDTH : SCREEN_WIDTH;
    Animated.timing(slideAnim, {
      toValue: exitValue,
      duration: 200,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setCurrentId(newId);
      }
    });
  };

  const handleSwipeLeft = async () => {
    if (todayProductList.length <= 1 || !nextId) return;
    await fetchProductData(nextId);
    animateAndSwipe('left', nextId);
  };

  const handleSwipeRight = async () => {
    if (todayProductList.length <= 1 || !prevId) return;
    await fetchProductData(prevId);
    animateAndSwipe('right', prevId);
  };

  const swipeGesture = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      if (todayProductList.length <= 1) return;
      slideAnim.setValue(e.translationX);
    })
    .onEnd((e) => {
      if (todayProductList.length <= 1) return;
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
    }), [currentProductIndex, todayProductList, nextId, prevId]);

  const goToNextProduct = () => {
    if (todayProductList.length <= 1) {
      setSkippedIds((prev) => {
        const next = new Set(prev);
        next.add(currentId);
        return next;
      });
      router.back();
      return;
    }
    const nextIndex = (currentProductIndex + 1) % todayProductList.length;
    const nextIdVal = todayProductList[nextIndex].id;
    setSkippedIds((prev) => {
      const next = new Set(prev);
      next.add(currentId);
      return next;
    });
    animateAndSwipe('left', nextIdVal);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: productDataCache.get(currentId)?.product?.name || 'Produit',
          headerBackTitle: 'Retour',
          headerBackButtonDisplayMode: 'generic',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerBackButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.6}
            >
              <Ionicons name="chevron-back" size={26} color="#000000" />
              <Text style={styles.headerBackText}>Retour</Text>
            </TouchableOpacity>
          ),
          headerTitle: () => (
            <TouchableOpacity
              onPress={() => setShowEditNameModal(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.6}
              style={styles.headerTitleTouchable}
            >
              <Text style={styles.headerTitleText} numberOfLines={1}>
                {productDataCache.get(currentId)?.product?.name || 'Produit'}
              </Text>
              <Ionicons name="pencil" size={14} color={Colors.textSecondary} style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          ),
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
              pId ? <ProductCheckView
                key={index}
                id={pId}
                isActive={pId === currentId}
                today={today}
                onGoToNext={goToNextProduct}
                onShowImage={() => setShowImageFullscreen(true)}
                onShowCamera={() => setShowCamera(true)}
                onShowEditName={() => setShowEditNameModal(true)}
                onNotFound={handleProductNotFound}
                pointerEvents={pId === currentId ? 'auto' : 'none'}
              /> : <View key={index} style={{ width: SCREEN_WIDTH }} />
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
          <View style={styles.eanOverlay}>
            <Text style={styles.eanOverlayText}>{productDataCache.get(currentId)?.product?.barcode || 'N/A'}</Text>
          </View>
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
            let finalImageUri = dest.uri;
            // Upload photo to server
            try {
              const uploadResult = await apiClient.products.uploadPhoto(prod.id, dest.uri);
              finalImageUri = uploadResult?.image_uri || dest.uri;
            } catch (error) {
              console.error('Photo upload error (non-critical):', error);
              // Continue with local URI if upload fails
            }
            await updateProduct(prod.id, prod.name, prod.category, prod.barcode ?? undefined, finalImageUri);
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
                      await updateProduct(prod.id, prod.name, prod.category, prod.barcode ?? undefined, prod.image_uri);
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

interface ProductCheckViewProps {
  id: number;
  isActive: boolean;
  today: string;
  onGoToNext: () => void;
  onShowImage: () => void;
  onShowCamera: () => void;
  onShowEditName: () => void;
  onNotFound?: () => void;
  pointerEvents: 'auto' | 'none';
}

function ProductCheckView({
  id,
  isActive,
  today,
  onGoToNext,
  onShowImage,
  onShowCamera,
  onShowEditName,
  onNotFound,
  pointerEvents,
}: ProductCheckViewProps) {
  const cached = productDataCache.get(id);
  const [product, setProduct] = useState<Product | null>(cached?.product ?? null);
  const [ruptureHistory, setRuptureHistory] = useState<any[]>(cached?.ruptureHistory?.filter((h: any) => h.status === 'rupture') ?? []);
  const [selectedDate, setSelectedDate] = useState((cached?.ruptureHistory && cached.ruptureHistory.length > 0 && cached.ruptureHistory[0].next_expiry_date) ? cached.ruptureHistory[0].next_expiry_date : today);
  const [showCalendar, setShowCalendar] = useState(!(cached?.ruptureHistory && cached.ruptureHistory.length > 0 && cached.ruptureHistory[0].status === 'rupture'));
  const [isRupture, setIsRupture] = useState(!!(cached?.ruptureHistory && cached.ruptureHistory.length > 0 && cached.ruptureHistory[0].status === 'rupture'));
  const [newRuptureDLC, setNewRuptureDLC] = useState('');
  const [showRuptureCalendar, setShowRuptureCalendar] = useState(!!(cached?.ruptureHistory && cached.ruptureHistory.length > 0 && cached.ruptureHistory[0].status === 'rupture'));
  const [aisles, setAisles] = useState<Aisle[]>(aislesCache ?? []);
  const [showAisleDropdown, setShowAisleDropdown] = useState(false);
  const [flashing, setFlashing] = useState(false);

  const handleFlashEtiquette = async () => {
    if (!product?.barcode) {
      Alert.alert('EAN manquant', 'Ce produit n\'a pas de code-barres EAN.');
      return;
    }
    const [pricerToken, codeAnabel] = await Promise.all([getPricerToken(), getCodeAnabel()]);
    if (!pricerToken || !codeAnabel) {
      Alert.alert('Pricer non configuré', 'Le token Pricer ou le code Anabel est manquant. Reconnectez-vous.');
      return;
    }
    setFlashing(true);
    try {
      const url = `https://${codeAnabel}.carrefour-fr.pcm.pricer-plaza.com/api/public/core/v1/flash/items`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${pricerToken}`,
        },
        body: JSON.stringify({
          configuration: {
            duration: 4,
            realTime: true,
            color: '#ff0000',
            flashType: 30,
          },
          itemIds: [product.barcode],
        }),
      });
      if (res.ok) {
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const text = await res.text().catch(() => '');
        Alert.alert('Erreur Pricer', `Code ${res.status}${text ? ' : ' + text : ''}`);
      }
    } catch (err: any) {
      Alert.alert('Erreur réseau', err.message || 'Impossible de contacter le serveur Pricer.');
    } finally {
      setFlashing(false);
    }
  };

  const loadData = useCallback(async () => {
    const data = await fetchProductData(id);
    if (data) {
      setProduct(data.product);
      const ruptures = data.ruptureHistory.filter((h) => h.status === 'rupture');
      setRuptureHistory(ruptures);
      const isRupNow = data.ruptureHistory.length > 0 && data.ruptureHistory[0].status === 'rupture';
      setIsRupture(isRupNow);
      setShowCalendar(!isRupNow);
      setShowRuptureCalendar(isRupNow);
      const dlc = data.ruptureHistory.length > 0 && data.ruptureHistory[0].next_expiry_date ? data.ruptureHistory[0].next_expiry_date : today;
      setSelectedDate(dlc);
      const allAisles = await fetchAislesOnce();
      setAisles(allAisles);
    } else {
      // Produit introuvable (BDD réinitialisée ou ID invalide) → rediriger vers la création
      onNotFound?.();
    }
  }, [id, onNotFound]);

  // Reset all state synchronously when id changes - BEFORE render
  useLayoutEffect(() => {
    const cached = productDataCache.get(id);
    setProduct(cached?.product ?? null);
    setRuptureHistory(cached?.ruptureHistory?.filter((h: any) => h.status === 'rupture') ?? []);
    const cachedRupture = !!(cached?.ruptureHistory && cached.ruptureHistory.length > 0 && cached.ruptureHistory[0].status === 'rupture');
    const cachedDate = (cached?.ruptureHistory && cached.ruptureHistory.length > 0 && cached.ruptureHistory[0].next_expiry_date)
      ? cached.ruptureHistory[0].next_expiry_date
      : today;
    setSelectedDate(cachedDate);
    setShowCalendar(!cachedRupture);
    setShowRuptureCalendar(cachedRupture);
    setIsRupture(cachedRupture);

    // Then load fresh data
    loadData();
  }, [id, loadData]);

  if (!product) return <View style={{ flex: 1, width: SCREEN_WIDTH }} />;

  const isOverdue = !isRupture && selectedDate !== '' && selectedDate < today;
  const daysOverdue = isOverdue ? Math.ceil((new Date(today).getTime() - new Date(selectedDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

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
          <View style={[styles.header, isOverdue && styles.headerOverdue]}>
            {product.image_uri && (
              <TouchableOpacity onPress={onShowImage}>
                <Image source={{ uri: product.image_uri }} style={[styles.productImage, isOverdue && styles.productImageOverdue]} />
                <View style={styles.photoOverlay}>
                  <Ionicons name="expand-outline" size={28} color="#FFF" />
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.changePhotoButton} onPress={onShowCamera} disabled={!isActive}>
              <Ionicons name="camera" size={16} color="#FFF" />
              <Text style={styles.changePhotoText}>Changer la photo</Text>
            </TouchableOpacity>

            {/* Bouton flash étiquette — petit, en haut à droite */}
            {product?.barcode && (
              <TouchableOpacity
                style={[styles.flashBadge, flashing && styles.flashBadgeActive]}
                onPress={handleFlashEtiquette}
                disabled={flashing || !isActive}
                activeOpacity={0.75}
              >
                {flashing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="pricetag" size={16} color="#FFF" />
                    <Ionicons name="flash" size={11} color="#FFD700" style={styles.flashBadgeIcon} />
                  </>
                )}
              </TouchableOpacity>
            )}
            {!isRupture && (
              product.barcode && (
                <View style={styles.eanRow}>
                  <Ionicons name="barcode-outline" size={18} color={Colors.textSecondary} />
                  <Text style={styles.eanText}>{product.barcode}</Text>
                </View>
              )
            )}
          </View>

          {!isRupture && (
            <View style={styles.aisleCompactWrap}>
              <TouchableOpacity style={styles.aisleCompactButton} onPress={() => setShowAisleDropdown(!showAisleDropdown)} activeOpacity={0.7}>
                <Ionicons name="storefront-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.aisleCompactLabel}>Rayon :</Text>
                <Text style={styles.aisleCompactValue} numberOfLines={1}>
                  {product.aisle_id ? aisles.find((a) => a.id === product.aisle_id)?.name || '(Sans nom)' : 'Aucun'}
                </Text>
                <Ionicons name={showAisleDropdown ? 'chevron-up' : 'chevron-down'} size={13} color={Colors.textSecondary} />
              </TouchableOpacity>
              {showAisleDropdown && (
                <View style={styles.aisleDropdownCompact}>
                  <TouchableOpacity style={styles.aisleDropdownItem} onPress={() => { updateProduct(product.id, product.name, product.category, product.barcode ?? undefined, product.image_uri, undefined); setShowAisleDropdown(false); }}>
                    <Text style={[styles.aisleDropdownItemText, !product.aisle_id && styles.aisleDropdownItemTextActive]}>Aucun rayon</Text>
                  </TouchableOpacity>
                  {aisles.map((a) => (
                    <TouchableOpacity key={a.id} style={styles.aisleDropdownItem} onPress={() => { updateProduct(product.id, product.name, product.category, product.barcode ?? undefined, product.image_uri, a.id); setShowAisleDropdown(false); }}>
                      <Text style={[styles.aisleDropdownItemText, product.aisle_id === a.id && styles.aisleDropdownItemTextActive]}>{a.name || '(Sans nom)'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {!isRupture && (
            <Calendar selectedDate={selectedDate || today} onSelectDate={(date) => { setSelectedDate(date); }} />
          )}

          {isRupture && (
            <>
              <Text style={styles.sectionTitle}>Nouvelle date ou remettre en stock</Text>
              <Calendar selectedDate={newRuptureDLC} onSelectDate={(date) => { setNewRuptureDLC(date); }} />
            </>
          )}

          {!isRupture && (
            <View style={styles.actions}>
              {selectedDate && (
                <TouchableOpacity style={styles.okButton} onPress={async () => { await recordCheck(id, today, 'ok', selectedDate); productDataCache.delete(id); onGoToNext(); }} disabled={!isActive}>
                  <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                  <Text style={styles.okButtonText}>Valider la DLC</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.ruptureButton} onPress={() => Alert.alert('Confirmer la rupture', `Declarer "${product?.name}" en rupture de stock ?`, [{ text: 'Annuler', style: 'cancel' }, { text: 'Confirmer', style: 'destructive', onPress: async () => { await recordCheck(id, today, 'rupture'); productDataCache.delete(id); onGoToNext(); } }])} disabled={!isActive}>
                <Ionicons name="close-circle" size={24} color={Colors.danger} />
                <Text style={styles.ruptureButtonText}>Declarer en rupture</Text>
              </TouchableOpacity>
            </View>
          )}

          {isRupture && newRuptureDLC && (
            <View style={styles.actions}>
              <TouchableOpacity style={styles.okButton} onPress={async () => { await recordCheck(id, today, 'ok', newRuptureDLC); productDataCache.delete(id); }} disabled={!isActive}>
                <Ionicons name="checkmark-circle" size={24} color="#FFF" />
                <Text style={styles.okButtonText}>Valider la DLC</Text>
              </TouchableOpacity>
            </View>
          )}

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
  header: { backgroundColor: Colors.card, padding: 20, borderRadius: 16, marginBottom: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  headerOverdue: { borderWidth: 2.5, borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  productImage: { width: 140, height: 140, borderRadius: 14, marginBottom: 14 },
  productImageOverdue: { borderWidth: 3, borderColor: '#DC2626' },
  photoOverlay: { position: 'absolute', width: 140, height: 140, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  ruptureBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#DC2626', paddingVertical: 12, paddingHorizontal: 20 },
  ruptureBannerText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  overdueBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#DC2626', paddingVertical: 14, paddingHorizontal: 20, borderBottomWidth: 3, borderBottomColor: '#991B1B' },
  overdueBannerText: { fontSize: 15, fontWeight: '800', color: '#FFF', flex: 1, textAlign: 'center' },
  overdueDateBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginTop: 10 },
  overdueDateBadgeText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  changePhotoButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E3001B', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  changePhotoText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  eanRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  eanText: { fontSize: 18, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
  aisleCompactWrap: { marginBottom: 12 },
  aisleCompactButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  aisleCompactLabel: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  aisleCompactValue: { fontSize: 12, color: Colors.text, fontWeight: '700', maxWidth: 160 },
  aisleDropdownCompact: { marginTop: 6, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, overflow: 'hidden', alignSelf: 'flex-start', minWidth: 180 },
  aisleDropdownItem: { paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  aisleDropdownItemText: { fontSize: 13, color: Colors.text },
  aisleDropdownItemTextActive: { fontWeight: '700', color: '#E3001B' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },
  dateButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: 14, borderRadius: 12, gap: 10, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  dateButtonText: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.text },
  actions: { gap: 12, marginTop: 20, marginBottom: 28 },
  okButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.success, padding: 16, borderRadius: 14, gap: 10, shadowColor: Colors.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  okButtonText: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  ruptureButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dangerLight, padding: 16, borderRadius: 14, gap: 10 },
  ruptureButtonText: { color: Colors.danger, fontSize: 17, fontWeight: '700' },
  noRuptureContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.successLight, padding: 14, borderRadius: 12 },
  noRuptureText: { fontSize: 14, color: Colors.success, fontWeight: '500', flex: 1 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.card, padding: 12, borderRadius: 10, marginBottom: 6 },
  historyDate: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
  fullscreenImage: { width: '100%', height: '100%' },
  eanOverlay: { position: 'absolute', bottom: 32, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  eanOverlayText: { fontSize: 18, fontWeight: '700', color: '#FFF', letterSpacing: 1, fontVariant: ['tabular-nums'] },
  closeButton: { position: 'absolute', top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  headerBackButton: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  headerBackText: { fontSize: 17, fontWeight: '400', color: '#000000', marginLeft: -2 },
  headerTitleTouchable: { flexDirection: 'row', alignItems: 'center' },
  headerTitleText: { fontSize: 17, fontWeight: '700', color: '#000000', maxWidth: 220 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  editNameModalContent: { backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32, gap: 16 },
  editNameModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  editNameModalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  editNameInput: { backgroundColor: Colors.card, padding: 14, borderRadius: 12, fontSize: 16, color: Colors.text, borderWidth: 1.5, borderColor: Colors.border },
  editNameButtonSubmit: { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center' },
  editNameButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  flashBadge: {
    position: 'absolute', top: 8, right: 8,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#7C3AED',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
  },
  flashBadgeActive: { backgroundColor: '#5B21B6', opacity: 0.8 },
  flashBadgeIcon: { position: 'absolute', bottom: 5, right: 5 },
});
