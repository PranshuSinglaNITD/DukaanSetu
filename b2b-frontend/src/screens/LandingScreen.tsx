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
  ScrollView,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { getTrustDesignation } from '../utils/helper.js'

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

// ─── TYPE DEFINITIONS ────────────────────────────────────────────────────────
type UserRole = 'FARMER' | 'WHOLESALER' | 'RETAILER';

interface ActionItem {
  title: string;
  sub: string;
  icon: string;
  lib: 'mci' | 'ion';
  colors: [string, string];
  badge?: string;
  route: string;
}

interface StatItem {
  value: string;
  label: string;
  color: string;
}

interface RoleUIConfig {
  themeColors: [string, string, string];
  dashboardTitle: string;
  dashboardSub: string;
  stats: StatItem[];
  actions: ActionItem[];
  marketPulseLabel: string;
  marketPulseText: string;
}

// ─── ROLE CONFIGURATION MATRIX ───────────────────────────────────────────────
const ROLE_CONFIGS: Record<UserRole, RoleUIConfig> = {
  FARMER: {
    themeColors: ['#047857', '#065f46', '#022c22'],
    dashboardTitle: 'Krishi Dashboard',
    dashboardSub: 'Manage your harvests and live mandi updates',
    stats: [
      { value: '18 Qtl', label: 'In Stock', color: '#fff' },
      { value: '2 Active', label: 'My Listings', color: '#fbbf24' },
      { value: '₹2,350', label: 'Avg Wheat Rate', color: '#6ee7b7' },
    ],
    actions: [
      { title: 'List New Crop', sub: 'Add harvest details', icon: 'plus-circle-outline', lib: 'mci', colors: ['#b45309', '#f59e0b'], badge: 'SELL', route: 'AddProduct' },
      { title: 'My Digital Khata', sub: 'Track pending udhaar', icon: 'book-open-page-variant-outline', lib: 'mci', colors: ['#6d28d9', '#a78bfa'], route: 'Khata' },
      { title: 'Mandi Rates', sub: 'Check live trends', icon: 'chart-line', lib: 'mci', colors: ['#1d4ed8', '#60a5fa'], route: 'MandiPulse' },
      { title: 'Active Offers', sub: 'View buyer bids', icon: 'gavel', lib: 'mci', colors: ['#0e7490', '#22d3ee'], route: 'Inventory' },
    ],
    marketPulseLabel: 'LOCAL MANDI ADVISORY',
    marketPulseText: 'Arrivals of premium wheat varieties are up by 12% in Firozpur. Consider staging listings over the next 48 hours for optimal pricing.',
  },
  WHOLESALER: {
    themeColors: ['#1e3a8a', '#1e40af', '#172554'],
    dashboardTitle: 'B2B Trading Desk',
    dashboardSub: 'Source from farmers and manage logistics dispatch',
    stats: [
      { value: '₹18.4L', label: 'Credit Limit', color: '#fff' },
      { value: '5 Trucks', label: 'In Transit', color: '#fbbf24' },
      { value: '72%', label: 'Storage Capacity', color: '#6ee7b7' },
    ],
    actions: [
      { title: 'Procure Crops', sub: 'Browse farmer lots', icon: 'storefront-outline', lib: 'mci', colors: ['#047857', '#10b981'], badge: 'LIVE', route: 'Marketplace' },
      { title: 'Dispatch Fleet', sub: 'Track active shipments', icon: 'truck-delivery-outline', lib: 'mci', colors: ['#be185d', '#f472b6'], route: 'SellerSales' },
      { title: 'Lease Storage', sub: 'List warehouse space', icon: 'home-plus-outline', lib: 'mci', colors: ['#1d4ed8', '#60a5fa'], route: 'AddProperty' },
      { title: 'Margin Analyzer', sub: 'Profitability metrics', icon: 'chart-pie', lib: 'mci', colors: ['#0e7490', '#22d3ee'], route: 'Analytics' },
    ],
    marketPulseLabel: 'ARBITRAGE OPPORTUNITY',
    marketPulseText: 'Supply shortage detected in surrounding regional centers. Bulk shipments routing toward primary hubs are yielding up to a 6% margin bump.',
  },
  RETAILER: {
    themeColors: ['#7f1d1d', '#991b1b', '#450a0a'],
    dashboardTitle: 'Store Procurement',
    dashboardSub: 'Source bulk inventories with verified quality metrics',
    stats: [
      { value: '3 Shipped', label: 'Inbound Orders', color: '#fff' },
      { value: '₹4.2L', label: 'This Month', color: '#fbbf24' },
      { value: '0 Flags', label: 'Quality Alerts', color: '#6ee7b7' },
    ],
    actions: [
      { title: 'Bulk Sourcing', sub: 'Scan wholesaler stock', icon: 'shopping-search', lib: 'mci', colors: ['#047857', '#10b981'], route: 'Marketplace' },
      { title: 'Broadcast RFQ', sub: 'Request custom price', icon: 'bullhorn-outline', lib: 'mci', colors: ['#b45309', '#f59e0b'], badge: 'REQS', route: 'MandiPulse' },
      { title: 'AI Quality Scan', sub: 'Verify grain purity', icon: 'check-decagram-outline', lib: 'mci', colors: ['#6d28d9', '#a78bfa'], route: 'Quality' },
      { title: 'Tax Invoices', sub: 'Download bills & trade logs', icon: 'file-document-outline', lib: 'mci', colors: ['#1d4ed8', '#60a5fa'], route: 'Ledger' },
    ],
    marketPulseLabel: 'COMPLIANCE & LOGISTICS WATCH',
    marketPulseText: 'Interstate transport checkpoints report minor delays. Verify that your wholesalers have uploaded valid clearance documents before shipment dispatch.',
  },
};

