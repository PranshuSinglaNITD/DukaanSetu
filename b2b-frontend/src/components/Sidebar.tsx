import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';

const { width } = Dimensions.get('window');

// ─── Menu Config & RBAC (Role-Based Access Control) ──────────────────────────

type Role = 'FARMER' | 'WHOLESALER' | 'RETAILER';

type MenuItem = {
  label: string;
  route?: string;
  icon: string;
  lib: 'ion' | 'mci';
  badge?: string | number;
  accent?: boolean;
  roles?: Role[]; // 🚨 NEW: Determines which roles can see this item
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

const MASTER_MENU: MenuSection[] = [
  {
    title: 'MAIN',
    items: [
      { label: 'Dashboard',    route: 'Landing',     icon: 'view-dashboard-outline', lib: 'mci' }, // Universal
      { label: 'Live Mandi',   route: 'Marketplace', icon: 'storefront-outline',     lib: 'mci' }, // Universal
      { label: 'MandiBrain',   route: 'Chat',        icon: 'chat-processing',        lib: 'mci' }, // Universal
      { label: 'Analytics',    route: 'Analytics',   icon: 'chart-line',             lib: 'mci', roles: ['WHOLESALER', 'RETAILER'] },
      { label: 'Quality Check',route: 'Quality',     icon: 'check-decagram-outline', lib: 'mci', roles: ['RETAILER'] },
    ],
  },
  {
    title: 'LISTINGS',
    items: [
      { label: 'Suggestions',   route: 'MandiPulse',  icon: 'lightbulb-on-outline',   lib: 'mci' }, // Universal
      { label: 'Add Product',   route: 'AddProduct',  icon: 'basket-plus-outline',    lib: 'mci', accent: true, roles: ['FARMER', 'WHOLESALER','RETAILER'] },
      { label: 'List Property', route: 'AddProperty', icon: 'home-plus-outline',      lib: 'mci', accent: true, roles: ['WHOLESALER','FARMER','RETAILER'] },
      { label: 'My Inventory',  route: 'Inventory',   icon: 'warehouse',              lib: 'mci', badge: 3,     roles: ['FARMER', 'WHOLESALER'] },
      { label: 'My KhataBook',  route: 'Khata',       icon: 'book-open-page-variant-outline', lib: 'mci',       roles: ['FARMER', 'WHOLESALER'] },
    ],
  },
  {
    title: 'ORDERS & SALES',
    items: [
      { label: 'Pending Orders',      route: 'Orders',      icon: 'package-variant-closed', lib: 'mci', badge: 2 }, // Universal
      { label: 'My Sales & Dispatch', route: 'SellerSales', icon: 'truck-delivery-outline',  lib: 'mci', roles: ['FARMER', 'WHOLESALER'] },
      { label: 'Track Purchases',     route: 'BuyerOrders', icon: 'map-marker-path',         lib: 'mci', roles: ['WHOLESALER', 'RETAILER'] },
      { label: 'Automatic Ledgers',   route: 'Ledger',      icon: 'file-document-outline',   lib: 'mci', roles: ['WHOLESALER', 'RETAILER'] },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { label: 'Negotiations Inbox', route: 'Negotiations', icon: 'message-text-outline', lib: 'mci', badge: 5 }, // Universal
      { label: 'My Reviews', route: 'MyReviews', icon: 'star-outline', lib: 'mci', badge: 5 },
      { label: 'Favourites',         route: 'Favourites',   icon: 'heart-outline',         lib: 'mci' }, // Universal
      { label: 'Settings',           route: 'Settings',     icon: 'cog-outline',           lib: 'mci' }, // Universal
    ],
  },
];

// ─── Filter Logic ─────────────────────────────────────────────────────────────

const getDynamicMenu = (userRole: Role): MenuSection[] => {
  return MASTER_MENU.map(section => {
    const filteredItems = section.items.filter(item => {
      if (!item.roles) return true; // If no roles array is provided, it's public
      return item.roles.includes(userRole);
    });
    return { ...section, items: filteredItems };
  }).filter(section => section.items.length > 0); // Strip empty sections
};


// ─── Sub-components ───────────────────────────────────────────────────────────

const MenuRow = ({
  item,
  active,
  onPress,
}: {
  item: MenuItem;
  active: boolean;
  onPress: () => void;
}) => {
  const icon =
    item.lib === 'mci' ? (
      <MaterialCommunityIcons
        name={item.icon as any}
        size={21}
        color={active ? '#059669' : item.accent ? '#059669' : '#64748b'}
      />
    ) : (
      <Ionicons
        name={item.icon as any}
        size={21}
        color={active ? '#059669' : item.accent ? '#059669' : '#64748b'}
      />
    );

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.menuRow, active && styles.menuRowActive]}
    >
      {/* Active bar */}
      {active && <View style={styles.activeBar} />}

      {/* Icon wrapper */}
      <View style={[styles.menuIconWrap, active && styles.menuIconWrapActive]}>
        {icon}
      </View>

      <Text
        style={[
          styles.menuRowText,
          active && styles.menuRowTextActive,
          item.accent && !active && styles.menuRowTextAccent,
        ]}
      >
        {item.label}
      </Text>

      {/* Badge */}
      {item.badge !== undefined && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Sidebar({
  isSidebarOpen,
  toggleSidebar,
  slideAnim,
  logout,
}: {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  slideAnim: Animated.Value;
  logout: () => void;
}) {
  const navigation = useNavigation<any>();
  const route      = useRoute();
  // @ts-ignore
  const { user }   = useContext(AuthContext);
  const insets     = useSafeAreaInsets();

  // 🚨 Determine the user's role, fallback to FARMER to prevent crashes
  const currentRole = (user?.role as Role) || 'FARMER';
  
  // 🚨 Generate the filtered menu
  const dynamicMenu = getDynamicMenu(currentRole);

  // Defer unmount so the drawer is removed from the tree only AFTER the
  // close animation finishes (300 ms).
  const [shouldRender, setShouldRender] = useState(isSidebarOpen);
  useEffect(() => {
    if (isSidebarOpen) {
      setShouldRender(true);
    } else {
      const t = setTimeout(() => setShouldRender(false), 320);
      return () => clearTimeout(t);
    }
  }, [isSidebarOpen]);

  const topPad =
    Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0) + 16;

  const navigate = (routeName: string) => {
    toggleSidebar();
    navigation.navigate(routeName);
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((w: string) => w[0])
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <>
      {/* Overlay */}
      {isSidebarOpen && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={toggleSidebar}
        />
      )}

      {/* Drawer */}
      {shouldRender && (
      <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>

        {/* ── Header ── */}
        <LinearGradient
          colors={['#052e16', '#065f46', '#0a7a57']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.drawerHeader, { paddingTop: topPad }]}
        >
          {/* Decorative blobs */}
          <View style={styles.hBlob1} />
          <View style={styles.hBlob2} />

          {/* Avatar + info */}
          <View style={styles.headerRow}>
            <View style={styles.avatarRing}>
              <View style={styles.avatarInner}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.headerName} numberOfLines={1}>
                {user?.name ?? 'Shopkeeper'}
              </Text>
              <View style={styles.roleRow}>
                <MaterialCommunityIcons name="store-check-outline" size={11} color="#fcd34d" />
                <Text style={styles.headerRole}>{user?.role ?? 'Verified Seller'}</Text>
              </View>
            </View>

            {/* Close button */}
            <TouchableOpacity style={styles.closeBtn} onPress={toggleSidebar}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          {/* Quick stats */}
          <View style={styles.headerStats}>
            <View style={styles.hStat}>
              <Text style={styles.hStatVal}>₹2.4L</Text>
              <Text style={styles.hStatLbl}>Today</Text>
            </View>
            <View style={styles.hStatSep} />
            <View style={styles.hStat}>
              <Text style={styles.hStatVal}>18</Text>
              <Text style={styles.hStatLbl}>Listings</Text>
            </View>
            <View style={styles.hStatSep} />
            <View style={styles.hStat}>
              <Text style={[styles.hStatVal, { color: '#fbbf24' }]}>5</Text>
              <Text style={styles.hStatLbl}>Pending</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Menu ── */}
        <ScrollView
          style={styles.menuScroll}
          contentContainerStyle={styles.menuContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 🚨 Maps through dynamicMenu instead of MENU */}
          {dynamicMenu.map((section) => (
            <View key={section.title}>
              <Text style={styles.sectionLabel}>{section.title}</Text>
              {section.items.map((item) => (
                <MenuRow
                  key={item.label}
                  item={item}
                  active={route.name === item.route}
                  onPress={() => item.route ? navigate(item.route) : undefined}
                />
              ))}
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* ── Footer ── */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 10, 20) }]}>
          {/* Help row */}
          <TouchableOpacity style={styles.helpRow}>
            <MaterialCommunityIcons name="help-circle-outline" size={20} color="#94a3b8" />
            <Text style={styles.helpText}>Help & Support</Text>
          </TouchableOpacity>

          <View style={styles.footerDivider} />

          {/* Logout */}
          <TouchableOpacity style={styles.logoutRow} onPress={logout}>
            <View style={styles.logoutIconWrap}>
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            </View>
            <Text style={styles.logoutText}>Logout</Text>
            <Ionicons name="chevron-forward" size={16} color="#ef4444" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

      </Animated.View>
      )}

    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10,
  },
  drawer: {
    position: 'absolute', top: 0, bottom: 0, left: 0,
    width: width * 0.78, backgroundColor: '#f8f7f4',
    zIndex: 20, elevation: 20,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20,
    shadowOffset: { width: 6, height: 0 },
  },

  // ── Header ──────────────────────────────────────────────────────────────
  drawerHeader: {
    paddingHorizontal: 20, paddingBottom: 20, overflow: 'hidden',
  },
  hBlob1: {
    position: 'absolute', right: -30, top: -30,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(245,158,11,0.1)',
  },
  hBlob2: {
    position: 'absolute', left: -10, bottom: -20,
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(16,185,129,0.1)',
  },

  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },

  avatarRing: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: 'rgba(251,191,36,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarInner: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(245,158,11,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fbbf24', fontSize: 17, fontWeight: '800' },

  headerName: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.2, marginBottom: 5 },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerRole: { color: '#fcd34d', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },

  headerStats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 14, padding: 12,
  },
  hStat: { flex: 1, alignItems: 'center' },
  hStatVal: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  hStatLbl: { color: '#a7f3d0', fontSize: 9, fontWeight: '500', marginTop: 3 },
  hStatSep: { width: 1, height: 26, backgroundColor: 'rgba(255,255,255,0.12)' },

  // ── Menu ────────────────────────────────────────────────────────────────
  menuScroll: { flex: 1 },
  menuContent: { paddingTop: 10, paddingBottom: 8 },

  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: '#94a3b8',
    letterSpacing: 1.4, marginTop: 22, marginBottom: 4,
    paddingHorizontal: 20,
  },

  menuRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 11, paddingHorizontal: 20,
    marginHorizontal: 10, borderRadius: 12,
    marginBottom: 2, position: 'relative', overflow: 'hidden',
  },
  menuRowActive: { backgroundColor: '#ecfdf5' },
  activeBar: {
    position: 'absolute', left: 0, top: '20%', bottom: '20%',
    width: 3, borderRadius: 2, backgroundColor: '#059669',
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#f1f5f9', marginRight: 12,
  },
  menuIconWrapActive: { backgroundColor: '#d1fae5' },

  menuRowText: { fontSize: 14, color: '#475569', fontWeight: '600', flex: 1 },
  menuRowTextActive: { color: '#065f46', fontWeight: '700' },
  menuRowTextAccent: { color: '#059669' },

  badge: {
    backgroundColor: '#059669', minWidth: 20, height: 20,
    borderRadius: 10, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  // ── Footer ──────────────────────────────────────────────────────────────
  footer: {
    backgroundColor: '#fff',
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
    paddingTop: 6,
  },
  footerDivider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 20, marginVertical: 4 },

  helpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 24,
  },
  helpText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },

  logoutRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: 20, gap: 12,
  },
  logoutIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#fef2f2',
    justifyContent: 'center', alignItems: 'center',
  },
  logoutText: { fontSize: 14, color: '#ef4444', fontWeight: '700' },
});