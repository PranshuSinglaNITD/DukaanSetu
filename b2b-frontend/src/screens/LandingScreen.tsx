import React, { useState, useRef, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  SafeAreaView,
  Platform,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { registerForPushNotificationsAsync,setupNotificationListener } from '../utils/notifications';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MARKET_RATES = [
  { name: 'Wheat',   price: '₹2,180', change: '+1.2%', up: true  },
  { name: 'Rice',    price: '₹3,450', change: '-0.8%', up: false },
  { name: 'Maize',   price: '₹1,920', change: '+2.1%', up: true  },
  { name: 'Soybean', price: '₹4,560', change: '+0.5%', up: true  },
  { name: 'Cotton',  price: '₹6,780', change: '-1.3%', up: false },
  { name: 'Mustard', price: '₹5,230', change: '+0.9%', up: true  },
];

const RECENT_ACTIVITY = [
  {
    id: '1', icon: 'grain' as const, color: '#10b981',
    title: 'Wheat sold', detail: '50 quintal · Rajinder Singh',
    amount: '+₹1,09,000', time: '2h ago',
  },
  {
    id: '2', icon: 'plus-circle-outline' as const, color: '#3b82f6',
    title: 'New listing posted', detail: 'Rice Grade A · 120 quintal',
    amount: '', time: '5h ago',
  },
  {
    id: '3', icon: 'message-text-outline' as const, color: '#f59e0b',
    title: 'Buyer inquiry', detail: 'Maize · Gurpreet Farms',
    amount: '', time: '8h ago',
  },
  {
    id: '4', icon: 'grain' as const, color: '#10b981',
    title: 'Mustard sold', detail: '30 quintal · Harpal Traders',
    amount: '+₹1,56,900', time: '1d ago',
  },
];

type Action = {
  title: string;
  sub: string;
  icon: string;
  lib: 'mci' | 'ion';
  colors: [string, string];
  badge?: string;
  onPress?: () => void;
};

// ─── Market Ticker ────────────────────────────────────────────────────────────

const ITEM_W = 148;

const MarketTicker = () => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const totalW = MARKET_RATES.length * ITEM_W;
  const doubled = [...MARKET_RATES, ...MARKET_RATES];

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -totalW,
        duration: totalW * 42,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={styles.tickerWrapper}>
      {/* Label pill */}
      <View style={styles.tickerLabel}>
        <MaterialCommunityIcons name="trending-up" size={11} color="#f59e0b" />
        <Text style={styles.tickerLabelText}>LIVE</Text>
      </View>

      {/* Scrolling rates */}
      <View style={styles.tickerTrack}>
        <Animated.View style={{ flexDirection: 'row', transform: [{ translateX: scrollX }] }}>
          {doubled.map((r, i) => (
            <View key={i} style={[styles.tickerItem, { width: ITEM_W }]}>
              <Text style={styles.tickerName}>{r.name}</Text>
              <Text style={styles.tickerPrice}>{r.price}/Q</Text>
              <Text style={[styles.tickerChange, { color: r.up ? '#10b981' : '#ef4444' }]}>
                {r.change}
              </Text>
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
};

// ─── Action Card ──────────────────────────────────────────────────────────────

const ActionCard = ({ action, index }: { action: Action; index: number }) => {
  const scale    = useRef(new Animated.Value(1)).current;
  const opacity  = useRef(new Animated.Value(0)).current;
  const slideY   = useRef(new Animated.Value(22)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 480, delay: 180 + index * 75, useNativeDriver: true }),
      Animated.spring(slideY,  { toValue: 0, delay: 180 + index * 75, useNativeDriver: true, speed: 14, bounciness: 9 }),
    ]).start();
  }, []);

  const pressIn  = () => Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 50, bounciness: 3 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50, bounciness: 3 }).start();

  const icon = action.lib === 'mci'
    ? <MaterialCommunityIcons name={action.icon as any} size={30} color="#fff" />
    : <Ionicons name={action.icon as any} size={28} color="#fff" />;

  return (
    <Animated.View style={{ width: CARD_W, opacity, transform: [{ translateY: slideY }, { scale }] }}>
      <Pressable onPress={action.onPress} onPressIn={pressIn} onPressOut={pressOut}>
        <LinearGradient
          colors={action.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionCard}
        >
          {/* Badge */}
          {action.badge ? (
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>{action.badge}</Text>
            </View>
          ) : null}

          {/* Decorative circle */}
          <View style={styles.actionDecCircle} />

          {icon}
          <Text style={styles.actionTitle}>{action.title}</Text>
          <Text style={styles.actionSub}>{action.sub}</Text>

          {/* Arrow */}
          <View style={styles.actionArrow}>
            <Ionicons name="arrow-forward" size={13} color="rgba(255,255,255,0.7)" />
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

// ─── Activity Row ─────────────────────────────────────────────────────────────

const ActivityRow = ({ item, index }: { item: typeof RECENT_ACTIVITY[0]; index: number }) => {
  const opacity  = useRef(new Animated.Value(0)).current;
  const slideX   = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 380, delay: 600 + index * 80, useNativeDriver: true }),
      Animated.timing(slideX,  { toValue: 0, duration: 380, delay: 600 + index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.activityRow, { opacity, transform: [{ translateX: slideX }] }]}>
      <View style={[styles.activityIcon, { backgroundColor: item.color + '18' }]}>
        <MaterialCommunityIcons name={item.icon as any} size={20} color={item.color} />
      </View>
      <View style={styles.activityMid}>
        <Text style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.activityDetail}>{item.detail}</Text>
      </View>
      <View style={styles.activityRight}>
        {item.amount ? <Text style={styles.activityAmount}>{item.amount}</Text> : null}
        <Text style={styles.activityTime}>{item.time}</Text>
      </View>
    </Animated.View>
  );
};

