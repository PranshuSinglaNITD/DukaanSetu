import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Animated, Dimensions,
  ActivityIndicator, TouchableOpacity, TextInput, Image, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/client';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

const { width } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCT_CATEGORIES = ['All', 'Grains', 'Pulses', 'Oilseeds', 'Vegetables', 'Spices'];
const PROPERTY_TYPES     = ['All', 'For Rent', 'For Sale'];

const CATEGORY_ICONS: Record<string, string> = {
  All: 'apps', Grains: 'grain', Pulses: 'seed-outline',
  Oilseeds: 'oil', Vegetables: 'food-apple-outline', Spices: 'shaker-outline',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated entrance wrapper */
const FadeSlideIn = ({ children, delay = 0, fromY = 16 }: any) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY  = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.spring(slideY,  { toValue: 0, delay,          useNativeDriver: true, speed: 14, bounciness: 7 }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY: slideY }] }}>
      {children}
    </Animated.View>
  );
};

/** Category pill */
const CategoryPill = ({
  label, icon, active, onPress,
}: { label: string; icon: string; active: boolean; onPress: () => void }) => (
  <Pressable onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
    <MaterialCommunityIcons
      name={icon as any}
      size={14}
      color={active ? '#fff' : '#64748b'}
      style={{ marginRight: 5 }}
    />
    <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
  </Pressable>
);

/** Property card */
const PropertyCard = ({ prop, index, onPress }: { prop: any; index: number; onPress: () => void }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 3 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50, bounciness: 3 }).start();
  const isRent   = prop.listingType === 'RENT';

  return (
    <FadeSlideIn delay={80 + index * 60} fromY={20}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={styles.propCard}
        >
          {/* Image / placeholder */}
          {prop.images?.length > 0 ? (
            <Image source={{ uri: prop.images[0] }} style={styles.propImage} resizeMode="cover" />
          ) : (
            <LinearGradient colors={['#0a3d2e', '#1a6b50']} style={styles.propImage}>
              <Ionicons name="business" size={36} color="rgba(255,255,255,0.4)" />
            </LinearGradient>
          )}

          {/* Listing type badge */}
          <View style={[styles.propBadge, { backgroundColor: isRent ? '#1d4ed8' : '#b45309' }]}>
            <Text style={styles.propBadgeText}>FOR {prop.listingType}</Text>
          </View>

          {/* Favourite */}
          <TouchableOpacity style={styles.heartBtn}>
            <Ionicons name="heart-outline" size={16} color="#fff" />
          </TouchableOpacity>

          <View style={styles.propBody}>
            <Text style={styles.propTitle} numberOfLines={1}>{prop.title}</Text>
            <View style={styles.propLocRow}>
              <Ionicons name="location-sharp" size={12} color="#059669" />
              <Text style={styles.propLoc} numberOfLines={1}>{prop.city}, {prop.state}</Text>
            </View>

            <View style={styles.propFooter}>
              <View>
                <Text style={styles.propPrice}>₹{Number(prop.price).toLocaleString('en-IN')}</Text>
                {isRent && <Text style={styles.propPriceSub}>per month</Text>}
              </View>
              <View style={styles.propAreaChip}>
                <MaterialCommunityIcons name="ruler-square" size={12} color="#64748b" />
                <Text style={styles.propAreaText}>{prop.area ?? '—'} sq ft</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </FadeSlideIn>
  );
};

