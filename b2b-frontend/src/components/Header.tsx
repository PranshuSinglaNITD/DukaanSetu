import React, { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Pressable,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const NOTIFICATION_COUNT: number = 3; // swap with real data / context

export default function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  const logoScale    = useRef(new Animated.Value(0.88)).current;
  const logoOpacity  = useRef(new Animated.Value(0)).current;
  const bellShake    = useRef(new Animated.Value(0)).current;
  const [bellPressed, setBellPressed] = useState(false);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale,   { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 9 }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 380,          useNativeDriver: true }),
    ]).start();
  }, []);

  // Bell shake on mount to draw attention to notifications
  useEffect(() => {
    if (NOTIFICATION_COUNT === 0) return;
    const timeout = setTimeout(() => {
      Animated.sequence([
        Animated.timing(bellShake, { toValue:  8, duration: 60, useNativeDriver: true }),
        Animated.timing(bellShake, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(bellShake, { toValue:  6, duration: 55, useNativeDriver: true }),
        Animated.timing(bellShake, { toValue: -6, duration: 55, useNativeDriver: true }),
        Animated.timing(bellShake, { toValue:  0, duration: 50, useNativeDriver: true }),
      ]).start();
    }, 800);
    return () => clearTimeout(timeout);
  }, []);

  const menuScale = useRef(new Animated.Value(1)).current;
  const menuPressIn  = () => Animated.spring(menuScale, { toValue: 0.88, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  const menuPressOut = () => Animated.spring(menuScale, { toValue: 1,    useNativeDriver: true, speed: 50, bounciness: 4 }).start();

  return (
    <View style={styles.header}>

      {/* ── Hamburger ── */}
      <Animated.View style={{ transform: [{ scale: menuScale }] }}>
        <Pressable
          onPress={toggleSidebar}
          onPressIn={menuPressIn}
          onPressOut={menuPressOut}
          style={styles.menuBtn}
        >
          <MaterialCommunityIcons name="menu" size={24} color="#1e293b" />
        </Pressable>
      </Animated.View>

      {/* ── Logo ── */}
      <Animated.View
        style={[styles.titleWrap, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
      >
        {/* Green accent dot */}
        <View style={styles.logoRow}>
          <View style={styles.logoDot} />
          <Text style={styles.logoText}>DukaanSetu</Text>
        </View>
        <View style={styles.subtitleRow}>
          <MaterialCommunityIcons name="storefront-outline" size={10} color="#059669" />
          <Text style={styles.subtitle}>LIVE MANDI</Text>
        </View>
      </Animated.View>

      {/* ── Notifications ── */}
      <Animated.View style={{ transform: [{ rotate: bellShake.interpolate({ inputRange: [-8, 8], outputRange: ['-8deg', '8deg'] }) }] }}>
        <TouchableOpacity
          style={[styles.bellBtn, bellPressed && styles.bellBtnPressed]}
          onPressIn={() => setBellPressed(true)}
          onPressOut={() => setBellPressed(false)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={NOTIFICATION_COUNT > 0 ? 'notifications' : 'notifications-outline'}
            size={22}
            color={NOTIFICATION_COUNT > 0 ? '#059669' : '#64748b'}
          />
          {NOTIFICATION_COUNT > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {NOTIFICATION_COUNT > 9 ? '9+' : NOTIFICATION_COUNT}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    // Subtle bottom shadow
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },

  // ── Hamburger ──────────────────────────────────────────────────────────
  menuBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
    justifyContent: 'center', alignItems: 'center',
  },

  // ── Logo ───────────────────────────────────────────────────────────────
  titleWrap: { alignItems: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: '#059669',
    // Slight glow effect via shadow
    shadowColor: '#059669',
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  logoText: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1,
  },
  subtitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#059669',
    letterSpacing: 2,
  },

  // ── Bell ───────────────────────────────────────────────────────────────
  bellBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
    justifyContent: 'center', alignItems: 'center',
  },
  bellBtnPressed: {
    backgroundColor: '#ecfdf5',
    borderColor: '#bbf7d0',
  },
  badge: {
    position: 'absolute', top: 6, right: 6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#ef4444',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: '#fff',
  },
  badgeText: {
    color: '#fff', fontSize: 8, fontWeight: '800',
  },
});