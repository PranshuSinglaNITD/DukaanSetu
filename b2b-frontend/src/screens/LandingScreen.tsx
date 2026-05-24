import React, { useState, useRef, useContext } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, SafeAreaView, Platform, StatusBar, TouchableOpacity, ScrollView } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; 
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

const { width } = Dimensions.get('window');

export default function LandingScreen({ navigation }: any) {
  // @ts-ignore
  const { user, logout } = useContext(AuthContext);
  
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.75)).current;

  const toggleSidebar = () => {
    Animated.timing(slideAnim, {
      toValue: isSidebarOpen ? -width * 0.75 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    setSidebarOpen(!isSidebarOpen);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Header toggleSidebar={toggleSidebar} />

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          
          {/* Welcome Card */}
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name} 👋</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user?.role}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Quick Actions</Text>

          {/* Action Grid */}
          <View style={styles.gridContainer}>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Marketplace')}>
              <View style={[styles.iconBg, { backgroundColor: '#e8f4fd' }]}>
                <Ionicons name="storefront" size={32} color="#3498db" />
              </View>
              <Text style={styles.actionTitle}>Live Mandi</Text>
              <Text style={styles.actionSub}>Browse products & plots</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AddProduct')}>
              <View style={[styles.iconBg, { backgroundColor: '#eafaf1' }]}>
                <MaterialCommunityIcons name="sack" size={32} color="#27ae60" />
              </View>
              <Text style={styles.actionTitle}>Sell Product</Text>
              <Text style={styles.actionSub}>List crops & grains</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AddProperty')}>
              <View style={[styles.iconBg, { backgroundColor: '#fdf2e9' }]}>
                <Ionicons name="business" size={32} color="#e67e22" />
              </View>
              <Text style={styles.actionTitle}>List Property</Text>
              <Text style={styles.actionSub}>Rent or sell spaces</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionCard}>
              <View style={[styles.iconBg, { backgroundColor: '#f4f6f8' }]}>
                <Ionicons name="cube" size={32} color="#7f8c8d" />
              </View>
              <Text style={styles.actionTitle}>My Inventory</Text>
              <Text style={styles.actionSub}>Manage your listings</Text>
            </TouchableOpacity>
          </View>
          
        </ScrollView>

        <Sidebar isSidebarOpen={isSidebarOpen} toggleSidebar={toggleSidebar} slideAnim={slideAnim} user={user} logout={logout} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 20 },
  
  welcomeCard: { backgroundColor: '#2c3e50', padding: 25, borderRadius: 20, marginBottom: 30, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  welcomeText: { color: '#bdc3c7', fontSize: 16, marginBottom: 5 },
  userName: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginBottom: 15 },
  roleBadge: { backgroundColor: '#3498db', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  roleText: { color: '#fff', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },

  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50', marginBottom: 15 },
  
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  actionCard: { backgroundColor: '#fff', width: '48%', padding: 20, borderRadius: 16, marginBottom: 15, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  iconBg: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  actionTitle: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center', marginBottom: 5 },
  actionSub: { fontSize: 12, color: '#7f8c8d', textAlign: 'center' }
});