/** Product row */
const ProductRow = ({ prod, index, onPress }: { prod: any; index: number; onPress: () => void }) => {
  const scale   = useRef(new Animated.Value(1)).current;
  const pressIn  = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50, bounciness: 3 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50, bounciness: 3 }).start();

  // Fake trend for visual richness (swap with real data when available)
  const up = index % 3 !== 1;

  return (
    <FadeSlideIn delay={120 + index * 55} fromY={14}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={styles.prodRow}
        >
          {/* Icon bg */}
          <LinearGradient
            colors={up ? ['#052e16', '#059669'] : ['#7c2d12', '#ea580c']}
            style={styles.prodIconBg}
          >
            <MaterialCommunityIcons name="grain" size={22} color="#fff" />
          </LinearGradient>

          {/* Details */}
          <View style={styles.prodMid}>
            <Text style={styles.prodName}>{prod.name}</Text>
            <View style={styles.prodMetaRow}>
              <View style={styles.prodCatChip}>
                <Text style={styles.prodCatText}>{prod.category}</Text>
              </View>
              <Text style={styles.prodStock}>
                {prod.stock} {prod.unit} avail.
              </Text>
            </View>
            <Text style={styles.prodSeller} numberOfLines={1}>
              <MaterialCommunityIcons name="store-outline" size={11} color="#94a3b8" />
              {'  '}{prod.seller?.name ?? prod.sellerName ?? 'Verified Seller'}
            </Text>
          </View>

          {/* Price tag */}
          <View style={styles.prodPriceWrap}>
            <Text style={styles.prodPrice}>₹{Number(prod.price).toLocaleString('en-IN')}</Text>
            <Text style={styles.prodUnit}>/{prod.unit}</Text>
            <View style={[styles.trendChip, { backgroundColor: up ? '#d1fae5' : '#fee2e2' }]}>
              <MaterialCommunityIcons
                name={up ? 'trending-up' : 'trending-down'}
                size={11}
                color={up ? '#059669' : '#ef4444'}
              />
              <Text style={[styles.trendText, { color: up ? '#059669' : '#ef4444' }]}>
                {up ? '+1.2%' : '-0.8%'}
              </Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </FadeSlideIn>
  );
};

