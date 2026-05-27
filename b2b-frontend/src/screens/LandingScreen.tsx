import React, { useState, useRef, useContext, useEffect } from 'react';
import {
  View, Text, StyleSheet, Animated, Dimensions, SafeAreaView,
  Platform, StatusBar, TouchableOpacity, ScrollView, Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AuthContext } from '../context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

const { width } = Dimensions.get('window');

type Action = {
  title: string;
  sub: string;
  icon: React.ReactNode;
  colors: [string, string];
  onPress?: () => void;
};

const AnimatedActionCard = ({ action, index }: { action: Action; index: number }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1, duration: 450, delay: 120 + index * 90, useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0, duration: 450, delay: 120 + index * 90, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Animated.View style={{ width: '48%', opacity, transform: [{ translateY }, { scale }] }}>
      <Pressable
        onPress={action.onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.actionCard}
      >
        <LinearGradient colors={action.colors} style={styles.iconBg}>
          {action.icon}
        </LinearGradient>
        <Text style={styles.actionTitle}>{action.title}</Text>
        <Text style={styles.actionSub}>{action.sub}</Text>
      </Pressable>
    </Animated.View>
  );
};

export default function LandingScreen({ navigation }: any) {
  // @ts-ignore
  const { user, logout } = useContext(AuthContext);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.75)).current;

  // Welcome card entrance
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeY = useRef(new Animated.Value(-15)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(welcomeOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(welcomeY, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 6 }),
    ]).start();
  }, []);

  const toggleSidebar = () => {
    Animated.timing(slideAnim, {
      toValue: isSidebarOpen ? -width * 0.75 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setSidebarOpen(!isSidebarOpen);
  };

  const actions: Action[] = [
    {
      title: 'Live Mandi',
      sub: 'Browse products & plots',
      colors: ['#11998e', '#38ef7d'],
      icon: <MaterialCommunityIcons name="storefront-outline" size={28} color="#fff" />,
      onPress: () => navigation.navigate('Marketplace'),
    },
    {
      title: 'Sell Product',
      sub: 'List crops & grains',
      colors: ['#f7971e', '#ffd200'],
      icon: <MaterialCommunityIcons name="basket-plus-outline" size={28} color="#fff" />,
      onPress: () => navigation.navigate('AddProduct'),
    },
    {
      title: 'List Property',
      sub: 'Rent or sell spaces',
      colors: ['#3a7bd5', '#3a6073'],
      icon: <Ionicons name="business-outline" size={26} color="#fff" />,
      onPress: () => navigation.navigate('AddProperty'),
    },
    {
      title: 'My Inventory',
      sub: 'Manage your listings',
      colors: ['#8e2de2', '#4a00e0'],
      icon: <MaterialCommunityIcons name="clipboard-list-outline" size={28} color="#fff" />,
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Header toggleSidebar={toggleSidebar} />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Welcome Card */}
          <Animated.View style={{ opacity: welcomeOpacity, transform: [{ translateY: welcomeY }] }}>
            <LinearGradient
              colors={['#1f3a5f', '#2c5364']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.welcomeCard}
            >
              <View style={styles.welcomeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.welcomeText}>Welcome back,</Text>
                  <Text style={styles.userName}>{user?.name} 👋</Text>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{user?.role}</Text>
                  </View>
                </View>
                <View style={styles.welcomeIcon}>
                  <MaterialCommunityIcons name="warehouse" size={42} color="rgba(255,255,255,0.9)" />
                </View>
              </View>
            </LinearGradient>
          </Animated.View>

          <Text style={styles.sectionTitle}>Quick Actions</Text>

          {/* Action Grid */}
          <View style={styles.gridContainer}>
            {actions.map((a, i) => (
              <AnimatedActionCard key={a.title} action={a} index={i} />
            ))}
          </View>
        </ScrollView>

        <Sidebar slideAnim={slideAnim} toggleSidebar={toggleSidebar} logout={logout} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  container: { flex: 1, backgroundColor: '#f4f6fa' },
  content: { padding: 20, paddingBottom: 40 },

  welcomeCard: {
    padding: 24, borderRadius: 22, marginBottom: 28,
    shadowColor: '#1f3a5f', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8,
    overflow: 'hidden',
  },
  welcomeRow: { flexDirection: 'row', alignItems: 'center' },
  welcomeIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  welcomeText: { color: '#cfd8e3', fontSize: 15, marginBottom: 4, letterSpacing: 0.3 },
  userName: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 12 },
  roleBadge: {
    backgroundColor: 'rgba(52,152,219,0.95)', alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  roleText: { color: '#fff', fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },

  sectionTitle: { fontSize: 19, fontWeight: '800', color: '#1f2d3d', marginBottom: 16, letterSpacing: 0.2 },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  actionCard: {
    backgroundColor: '#fff', padding: 18, borderRadius: 18, marginBottom: 16, alignItems: 'center',
    shadowColor: '#1f2d3d', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  iconBg: {
    width: 62, height: 62, borderRadius: 31,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  actionTitle: { fontSize: 15, fontWeight: '700', color: '#1f2d3d', textAlign: 'center', marginBottom: 4 },
  actionSub: { fontSize: 12, color: '#7a8a99', textAlign: 'center' },
});