//main screeen

export default function LandingScreen({ navigation }: any) {
  // @ts-ignore
  const { user, logout } = useContext(AuthContext);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const slideAnim    = useRef(new Animated.Value(-width * 0.75)).current;
  const welcomeAlpha = useRef(new Animated.Value(0)).current;
  const welcomeY     = useRef(new Animated.Value(-18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(welcomeAlpha, { toValue: 1, duration: 560, useNativeDriver: true }),
      Animated.spring(welcomeY,     { toValue: 0, useNativeDriver: true, speed: 12, bounciness: 8 }),
    ]).start();
  }, []);

  useEffect(() => {
    // 1. Will safely log a warning instead of crashing
    registerForPushNotificationsAsync();
    
    // 2. Will safely return a dummy cleanup function
    const cleanup = setupNotificationListener(navigation);

    return () => {
      cleanup();
    };
  }, [navigation]);

  const toggleSidebar = () => {
    Animated.timing(slideAnim, {
      toValue: isSidebarOpen ? -width * 0.75 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setSidebarOpen(prev => !prev);
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const actions: Action[] = [
    {
      title: 'Live Mandi',
      sub: 'Browse market',
      icon: 'storefront-outline',
      lib: 'mci',
      colors: ['#047857', '#10b981'],
      onPress: () => navigation.navigate('Marketplace'),
    },
    {
      title: 'Sell Product',
      sub: 'List crops & grains',
      icon: 'basket-plus-outline',
      lib: 'mci',
      colors: ['#b45309', '#f59e0b'],
      badge: 'HOT',
      onPress: () => navigation.navigate('AddProduct'),
    },
    {
      title: 'List Property',
      sub: 'Rent or sell land',
      icon: 'business-outline',
      lib: 'ion',
      colors: ['#1d4ed8', '#60a5fa'],
      onPress: () => navigation.navigate('AddProperty'),
    },
    {
      title: 'My Inventory',
      sub: 'Manage listings',
      icon: 'clipboard-list-outline',
      lib: 'mci',
      colors: ['#6d28d9', '#a78bfa'],
      badge: '3',
      onPress: () => navigation.navigate('Inventory'),
    },
    {
      title: 'Orders',
      sub: 'Track & fulfill',
      icon: 'package-variant-closed',
      lib: 'mci',
      colors: ['#be185d', '#f472b6'],
      badge: '2',
      onPress: () => navigation.navigate('Orders'),
    },
    {
      title: 'Analytics',
      sub: 'Sales insights',
      icon: 'chart-line',
      lib: 'mci',
      colors: ['#0e7490', '#22d3ee'],
      onPress: () => navigation.navigate('Analytics'),
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5efe6" />
      <View style={styles.root}>
        <Header toggleSidebar={toggleSidebar} />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Welcome Hero ── */}
          <Animated.View style={{ opacity: welcomeAlpha, transform: [{ translateY: welcomeY }] }}>
            <LinearGradient
              colors={['#052e16', '#064e3b', '#0a6150']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              {/* Decorative blobs */}
              <View style={styles.blob1} />
              <View style={styles.blob2} />

              {/* Top row */}
              <View style={styles.heroTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.greeting}>{getGreeting()},</Text>
                  <Text style={styles.heroName}>{user?.name ?? 'Shopkeeper'}</Text>

                  {/* Badges */}
                  <View style={styles.heroMeta}>
                    <View style={styles.verifiedBadge}>
                      <MaterialCommunityIcons name="store-check-outline" size={11} color="#fcd34d" />
                      <Text style={styles.verifiedText}>{user?.role ?? 'Verified Seller'}</Text>
                    </View>
                    <View style={styles.activePill}>
                    </View>
                  </View>
                </View>

                {/* Avatar */}
                <View style={styles.heroAvatar}>
                  <MaterialCommunityIcons name="warehouse" size={34} color="#fbbf24" />
                </View>
              </View>

              {/* Separator */}
              <View style={styles.heroDivider} />

              {/* Stat row */}
              <View style={styles.heroStats}>
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatVal}>₹2.4L</Text>
                  <Text style={styles.heroStatLbl}>Today's Revenue</Text>
                </View>
                <View style={styles.heroStatSep} />
                <View style={styles.heroStatItem}>
                  <Text style={styles.heroStatVal}>18</Text>
                  <Text style={styles.heroStatLbl}>Live Listings</Text>
                </View>
                <View style={styles.heroStatSep} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatVal, { color: '#fbbf24' }]}>5</Text>
                  <Text style={styles.heroStatLbl}>Pending Orders</Text>
                </View>
                <View style={styles.heroStatSep} />
                <View style={styles.heroStatItem}>
                  <Text style={[styles.heroStatVal, { color: '#6ee7b7' }]}>↑12%</Text>
                  <Text style={styles.heroStatLbl}>vs Yesterday</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          {/* ── Market Rate Ticker ── */}
          <MarketTicker />

          {/* ── Alerts strip ── */}
          <View style={styles.alertStrip}>
            <View style={styles.alertLeft}>
              <MaterialCommunityIcons name="bell-ring-outline" size={15} color="#b45309" />
              <Text style={styles.alertText}>
                <Text style={{ fontWeight: '700' }}>4 listings</Text> expiring in 2 days · Tap to renew
              </Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.alertAction}>Renew →</Text>
            </TouchableOpacity>
          </View>

          {/* ── Quick Actions ── */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {actions.map((a, i) => (
              <ActionCard key={a.title} action={a} index={i} />
            ))}
          </View>

          {/* ── Performance Cards ── */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>This Week</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Analytics')}>
              <Text style={styles.seeAll}>Full report →</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.perfScroll}
          >
            {[
              { label: 'Total Revenue',   val: '₹11.2L', sub: '↑ 18% vs last week', icon: 'currency-inr',        color: '#10b981', bg: '#d1fae5' },
              { label: 'Units Sold',       val: '342 Q',  sub: '↑ 9 quintal',         icon: 'scale-balance',       color: '#3b82f6', bg: '#dbeafe' },
              { label: 'New Buyers',       val: '23',     sub: '+7 this week',        icon: 'account-plus-outline',color: '#8b5cf6', bg: '#ede9fe' },
              { label: 'Avg Deal Size',    val: '₹32.7K', sub: '↑ ₹4.2K',             icon: 'handshake-outline',   color: '#f59e0b', bg: '#fef3c7' },
            ].map((c, i) => (
              <View key={c.label} style={styles.perfCard}>
                <View style={[styles.perfIconBg, { backgroundColor: c.bg }]}>
                  <MaterialCommunityIcons name={c.icon as any} size={20} color={c.color} />
                </View>
                <Text style={styles.perfVal}>{c.val}</Text>
                <Text style={styles.perfLabel}>{c.label}</Text>
                <Text style={[styles.perfSub, { color: c.color }]}>{c.sub}</Text>
              </View>
            ))}
          </ScrollView>

          {/* ── Recent Activity ── */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={styles.seeAll}>View all</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.activityCard}>
            {RECENT_ACTIVITY.map((item, i) => (
              <React.Fragment key={item.id}>
                <ActivityRow item={item} index={i} />
                {i < RECENT_ACTIVITY.length - 1 && <View style={styles.activitySep} />}
              </React.Fragment>
            ))}
          </View>

          {/* ── Top Buyers ── */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Top Buyers</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.buyerScroll}
          >
            {[
              { name: 'Rajinder Singh',  tag: '12 deals',   color: '#10b981' },
              { name: 'Gurpreet Farms',  tag: '8 deals',    color: '#3b82f6' },
              { name: 'Harpal Traders',  tag: '6 deals',    color: '#8b5cf6' },
              { name: 'Balvir Co.',      tag: '5 deals',    color: '#f59e0b' },
            ].map((b, i) => (
              <TouchableOpacity key={b.name} style={styles.buyerCard}>
                <View style={[styles.buyerAvatar, { backgroundColor: b.color + '22' }]}>
                  <Text style={[styles.buyerInitial, { color: b.color }]}>
                    {b.name[0]}
                  </Text>
                </View>
                <Text style={styles.buyerName}>{b.name}</Text>
                <Text style={[styles.buyerTag, { color: b.color }]}>{b.tag}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Market Insight Banner ── */}
          <LinearGradient colors={['#fffbeb', '#fef3c7']} style={styles.insightCard}>
            <View style={[styles.insightIcon, { backgroundColor: '#fef3c7' }]}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={22} color="#d97706" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.insightLabel}>MARKET TIP</Text>
              <Text style={styles.insightText}>
                Wheat prices up <Text style={{ fontWeight: '700' }}>1.2%</Text> today in Punjab markets.
                Good time to list stored stock before weekend dip.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#d97706" />
          </LinearGradient>

        </ScrollView>

        <Sidebar slideAnim={slideAnim} toggleSidebar={toggleSidebar} logout={logout} isSidebarOpen={isSidebarOpen} />
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: '#f5efe6',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  root: { flex: 1, backgroundColor: '#f5efe6' },
  scroll: { padding: 16, paddingBottom: 52 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroCard: {
    borderRadius: 24, padding: 22, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#052e16', shadowOpacity: 0.28, shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  blob1: {
    position: 'absolute', right: -40, top: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  blob2: {
    position: 'absolute', left: -20, bottom: -20,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(16,185,129,0.1)',
  },

  heroTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  greeting: { color: '#6ee7b7', fontSize: 13, fontWeight: '600', letterSpacing: 0.3, marginBottom: 3 },
  heroName: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 10, letterSpacing: -0.4 },

  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  verifiedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.35)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  verifiedText: { color: '#fcd34d', fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  activePill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#34d399' },
  activeText: { color: '#34d399', fontSize: 11, fontWeight: '600' },

  heroAvatar: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderWidth: 2, borderColor: 'rgba(251,191,36,0.35)',
    justifyContent: 'center', alignItems: 'center',
  },

  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.09)', marginBottom: 16 },

  heroStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatVal: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  heroStatLbl: { color: '#a7f3d0', fontSize: 9, fontWeight: '500', marginTop: 3, textAlign: 'center' },
  heroStatSep: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.12)' },

  // ── Ticker ────────────────────────────────────────────────────────────────
  tickerWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, marginBottom: 10,
    overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb', height: 40,
  },
  tickerLabel: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#052e16', paddingHorizontal: 10, height: '100%',
    justifyContent: 'center',
  },
  tickerLabelText: { color: '#f59e0b', fontSize: 8, fontWeight: '800', letterSpacing: 1.2 },
  tickerTrack: { flex: 1, overflow: 'hidden', height: '100%', justifyContent: 'center' },
  tickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12,
  },
  tickerName: { color: '#374151', fontSize: 11, fontWeight: '700', flex: 1 },
  tickerPrice: { color: '#111827', fontSize: 11, fontWeight: '700' },
  tickerChange: { fontSize: 10, fontWeight: '600' },

  // ── Alert Strip ───────────────────────────────────────────────────────────
  alertStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20,
  },
  alertLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  alertText: { color: '#92400e', fontSize: 12, lineHeight: 16 },
  alertAction: { color: '#b45309', fontSize: 12, fontWeight: '700' },

  // ── Section header ────────────────────────────────────────────────────────
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111827', letterSpacing: -0.2 },
  seeAll: { color: '#059669', fontSize: 13, fontWeight: '600' },

  // ── Action Grid ───────────────────────────────────────────────────────────
  grid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'space-between', rowGap: 12, marginBottom: 28,
  },
  actionCard: {
    borderRadius: 20, padding: 18, minHeight: 134,
    justifyContent: 'flex-end', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.14,
    shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  actionBadge: {
    position: 'absolute', top: 11, right: 11,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  actionBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  actionDecCircle: {
    position: 'absolute', top: -22, right: -22,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  actionTitle: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 10, letterSpacing: -0.1 },
  actionSub: { color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '500', marginTop: 2 },
  actionArrow: {
    position: 'absolute', bottom: 12, right: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Performance cards ─────────────────────────────────────────────────────
  perfScroll: { paddingRight: 16, gap: 12, marginBottom: 28 },
  perfCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, width: 142,
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  perfIconBg: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginBottom: 12,
  },
  perfVal: { fontSize: 20, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },
  perfLabel: { fontSize: 11, color: '#6b7280', fontWeight: '500', marginTop: 3 },
  perfSub: { fontSize: 11, fontWeight: '600', marginTop: 4 },

  // ── Activity ──────────────────────────────────────────────────────────────
  activityCard: {
    backgroundColor: '#fff', borderRadius: 18,
    borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 24,
    shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13, gap: 12,
  },
  activityIcon: {
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
  },
  activityMid: { flex: 1 },
  activityTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginBottom: 2 },
  activityDetail: { fontSize: 11, color: '#6b7280' },
  activityRight: { alignItems: 'flex-end' },
  activityAmount: { fontSize: 13, fontWeight: '700', color: '#10b981', marginBottom: 2 },
  activityTime: { fontSize: 10, color: '#9ca3af' },
  activitySep: { height: 1, backgroundColor: '#f9fafb', marginHorizontal: 14 },

  // ── Top Buyers ────────────────────────────────────────────────────────────
  buyerScroll: { paddingRight: 16, gap: 12, marginBottom: 24 },
  buyerCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, width: 122,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06,
    shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  buyerAvatar: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  buyerInitial: { fontSize: 20, fontWeight: '800' },
  buyerName: { fontSize: 11, fontWeight: '700', color: '#1f2937', textAlign: 'center', marginBottom: 4 },
  buyerTag: { fontSize: 10, fontWeight: '600' },

  // ── Insight Banner ────────────────────────────────────────────────────────
  insightCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 16,
    borderWidth: 1, borderColor: '#fde68a',
  },
  insightIcon: {
    width: 40, height: 40, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  insightLabel: {
    color: '#92400e', fontSize: 9, fontWeight: '800',
    letterSpacing: 1.1, marginBottom: 4,
  },
  insightText: { fontSize: 12, color: '#78350f', lineHeight: 17 },
});