/** Empty state */
const EmptyState = ({ message }: { message: string }) => (
  <View style={styles.emptyWrap}>
    <MaterialCommunityIcons name="tray-remove" size={38} color="#cbd5e1" />
    <Text style={styles.emptyTitle}>Nothing here yet</Text>
    <Text style={styles.emptyText}>{message}</Text>
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MarketplaceScreen({ navigation }: any) {
  // @ts-ignore
  const { user, logout } = useContext(AuthContext);

  const [products,    setProducts]    = useState<any[]>([]);
  const [properties,  setProperties]  = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [activeTab,   setActiveTab]   = useState<'products' | 'properties'>('products');
  const [productCat,  setProductCat]  = useState('All');
  const [propType,    setPropType]    = useState('All');
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const slideAnim   = useRef(new Animated.Value(-width * 0.75)).current;
  const searchScale = useRef(new Animated.Value(1)).current;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pRes, prRes] = await Promise.all([
        apiClient.get('/products'),
        apiClient.get('/properties'),
      ]);
      const allP  = pRes.data?.data  ?? [];
      const allPr = prRes.data?.data ?? [];
      setProducts(allP.filter((p: any)  => p.sellerId !== user?.id));
      setProperties(allPr.filter((p: any) => p.ownerId  !== user?.id));
    } catch (e: any) {
      console.log('🚨 FETCH ERROR:', e.response?.data ?? e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSidebar = () => {
    Animated.timing(slideAnim, {
      toValue: isSidebarOpen ? -width * 0.75 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setSidebarOpen(p => !p);
  };

  // ── Derived lists ──
  const filteredProducts = products.filter((p: any) => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat    = productCat === 'All' || p.category === productCat;
    return matchSearch && matchCat;
  });

  const filteredProperties = properties.filter((p: any) => {
    const matchSearch = p.title?.toLowerCase().includes(search.toLowerCase())
                     || p.city?.toLowerCase().includes(search.toLowerCase());
    const matchType   = propType === 'All'
                     || (propType === 'For Rent' && p.listingType === 'RENT')
                     || (propType === 'For Sale' && p.listingType === 'SALE');
    return matchSearch && matchType;
  });

  const searchFocusIn  = () => Animated.spring(searchScale, { toValue: 1.015, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
  const searchFocusOut = () => Animated.spring(searchScale, { toValue: 1,     useNativeDriver: true, speed: 30, bounciness: 4 }).start();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.root}>
        <Header toggleSidebar={toggleSidebar} />

        {/* ── Search bar ── */}
        <View style={styles.searchWrap}>
          <Animated.View style={[styles.searchBox, { transform: [{ scale: searchScale }] }]}>
            <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder={activeTab === 'products' ? 'Search crops, grains…' : 'Search city, property…'}
              placeholderTextColor="#94a3b8"
              value={search}
              onChangeText={setSearch}
              onFocus={searchFocusIn}
              onBlur={searchFocusOut}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Filter button */}
          <TouchableOpacity style={styles.filterBtn}>
            <MaterialCommunityIcons name="tune-variant" size={20} color="#059669" />
          </TouchableOpacity>
        </View>

        {/* ── Tab switcher ── */}
        <View style={styles.tabRow}>
          {(['products', 'properties'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => { setActiveTab(tab); setSearch(''); }}
            >
              <MaterialCommunityIcons
                name={tab === 'products' ? 'grain' : 'home-city-outline'}
                size={15}
                color={activeTab === tab ? '#fff' : '#64748b'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'products' ? `Live Mandi (${products.length})` : `Properties (${properties.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>Fetching market data…</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >

            {/* ── PRODUCTS TAB ── */}
            {activeTab === 'products' && (
              <>
                {/* Market summary strip */}
                <FadeSlideIn delay={0}>
                  <LinearGradient colors={['#052e16', '#065f46']} style={styles.summaryStrip}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryVal}>{products.length}</Text>
                      <Text style={styles.summaryLbl}>Listings</Text>
                    </View>
                    <View style={styles.summarySep} />
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryVal}>
                        ₹{products.length
                          ? Math.min(...products.map((p: any) => p.price)).toLocaleString('en-IN')
                          : '—'}
                      </Text>
                      <Text style={styles.summaryLbl}>Lowest Price</Text>
                    </View>
                    <View style={styles.summarySep} />
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryVal, { color: '#fbbf24' }]}>↑ Wheat</Text>
                      <Text style={styles.summaryLbl}>Top Mover</Text>
                    </View>
                  </LinearGradient>
                </FadeSlideIn>

                {/* Category pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillRow}
                >
                  {PRODUCT_CATEGORIES.map(cat => (
                    <CategoryPill
                      key={cat}
                      label={cat}
                      icon={CATEGORY_ICONS[cat] ?? 'tag-outline'}
                      active={productCat === cat}
                      onPress={() => setProductCat(cat)}
                    />
                  ))}
                </ScrollView>

                {/* Results header */}
                <View style={styles.resultsRow}>
                  <Text style={styles.resultsText}>
                    {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}
                    {productCat !== 'All' ? ` in ${productCat}` : ''}
                  </Text>
                  <TouchableOpacity style={styles.sortBtn}>
                    <MaterialCommunityIcons name="sort" size={14} color="#059669" />
                    <Text style={styles.sortText}>Sort</Text>
                  </TouchableOpacity>
                </View>

                {filteredProducts.length === 0 ? (
                  <EmptyState message="No products listed in the Mandi today." />
                ) : (
                  filteredProducts.map((prod: any, i: number) => (
                    <ProductRow
                      key={prod.id}
                      prod={prod}
                      index={i}
                      onPress={() => navigation.navigate('ProductDetail', { product: prod })}
                    />
                  ))
                )}
              </>
            )}

            {/* ── PROPERTIES TAB ── */}
            {activeTab === 'properties' && (
              <>
                {/* Type filter pills */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.pillRow, { marginTop: 4 }]}
                >
                  {PROPERTY_TYPES.map(t => (
                    <CategoryPill
                      key={t}
                      label={t}
                      icon={t === 'All' ? 'apps' : t === 'For Rent' ? 'key-outline' : 'tag-outline'}
                      active={propType === t}
                      onPress={() => setPropType(t)}
                    />
                  ))}
                </ScrollView>

                {/* Results header */}
                <View style={styles.resultsRow}>
                  <Text style={styles.resultsText}>
                    {filteredProperties.length} propert{filteredProperties.length !== 1 ? 'ies' : 'y'}
                  </Text>
                  <TouchableOpacity style={styles.sortBtn}>
                    <MaterialCommunityIcons name="sort" size={14} color="#059669" />
                    <Text style={styles.sortText}>Sort</Text>
                  </TouchableOpacity>
                </View>

                {filteredProperties.length === 0 ? (
                  <EmptyState message="No properties available right now." />
                ) : (
                  // 2-column grid for properties
                  <View style={styles.propGrid}>
                    {filteredProperties.map((prop: any, i: number) => (
                      <View key={prop.id} style={{ width: (width - 48) / 2 }}>
                        <PropertyCard
                          prop={prop}
                          index={i}
                          onPress={() => navigation.navigate('PropertyDetail', { property: prop })}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}

            <View style={{ height: 60 }} />
          </ScrollView>
        )}

        <Sidebar
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
          slideAnim={slideAnim}
          logout={logout}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  safe: { flex: 1, backgroundColor: '#f5efe6' },
  root: { flex: 1, position: 'relative', backgroundColor: '#f5efe6' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },

  // ── Search ──────────────────────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    gap: 10,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc', borderRadius: 14,
    paddingHorizontal: 14, height: 44,
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1e293b', fontWeight: '500' },
  filterBtn: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: '#ecfdf5',
    borderWidth: 1, borderColor: '#bbf7d0',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Tabs ────────────────────────────────────────────────────────────────
  tabRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  tabActive: { backgroundColor: '#052e16', borderColor: '#052e16' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#fff' },

  // ── Scroll ──────────────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },

  // ── Summary Strip ────────────────────────────────────────────────────────
  summaryStrip: {
    flexDirection: 'row', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 20,
    marginBottom: 14, overflow: 'hidden',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryVal: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  summaryLbl: { color: '#6ee7b7', fontSize: 10, fontWeight: '500', marginTop: 3 },
  summarySep: { width: 1, backgroundColor: 'rgba(255,255,255,0.12)' },

  // ── Category Pills ───────────────────────────────────────────────────────
  pillRow: { paddingBottom: 12, gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, backgroundColor: '#fff',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  pillActive: { backgroundColor: '#059669', borderColor: '#059669' },
  pillText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  pillTextActive: { color: '#fff' },

  // ── Results row ───────────────────────────────────────────────────────────
  resultsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  resultsText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ecfdf5', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  sortText: { fontSize: 12, color: '#059669', fontWeight: '700' },

  // ── Product Row ───────────────────────────────────────────────────────────
  prodRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 18,
    padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    gap: 12,
  },
  prodIconBg: {
    width: 50, height: 50, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  prodMid: { flex: 1 },
  prodName: { fontSize: 15, fontWeight: '800', color: '#1e293b', marginBottom: 5, letterSpacing: -0.1 },
  prodMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  prodCatChip: {
    backgroundColor: '#f1f5f9', borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  prodCatText: { fontSize: 10, color: '#475569', fontWeight: '700' },
  prodStock: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  prodSeller: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },

  prodPriceWrap: { alignItems: 'flex-end', gap: 4 },
  prodPrice: { fontSize: 17, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3 },
  prodUnit: { fontSize: 10, color: '#94a3b8', fontWeight: '500', marginTop: -4 },
  trendChip: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
  },
  trendText: { fontSize: 10, fontWeight: '700' },

  // ── Property Grid ─────────────────────────────────────────────────────────
  propGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', gap: 12,
  },
  propCard: {
    backgroundColor: '#fff', borderRadius: 18,
    overflow: 'hidden', marginBottom: 4,
    shadowColor: '#000', shadowOpacity: 0.08,
    shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  propImage: {
    height: 110, width: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  propBadge: {
    position: 'absolute', top: 8, left: 8,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  propBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  heartBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center', alignItems: 'center',
  },
  propBody: { padding: 12 },
  propTitle: { fontSize: 13, fontWeight: '800', color: '#1e293b', marginBottom: 5 },
  propLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 10 },
  propLoc: { fontSize: 11, color: '#64748b', fontWeight: '500', flex: 1 },
  propFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  propPrice: { fontSize: 15, fontWeight: '800', color: '#1e293b', letterSpacing: -0.3 },
  propPriceSub: { fontSize: 9, color: '#94a3b8', fontWeight: '500' },
  propAreaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#f8fafc', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 3,
  },
  propAreaText: { fontSize: 10, color: '#64748b', fontWeight: '600' },

  // ── Empty State ───────────────────────────────────────────────────────────
  emptyWrap: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 52, gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#94a3b8' },
  emptyText: { fontSize: 13, color: '#cbd5e1', fontWeight: '500', textAlign: 'center' },
});