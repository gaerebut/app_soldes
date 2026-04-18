import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/theme';
import {
  ProductWithStatus,
  getProductsForDate,
  getRuptureProducts,
  getCheckedToday,
  getOverdueProducts,
  getTodayExpiryProducts,
} from '../src/database/products';
import { getTodayStr, formatDateShort, formatDateFR, toLocalDateStr } from '../src/utils/date';

type Tab = 'a_traiter' | 'rupture';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('a_traiter');
  const [products, setProducts] = useState<ProductWithStatus[]>([]);
  const [overdueProducts, setOverdueProducts] = useState<ProductWithStatus[]>([]);
  const [todayExpiryProducts, setTodayExpiryProducts] = useState<ProductWithStatus[]>([]);
  const [ruptureProducts, setRuptureProducts] = useState<ProductWithStatus[]>([]);
  const [checkedProducts, setCheckedProducts] = useState<Array<ProductWithStatus & { check_status: string }>>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [showChecked, setShowChecked] = useState(true);
  const [expandHistory, setExpandHistory] = useState(false);
  const [productCountByDay, setProductCountByDay] = useState<Record<string, number>>({});
  const [todayPendingCount, setTodayPendingCount] = useState(0);
  const router = useRouter();

  const loadData = useCallback(async () => {
    const today = getTodayStr();
    const [daily, overdue, todayExpiry, rupture, checked, todayProducts] = await Promise.all([
      getProductsForDate(selectedDate),
      getOverdueProducts(),
      getTodayExpiryProducts(),
      getRuptureProducts(),
      getCheckedToday(),
      getProductsForDate(today),
    ]);
    setProducts(daily);
    setOverdueProducts(overdue);
    setTodayExpiryProducts(todayExpiry);
    setRuptureProducts(rupture);
    setCheckedProducts(checked);

    // Count pending products for today (overdue + today expiry, excluding checked)
    const overduePending = overdue.filter((p) => !p.checked_today).length;
    const todayExpiryPending = todayExpiry.filter((p) => !p.checked_today).length;
    setTodayPendingCount(overduePending + todayExpiryPending);
  }, [selectedDate]);

  const loadProductCountByDay = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const dateStr = toLocalDateStr(d);
      const dayProducts = await getProductsForDate(dateStr);
      counts[dateStr] = dayProducts.length;
    }
    setProductCountByDay(counts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadProductCountByDay();
    }, [loadData, loadProductCountByDay])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Products not yet checked
  const pendingProducts = products.filter((p) => !p.checked_today);

  // Display logic for today's date
  const isViewingToday = selectedDate === getTodayStr();
  // For today: exclude todayExpiry products from list (they're shown in header section)
  // For other dates: show all pending products
  const combinedList = isViewingToday && activeTab === 'a_traiter'
    ? pendingProducts.filter((p) => !todayExpiryProducts.find((t) => t.id === p.id))
    : pendingProducts;

  const overduePending = overdueProducts.filter((p) => !p.checked_today);
  const todayExpiryPending = todayExpiryProducts.filter((p) => !p.checked_today);

  // Pour aujourd'hui : trophée dès qu'il n'y a plus rien à traiter (urgent, expire aujourd'hui, ou en attente)
  // Pour les autres jours : trophée uniquement si des produits existaient et sont tous contrôlés
  const allDone = activeTab === 'a_traiter' && (
    isViewingToday
      ? overduePending.length === 0 && todayExpiryPending.length === 0 && combinedList.length === 0
      : products.length > 0 && pendingProducts.length === 0
  );

  const renderDateScroll = () => {
    if (activeTab !== 'a_traiter') return null;
    return (
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={styles.dateScroll} contentContainerStyle={styles.dateScrollContent}
      >
        {generateDateOptions().map((d) => {
          const today = getTodayStr();
          const count = d.value === today ? todayPendingCount : (productCountByDay[d.value] ?? 0);
          return (
            <View key={d.value} style={{ alignItems: 'center', justifyContent: 'flex-start' }}>
              <TouchableOpacity
                style={[styles.dateChip, selectedDate === d.value && styles.dateChipSelected]}
                onPress={() => setSelectedDate(d.value)}
              >
                <Text style={[styles.dateChipLabel, selectedDate === d.value && styles.dateChipTextSelected]}>
                  {d.label}
                </Text>
                <Text style={[styles.dateChipSub, selectedDate === d.value && styles.dateChipTextSelected]}>
                  {d.sublabel}
                </Text>
              </TouchableOpacity>
              {count > 0 && (
                <View style={[styles.dateChipCounter, selectedDate === d.value && styles.dateChipCounterSelected]}>
                  <Text style={[styles.dateChipCounterText, selectedDate === d.value && styles.dateChipCounterTextSelected]}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  // Generate 7 days starting from today
  const generateDateOptions = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: { label: string; sublabel: string; value: string }[] = [];
    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() + i * 86400000);
      const value = toLocalDateStr(d);
      const label = i === 0 ? 'Auj.' : dayNames[d.getDay()];
      const sublabel = formatDateShort(value);
      days.push({ label, sublabel, value });
    }
    return days;
  };

  const displayedList = activeTab === 'a_traiter' ? combinedList : ruptureProducts;
  const checkedCount = checkedProducts.length;
  const ruptureCount = checkedProducts.filter((p) => p.check_status === 'rupture').length;

  const getNavigationIds = () => {
    if (activeTab === 'a_traiter' && isViewingToday) {
      return [
        ...overdueProducts.map((p) => p.id),
        ...todayExpiryProducts.map((p) => p.id),
        ...combinedList.map((p) => p.id),
      ].join(',');
    }
    return displayedList.map((p) => p.id).join(',');
  };

  const renderProduct = ({ item }: { item: any }) => {
    const product = item as ProductWithStatus;
    const today = getTodayStr();
    const isOverdue = product.next_expiry_date && product.next_expiry_date < today;

    // Calculate days overdue
    let daysOverdue = 0;
    if (isOverdue && product.next_expiry_date) {
      const dlcDate = new Date(product.next_expiry_date);
      const todayDate = new Date(today);
      const diffTime = todayDate.getTime() - dlcDate.getTime();
      daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return (
      <TouchableOpacity
        style={[
          styles.productCard,
          isOverdue && styles.productCardOverdue,
        ]}
        onPress={() => router.push({ pathname: `/check/${product.id}`, params: { ids: getNavigationIds() } })}
        activeOpacity={0.7}
      >
        <View style={styles.productLeft}>
          {product.image_uri ? (
            <Image source={{ uri: product.image_uri }} style={styles.productThumb} />
          ) : (
            <View style={styles.productThumbPlaceholder}>
              <Ionicons name="cube-outline" size={18} color={Colors.textLight} />
            </View>
          )}
          <View style={styles.productInfo}>
            <Text style={[
              styles.productName,
              isOverdue && styles.productNameOverdue,
            ]} numberOfLines={1} ellipsizeMode="tail">{product.name}</Text>
            {product.barcode && <Text style={styles.productBarcode}>{product.barcode}</Text>}
          </View>
        </View>
        <View style={styles.productRight}>
          {product.next_expiry_date && (
            <View style={styles.dlcContainer}>
              <View style={[
                styles.dlcBadge,
                isOverdue && styles.dlcBadgeOverdue,
              ]}>
                <Text style={[
                  styles.dlcBadgeText,
                  isOverdue && styles.dlcBadgeTextOverdue,
                ]}>{formatDateShort(product.next_expiry_date)}</Text>
              </View>
              {isOverdue && (
                <View style={styles.overdueBadge}>
                  <Text style={styles.overdueBadgeText}>+{daysOverdue}j</Text>
                </View>
              )}
            </View>
          )}
          {activeTab === 'a_traiter' && product.last_status === 'rupture' && (
            <View style={[styles.dlcBadge, { backgroundColor: Colors.dangerLight }]}>
              <Text style={[styles.dlcBadgeText, { color: Colors.danger }]}>Rupture</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>DLC Manager</Text>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/settings')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="settings-outline" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tab buttons */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'a_traiter' && styles.tabButtonActive]}
          onPress={() => setActiveTab('a_traiter')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="clipboard-outline"
            size={18}
            color={activeTab === 'a_traiter' ? '#FFF' : Colors.text}
          />
          <Text style={[styles.tabText, activeTab === 'a_traiter' && styles.tabTextActive]}>
            A traiter
          </Text>
          {todayPendingCount > 0 && (
            <View style={[styles.badge, activeTab === 'a_traiter' && styles.badgeActive]}>
              <Text style={[styles.badgeText, activeTab === 'a_traiter' && styles.badgeTextActive]}>
                {todayPendingCount > 99 ? '99+' : todayPendingCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'rupture' && styles.tabButtonActiveRupture]}
          onPress={() => setActiveTab('rupture')}
          activeOpacity={0.7}
        >
          <Ionicons
            name="alert-circle-outline"
            size={18}
            color={activeTab === 'rupture' ? '#FFF' : Colors.danger}
          />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'rupture' ? '#FFF' : Colors.danger },
          ]}>
            Ruptures
          </Text>
          {ruptureProducts.length > 0 && (
            <View style={[styles.badge, styles.badgeDanger, activeTab === 'rupture' && styles.badgeActiveRupture]}>
              <Text style={[styles.badgeText, activeTab === 'rupture' && styles.badgeTextActiveRupture]}>
                {ruptureProducts.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>


      {/* Content */}
      {activeTab === 'a_traiter' && allDone ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.congratsWrapper}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          keyboardShouldPersistTaps="handled"
        >
          {renderDateScroll()}
          <View style={styles.congratsContainer}>
            <View style={styles.congratsIcon}>
              <Ionicons name="trophy" size={56} color="#F59E0B" />
            </View>
            <Text style={styles.congratsTitle}>Bravo !</Text>
            {checkedCount > 0 && (
              <Text style={styles.congratsStats}>
                <Text style={styles.congratsStatValue}>{checkedCount}</Text>
                <Text style={styles.congratsText}> contrôle{checkedCount > 1 ? 's' : ''}</Text>
                {ruptureCount > 0 && (
                  <>
                    <Text style={styles.congratsText}> dont </Text>
                    <Text style={[styles.congratsStatValue, { color: Colors.danger }]}>{ruptureCount}</Text>
                    <Text style={styles.congratsText}> rupture{ruptureCount > 1 ? 's' : ''}</Text>
                  </>
                )}
              </Text>
            )}
          </View>

          {/* Checked products list - always shown */}
          {checkedProducts.length > 0 && (
            <View style={styles.checkedListSection}>
              <TouchableOpacity
                style={styles.checkedListHeaderButton}
                onPress={() => setExpandHistory(!expandHistory)}
                activeOpacity={0.7}
              >
                <View style={styles.checkedListHeaderContent}>
                  <Ionicons
                    name={expandHistory ? "chevron-down" : "chevron-forward"}
                    size={20}
                    color={Colors.text}
                  />
                  <Text style={styles.checkedListHeaderTitle}>
                    Dates réalisées aujourd'hui ({checkedProducts.length})
                  </Text>
                </View>
              </TouchableOpacity>
              {expandHistory && (
                <View style={styles.checkedList}>
                  {checkedProducts.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.checkedRow}
                  onPress={() => router.push(`/check/${item.id}`)}
                  activeOpacity={0.7}
                >
                  {item.image_uri ? (
                    <Image source={{ uri: item.image_uri }} style={styles.checkedThumb} />
                  ) : (
                    <View style={styles.checkedThumbPlaceholder}>
                      <Ionicons name="cube-outline" size={14} color={Colors.textLight} />
                    </View>
                  )}
                  <Text style={styles.checkedName} numberOfLines={1}>{item.name}</Text>
                  <View style={styles.checkedDates}>
                    {item.previous_expiry_date && (
                      <Text style={styles.checkedOldDate}>{formatDateShort(item.previous_expiry_date)}</Text>
                    )}
                    {item.check_status === 'rupture' ? (
                      <>
                        <Ionicons name="arrow-forward" size={11} color={Colors.textLight} />
                        <Text style={styles.checkedRupture}>Rupture</Text>
                      </>
                    ) : (
                      item.next_expiry_date && (
                        <>
                          <Ionicons name="arrow-forward" size={11} color={Colors.textLight} />
                          <Text style={styles.checkedNewDate}>{formatDateShort(item.next_expiry_date)}</Text>
                        </>
                      )
                    )}
                  </View>
                </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
          </ScrollView>
        ) : activeTab === 'a_traiter' && !isViewingToday && products.length === 0 ? (
          <ScrollView scrollEnabled={false} style={{ flex: 1 }} contentContainerStyle={{ ...styles.emptyContainer, flex: undefined, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            {renderDateScroll()}
            <Ionicons name="calendar-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>Aucun produit</Text>
            <Text style={styles.emptyText}>
              Aucun {products.length === 0 ? 'produit' : products.length === 1 ? 'produit' : 'produits'} n'a de DLC au {formatDateFR(selectedDate)}.
            </Text>
          </ScrollView>
        ) : activeTab === 'rupture' && ruptureProducts.length === 0 ? (
          <ScrollView scrollEnabled={false} style={{ flex: 1 }} contentContainerStyle={{ ...styles.emptyContainer, flex: undefined, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
            <Ionicons name="checkmark-circle-outline" size={64} color={Colors.success} />
            <Text style={styles.emptyTitle}>Aucune rupture</Text>
            <Text style={styles.emptyText}>
              Tous les produits sont disponibles en rayon.
            </Text>
          </ScrollView>
        ) : (
          <FlatList
            data={displayedList}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderProduct}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={true}
            nestedScrollEnabled={true}
            ListHeaderComponent={
              <View>
                {renderDateScroll()}
              {isViewingToday && activeTab === 'a_traiter' ? (
                <View>
                  {overdueProducts.length > 0 && (
                    <View style={styles.overdueSection}>
                      <View style={styles.overdueSectionHeader}>
                        <Ionicons name="alert-circle" size={20} color="#DC2626" />
                        <Text style={styles.overdueSectionTitle}>A traiter en urgence !</Text>
                        <View style={styles.overdueSectionBadge}>
                          <Text style={styles.overdueSectionBadgeText}>{overdueProducts.length}</Text>
                        </View>
                      </View>
                      {overdueProducts.map((item) => (
                        <View key={item.id} style={{ marginBottom: 8 }}>
                          {renderProduct({ item })}
                        </View>
                      ))}
                    </View>
                  )}
                  {todayExpiryProducts.length > 0 && (
                    <View style={styles.todayExpirySection}>
                      {todayExpiryProducts.map((item) => (
                        <View key={item.id} style={{ marginBottom: 8 }}>
                          {renderProduct({ item })}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}
              </View>
            }
            ListFooterComponent={
              activeTab === 'a_traiter' && selectedDate === getTodayStr() && checkedProducts.length > 0 ? (
                <View style={styles.checkedListFooter}>
                    <TouchableOpacity
                      style={styles.checkedListHeaderButton}
                      onPress={() => setExpandHistory(!expandHistory)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.checkedListHeaderContent}>
                        <Ionicons
                          name={expandHistory ? "chevron-down" : "chevron-forward"}
                          size={20}
                          color={Colors.text}
                        />
                        <Text style={styles.checkedListHeaderTitle}>
                          Dates réalisées aujourd'hui ({checkedProducts.length})
                        </Text>
                      </View>
                    </TouchableOpacity>
                    {expandHistory && (
                      <View style={styles.checkedList}>
                      {checkedProducts.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.checkedRow}
                          onPress={() => router.push(`/check/${item.id}`)}
                          activeOpacity={0.7}
                        >
                          {item.image_uri ? (
                            <Image source={{ uri: item.image_uri }} style={styles.checkedThumb} />
                          ) : (
                            <View style={styles.checkedThumbPlaceholder}>
                              <Ionicons name="cube-outline" size={14} color={Colors.textLight} />
                            </View>
                          )}
                          <Text style={styles.checkedName} numberOfLines={1}>{item.name}</Text>
                          <View style={styles.checkedDates}>
                            {item.previous_expiry_date && (
                              <Text style={styles.checkedOldDate}>{formatDateShort(item.previous_expiry_date)}</Text>
                            )}
                            {item.check_status === 'rupture' ? (
                              <>
                                <Ionicons name="arrow-forward" size={11} color={Colors.textLight} />
                                <Text style={styles.checkedRupture}>Rupture</Text>
                              </>
                            ) : (
                              item.next_expiry_date && (
                                <>
                                  <Ionicons name="arrow-forward" size={11} color={Colors.textLight} />
                                  <Text style={styles.checkedNewDate}>{formatDateShort(item.next_expiry_date)}</Text>
                                </>
                              )
                            )}
                          </View>
                        </TouchableOpacity>
                      ))}
                      </View>
                    )}
                  </View>
                ) : null
              }
            />
        )}

      {/* Scanner FAB */}
      <TouchableOpacity
        style={styles.scanFab}
        onPress={() => router.push('/scanner')}
        activeOpacity={0.8}
      >
        <Ionicons name="camera-outline" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'flex-start' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8,
  },
  title: { fontSize: 28, fontWeight: '800', color: '#E3001B' },
  headerButton: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 16, marginBottom: 12 },
  tabButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
  },
  tabButtonActive: { backgroundColor: '#E3001B', borderColor: '#E3001B' },
  tabButtonActiveRupture: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  tabText: { fontSize: 13, fontWeight: '700', color: Colors.text },
  tabTextActive: { color: '#FFF' },
  badge: {
    backgroundColor: '#E3001B20', paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 10, minWidth: 22, alignItems: 'center',
  },
  badgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeDanger: { backgroundColor: Colors.dangerLight },
  badgeActiveRupture: { backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeText: { fontSize: 12, fontWeight: '800', color: '#E3001B' },
  badgeTextActive: { color: '#FFF' },
  badgeTextActiveRupture: { color: '#FFF' },
  dateScroll: { flexShrink: 0 },
  dateScrollContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 10, alignItems: 'flex-start' },
  dateChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', minWidth: 56,
  },
  dateChipSelected: { backgroundColor: '#E3001B', borderColor: '#E3001B' },
  dateChipLabel: { fontSize: 13, fontWeight: '700', color: Colors.text },
  dateChipSub: { fontSize: 11, color: Colors.textSecondary, marginTop: 1 },
  dateChipTextSelected: { color: '#FFF' },
  dateChipCounter: {
    backgroundColor: '#E3001B',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    width: '100%',
  },
  dateChipCounterSelected: { backgroundColor: 'rgba(227, 0, 27, 0.8)' },
  dateChipCounterText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  dateChipCounterTextSelected: { color: '#FFF' },
  dateChipBadge: { position: 'absolute', bottom: -10, right: -10, backgroundColor: '#E3001B', minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', zIndex: 9999 },
  dateChipBadgeSelected: { backgroundColor: 'rgba(255,255,255,0.3)' },
  dateChipBadgeBottom: { backgroundColor: '#E3001B', minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  dateChipBadgeBottomSelected: { backgroundColor: 'rgba(255,255,255,0.3)' },
  dateChipBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  dateChipBadgeTextSelected: { color: '#FFF' },
  list: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 0 },
  productCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, padding: 12, borderRadius: 12, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  productLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  productThumb: { width: 44, height: 44, borderRadius: 10, marginRight: 12 },
  productThumbPlaceholder: {
    width: 44, height: 44, borderRadius: 10, marginRight: 12,
    backgroundColor: Colors.borderLight, alignItems: 'center', justifyContent: 'center',
  },
  productInfo: { flex: 1, marginRight: 8 },
  productName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  productBarcode: { fontSize: 11, color: Colors.textLight, marginTop: 1, fontVariant: ['tabular-nums'] },
  productRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dlcContainer: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  dlcBadge: {
    backgroundColor: '#F59E0B20', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    alignItems: 'center',
    minWidth: 56,
  },
  dlcBadgeText: { fontSize: 13, fontWeight: '700', color: '#F59E0B', lineHeight: 15 },
  overdueBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  overdueBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFF' },
  scanFab: {
    position: 'absolute', bottom: 32, alignSelf: 'center',
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#E3001B',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#E3001B', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  congratsWrapper: { paddingHorizontal: 20, paddingVertical: 0, paddingBottom: 250 },
  congratsContainer: { alignItems: 'center', paddingTop: 40 },
  congratsIcon: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#FEF3C7',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  congratsTitle: { fontSize: 28, fontWeight: '800', color: Colors.text },
  congratsText: {
    fontSize: 15, color: Colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22,
  },
  congratsStats: { fontSize: 16, color: Colors.textSecondary, marginTop: 16, textAlign: 'center' },
  congratsStatValue: { fontSize: 18, fontWeight: '800', color: Colors.success },
  checkedList: { marginTop: 12 },
  checkedListSection: { marginTop: 32, paddingHorizontal: 20 },
  checkedListHeaderButton: {
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  checkedListHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkedListHeaderTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  checkedListSectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  checkedListFooter: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 80 },
  checkedRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card,
    padding: 10, borderRadius: 10, marginBottom: 4, gap: 10,
  },
  checkedThumb: { width: 32, height: 32, borderRadius: 6 },
  checkedThumbPlaceholder: {
    width: 32, height: 32, borderRadius: 6, backgroundColor: Colors.borderLight,
    alignItems: 'center', justifyContent: 'center',
  },
  checkedName: { flex: 1, fontSize: 13, fontWeight: '600', color: Colors.text },
  checkedDates: { flexDirection: 'row', gap: 6 },
  checkedOldDate: { fontSize: 12, fontWeight: '600', color: Colors.danger, textDecorationLine: 'line-through' },
  checkedNewDate: { fontSize: 12, fontWeight: '700', color: Colors.success },
  checkedRupture: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 40, paddingTop: 0 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 10 },
  emptyText: {
    fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 18,
  },
  productCardOverdue: {
    borderWidth: 2,
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  productNameOverdue: {
    color: '#DC2626',
    fontWeight: '700',
  },
  dlcBadgeOverdue: {
    backgroundColor: '#DC2626',
    borderWidth: 2,
    borderColor: '#991B1B',
  },
  dlcBadgeTextOverdue: {
    color: '#FFF',
    fontWeight: '700',
  },
  overdueSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1.5,
    borderBottomColor: '#DC2626',
  },
  overdueSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  overdueSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B',
    flex: 1,
  },
  overdueSectionBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 24,
    alignItems: 'center',
  },
  overdueSectionBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
  overdueListContainer: {
    paddingHorizontal: 0,
    gap: 8,
  },
  todayExpirySection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FEF9E720',
    borderBottomWidth: 1.5,
    borderBottomColor: '#F59E0B',
    marginBottom: 8,
  },
  todayExpirySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  todayExpirySectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#B45309',
    flex: 1,
  },
  todayExpirySectionBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    minWidth: 24,
    alignItems: 'center',
  },
  todayExpirySectionBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
  },
});
