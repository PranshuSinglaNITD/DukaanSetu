import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Dimensions, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
// 🚨 Import the Safe Area hook
import { useSafeAreaInsets } from 'react-native-safe-area-context'; 

const { width } = Dimensions.get('window');

export default function Sidebar({ isSidebarOpen, toggleSidebar, slideAnim, user, logout }: any) {
  const navigation = useNavigation<any>();
  
  // 🚨 This automatically calculates the exact height of the Android/iOS bottom navigation bar
  const insets = useSafeAreaInsets(); 

  return (
    <>
      {isSidebarOpen && (
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={toggleSidebar} />
      )}
      <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
        
        {/* Header dynamically adjusts to the notch/status bar */}
        <View style={[
          styles.sidebarHeader, 
          { paddingTop: Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 20 }
        ]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase() || 'U'}</Text>
          </View>
          <View>
            <Text style={styles.sidebarName}>{user?.name}</Text>
            <Text style={styles.sidebarRole}>{user?.role}</Text>
          </View>
        </View>

        <ScrollView style={styles.sidebarMenu} showsVerticalScrollIndicator={false}>
          {/* MAIN SECTION */}
          <Text style={styles.menuLabel}>MAIN</Text>
          <TouchableOpacity style={styles.sidebarItem} onPress={() => { toggleSidebar(); navigation.navigate('Landing'); }}>
            <Ionicons name="home-outline" size={24} color="#34495e" />
            <Text style={styles.sidebarItemText}>Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sidebarItem} onPress={() => { toggleSidebar(); navigation.navigate('Marketplace'); }}>
            <Ionicons name="storefront-outline" size={24} color="#34495e" />
            <Text style={styles.sidebarItemText}>Live Mandi</Text>
          </TouchableOpacity>

          {/* LISTINGS SECTION */}
          <Text style={styles.menuLabel}>LISTINGS</Text>
          <TouchableOpacity style={styles.sidebarItem} onPress={() => { toggleSidebar(); navigation.navigate('AddProduct'); }}>
            <Ionicons name="add-circle-outline" size={24} color="#27ae60" />
            <Text style={[styles.sidebarItemText, { color: '#27ae60' }]}>Add Product</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sidebarItem} onPress={() => { toggleSidebar(); navigation.navigate('AddProperty'); }}>
            <Ionicons name="business-outline" size={24} color="#27ae60" />
            <Text style={[styles.sidebarItemText, { color: '#27ae60' }]}>List Property</Text>
          </TouchableOpacity>

          {/* ACCOUNT SECTION */}
          <Text style={styles.menuLabel}>ACCOUNT</Text>
          <TouchableOpacity style={styles.sidebarItem} onPress={() => { toggleSidebar(); navigation.navigate('Inventory'); }}>
            <Ionicons name="cube-outline" size={24} color="#34495e" />
            <Text style={styles.sidebarItemText}>My Inventory</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sidebarItem} onPress={() => { toggleSidebar(); navigation.navigate('Negotiations'); }}>
            <Ionicons name="chatbubbles-outline" size={24} color="#34495e" />
            <Text style={styles.sidebarItemText}>Negotiations Inbox</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sidebarItem}>
            <Ionicons name="heart-outline" size={24} color="#34495e" />
            <Text style={styles.sidebarItemText}>Favorites</Text>
          </TouchableOpacity>
          
          {/* Small spacer to ensure the bottom item doesn't get hidden under the logout button */}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* 🚨 Dynamic Padding applied directly to the style array */}
        <TouchableOpacity 
          style={[styles.logoutButton, { paddingBottom: Math.max(insets.bottom + 10, 20) }]} 
          onPress={logout}
        >
          <Ionicons name="log-out-outline" size={24} color="#e74c3c" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 10 },
  sidebar: { position: 'absolute', top: 0, bottom: 0, left: 0, width: width * 0.75, backgroundColor: '#fff', zIndex: 20, elevation: 15, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 15 },
  
  // Removed hardcoded padding from header; it's handled dynamically in the JSX now
  sidebarHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f2f6', backgroundColor: '#f8f9fa' },
  
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#3498db', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  sidebarName: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  sidebarRole: { fontSize: 13, color: '#3498db', fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  sidebarMenu: { flex: 1, paddingTop: 10 },

  menuLabel: { fontSize: 12, color: '#95a5a6', fontWeight: 'bold', marginTop: 20, marginBottom: 5, paddingHorizontal: 20, letterSpacing: 1 },

  sidebarItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  sidebarItemText: { fontSize: 16, color: '#34495e', marginLeft: 15, fontWeight: '500' },
  
  // Removed hardcoded paddingBottom from logout; handled dynamically in JSX
  logoutButton: { flexDirection: 'row', alignItems: 'center', padding: 20, borderTopWidth: 1, borderTopColor: '#f1f2f6', backgroundColor: '#fff' },
  logoutText: { fontSize: 16, color: '#e74c3c', marginLeft: 15, fontWeight: 'bold' }
});