// ─── REUSABLE ACTION CARD COMPONENT ──────────────────────────────────────────
const ActionCard = ({ action, index, navigation }: { action: ActionItem; index: number; navigation: any }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay: index * 60, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, delay: index * 60, useNativeDriver: true, speed: 12, bounciness: 6 }),
    ]).start();
  }, [action.title]);

  const handlePressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ width: CARD_W, opacity, transform: [{ translateY }, { scale }] }}>
      <Pressable
        onPress={() => navigation.navigate(action.route)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <LinearGradient colors={action.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionCard}>
          {action.badge && (
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>{action.badge}</Text>
            </View>
          )}
          <View style={styles.actionDecCircle} />
          {action.lib === 'mci' ? (
            <MaterialCommunityIcons name={action.icon as any} size={28} color="#fff" />
          ) : (
            <Ionicons name={action.icon as any} size={26} color="#fff" />
          )}
          <Text style={styles.actionTitle}>{action.title}</Text>
          <Text style={styles.actionSub}>{action.sub}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
};

// ─── MAIN DYNAMIC LANDING SCREEN ─────────────────────────────────────────────
export default function LandingScreen({ navigation }: any) {
  // @ts-ignore
  const { user, logout } = useContext(AuthContext);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.75)).current;

  // 🛡️ FRONTEND ROLE CHECK
  const userRole: UserRole = (user?.role as UserRole) || 'FARMER';
  const currentConfig = ROLE_CONFIGS[userRole];
  const trustBadge = getTrustDesignation(user?.averageRating ?? 0, user?.totalReviews ?? 0);

  const toggleSidebar = () => {
    Animated.timing(slideAnim, {
      toValue: isSidebarOpen ? -width * 0.75 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
    setSidebarOpen(!isSidebarOpen);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5efe6" />
      <View style={styles.root}>
        <Header toggleSidebar={toggleSidebar} />

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Dynamic Hero Layout */}
          <LinearGradient
            colors={currentConfig.themeColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.blob1} />
            <View style={styles.blob2} />

            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.greeting}>Logged in as {user?.name || 'User'}</Text>
                <View style={[styles.trustBadge, { backgroundColor: trustBadge.bg }]}>
                  <Text style={[styles.trustBadgeText, { color: trustBadge.color }]}>
                    {trustBadge.title}
                  </Text>
                </View>
                <Text style={styles.heroName}>{currentConfig.dashboardTitle}</Text>
                <Text style={styles.heroSubText}>{currentConfig.dashboardSub}</Text>
                <TouchableOpacity 
        style={styles.ratingRow} 
        onPress={() => navigation.navigate('MyReviews', { targetUserId: user.id })}
      >
        <Ionicons name="star" size={16} color="#fbbf24" />
        <Text style={styles.ratingNumber}>
          {user.averageRating > 0 ? user.averageRating.toFixed(1) : 'No Ratings'}
        </Text>
        <Text style={styles.totalReviews}>
          ({user.totalReviews} {user.totalReviews === 1 ? 'review' : 'reviews'})
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#94a3b8" style={{ marginLeft: 4 }} />
      </TouchableOpacity>
              </View>
            </View>

            <View style={styles.heroDivider} />

            {/* Render Contextual Stats */}
            <View style={styles.heroStats}>
              {currentConfig.stats.map((stat, i) => (
                <React.Fragment key={stat.label}>
                  <View style={styles.heroStatItem}>
                    <Text style={[styles.heroStatVal, { color: stat.color }]}>{stat.value}</Text>
                    <Text style={styles.heroStatLbl}>{stat.label}</Text>
                  </View>
                  {i < currentConfig.stats.length - 1 && <View style={styles.heroStatSep} />}
                </React.Fragment>
              ))}
            </View>
          </LinearGradient>

          {/* Dynamic Informational Banner */}
          <LinearGradient colors={['#fffbeb', '#fef3c7']} style={styles.insightCard}>
            <View style={styles.insightIcon}>
              <MaterialCommunityIcons name="alert-decagram-outline" size={22} color="#b45309" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.insightLabel}>{currentConfig.marketPulseLabel}</Text>
              <Text style={styles.insightText}>{currentConfig.marketPulseText}</Text>
            </View>
          </LinearGradient>

          {/* Dynamic Actions Workspace Header */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Workspace Operations</Text>
          </View>

          {/* Dynamic Grid Layout */}
          <View style={styles.grid}>
            {currentConfig.actions.map((action, index) => (
              <ActionCard
                key={action.title}
                action={action}
                index={index}
                navigation={navigation}
              />
            ))}
          </View>

        </ScrollView>

        <Sidebar
          slideAnim={slideAnim}
          toggleSidebar={toggleSidebar}
          logout={logout}
          isSidebarOpen={isSidebarOpen}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── STYLING ARCHITECTURE ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5efe6', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  root: { flex: 1, backgroundColor: '#f5efe6' },
  scroll: { padding: 16, paddingBottom: 40 },
  heroCard: { borderRadius: 24, padding: 22, marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  blob1: { position: 'absolute', right: -30, top: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.04)' },
  blob2: { position: 'absolute', left: -20, bottom: -20, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.04)' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
  greeting: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  heroName: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.2 },
  heroSubText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '400', marginTop: 4 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.12)', marginVertical: 14 },
  heroStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroStatItem: { flex: 1, alignItems: 'center' },
  heroStatVal: { fontSize: 18, fontWeight: '800' },
  heroStatLbl: { color: 'rgba(255,255,255,0.65)', fontSize: 10, fontWeight: '600', marginTop: 4, textTransform: 'uppercase' },
  heroStatSep: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.15)' },
  insightCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#fde68a', marginBottom: 20 },
  insightIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#fde68a', justifyContent: 'center', alignItems: 'center' },
  insightLabel: { color: '#92400e', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 2 },
  insightText: { fontSize: 12, color: '#78350f', lineHeight: 17, fontWeight: '500' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', letterSpacing: -0.1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  actionCard: { borderRadius: 20, padding: 16, minHeight: 126, justifyContent: 'flex-end', overflow: 'hidden' },
  actionBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.22)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  actionBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  actionDecCircle: { position: 'absolute', top: -15, right: -15, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.06)' },
  actionTitle: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 12 },
  actionSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '500', marginTop: 2 },
  sellerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  trustBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  trustBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingVertical: 4 },
  ratingNumber: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginLeft: 4 },
  totalReviews: { fontSize: 13, color: '#64748b', marginLeft: 4 },
});