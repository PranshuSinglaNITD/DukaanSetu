import React, { useState, useEffect, useRef, useContext } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated, Dimensions, ActivityIndicator, Platform, StatusBar, TouchableOpacity, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; // Using the modern Safe Area
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/client';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; 

import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

const { width } = Dimensions.get('window');

export default function MarketplaceScreen({navigation}:any) {
  // @ts-ignore
  const { user, logout } = useContext(AuthContext);
  
  const [products, setProducts] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const slideAnim = useRef(new Animated.Value(-width * 0.75)).current;

  useEffect(() => {
    fetchMarketplaceData();
  }, []);

  const fetchMarketplaceData = async () => {
    setLoading(true);
    try {
      const [productRes, propertyRes] = await Promise.all([
        apiClient.get('/products'), 
        apiClient.get('/properties')
      ]);

      const allProducts = productRes.data?.data || [];
      const allProperties = propertyRes.data?.data || [];

      // Safely filter out the user's own listings so they don't buy their own stuff
      setProducts(allProducts.filter((p: any) => p.sellerId !== user?.id));
      setProperties(allProperties.filter((p: any) => p.ownerId !== user?.id));

    } catch (error: any) {
      // THIS WILL TELL YOU EXACTLY WHY IT IS FAILING
      console.log("🚨 FETCH ERROR:", error.response?.data || error.message);
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
    setSidebarOpen(!isSidebarOpen);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        
        <Header toggleSidebar={toggleSidebar} />

        {/* Premium Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#7f8c8d" style={styles.searchIcon} />
            <TextInput style={styles.searchInput} placeholder="Search crops, shops, or cities..." placeholderTextColor="#95a5a6" />
          </View>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#27ae60" /></View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            
            {/* PROPERTIES SECTION */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Properties</Text>
              <TouchableOpacity><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
              {properties.length === 0 ? (
                 <View style={styles.emptyCard}><Text style={styles.emptyText}>No properties available right now.</Text></View>
              ) : (
                properties.map((prop: any) => (
                  <TouchableOpacity key={prop.id} style={styles.propertyCard} activeOpacity={0.9}>
                    {/* Display Real Image if it exists, otherwise placeholder */}
                    {prop.images && prop.images.length > 0 ? (
                      <Image source={{ uri: prop.images[0] }} style={styles.imagePlaceholder} />
                    ) : (
                      <View style={styles.imagePlaceholder}>
                        <Ionicons name="business" size={40} color="#bdc3c7" />
                      </View>
                    )}

                    {/* Dynamic Badge */}
                    <View style={[styles.badge, { backgroundColor: prop.listingType === 'RENT' ? '#3498db' : '#e67e22' }]}>
                      <Text style={styles.badgeText}>FOR {prop.listingType}</Text>
                    </View>

                    <View style={styles.propertyInfo}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{prop.title}</Text>
                      <Text style={styles.cardCity}>
                        <Ionicons name="location-sharp" size={12} color="#7f8c8d" /> {prop.city}, {prop.state}
                      </Text>
                      <Text style={styles.cardPrice}>₹{prop.price} <Text style={styles.priceSub}>{prop.listingType === 'RENT' ? '/mo' : ''}</Text></Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            {/* PRODUCTS SECTION */}
            <View style={[styles.sectionHeader, { marginTop: 15 }]}>
              <Text style={styles.sectionTitle}>Live Mandi Prices</Text>
            </View>

            {products.length === 0 ? (
               <View style={styles.emptyCard}><Text style={styles.emptyText}>No products listed in the Mandi today.</Text></View>
            ) : (
              products.map((prod: any) => (
                <TouchableOpacity key={prod.id} style={styles.productCard} activeOpacity={0.8}
                  onPress={() => navigation.navigate('ProductDetail', { product: prod })}
                >
                  <View style={styles.productIconBg}>
                    <MaterialCommunityIcons name="sack" size={28} color="#27ae60" />
                  </View>
                  <View style={styles.productDetails}>
                    <Text style={styles.productName}>{prod.name}</Text>
                    <Text style={styles.productSub}>{prod.category} • {prod.stock} {prod.unit} available</Text>
                  </View>
                  <View style={styles.priceTag}>
                    <Text style={styles.priceText}>₹{prod.price}</Text>
                    <Text style={styles.unitText}>per {prod.unit}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        )}

        {/* CUSTOM ANIMATED SIDEBAR */}
        <Sidebar 
          isSidebarOpen={isSidebarOpen} 
          toggleSidebar={toggleSidebar} 
          slideAnim={slideAnim} 
          user={user} 
          logout={logout} 
        />

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8f9fa' },
  container: { flex: 1, position: 'relative' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Search Bar
  searchContainer: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f2f6' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f4f6f8', borderRadius: 12, paddingHorizontal: 15, height: 45 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: '#2c3e50' },

  content: { padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 15 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: '#2c3e50', letterSpacing: 0.5 },
  seeAll: { fontSize: 14, color: '#27ae60', fontWeight: '700' },
  horizontalScroll: { paddingBottom: 10 },
  
  // Premium Property Card
  propertyCard: { backgroundColor: '#fff', borderRadius: 16, marginRight: 15, width: 220, elevation: 5, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, marginBottom: 10 },
  imagePlaceholder: { height: 130, backgroundColor: '#f1f2f6', borderTopLeftRadius: 16, borderTopRightRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  badge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, zIndex: 1 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  propertyInfo: { padding: 15 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#2c3e50', marginBottom: 4 },
  cardCity: { fontSize: 13, color: '#7f8c8d', marginBottom: 10, fontWeight: '500' },
  cardPrice: { fontSize: 18, fontWeight: '900', color: '#2c3e50' },
  priceSub: { fontSize: 12, fontWeight: '600', color: '#95a5a6' },
  
  // Premium Product Card
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  productIconBg: { width: 55, height: 55, borderRadius: 14, backgroundColor: '#eafaf1', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  productDetails: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '800', color: '#2c3e50', marginBottom: 4 },
  productSub: { fontSize: 13, color: '#7f8c8d', fontWeight: '500' },
  priceTag: { alignItems: 'flex-end', backgroundColor: '#f8f9fa', padding: 10, borderRadius: 10 },
  priceText: { fontSize: 18, fontWeight: '900', color: '#27ae60' },
  unitText: { fontSize: 12, color: '#7f8c8d', marginTop: 2, fontWeight: '600' },

  // Empty States
  emptyCard: { padding: 25, backgroundColor: '#fff', borderRadius: 16, alignItems: 'center', justifyContent: 'center', width: width - 40, borderWidth: 1, borderColor: '#f1f2f6', borderStyle: 'dashed' },
  emptyText: { color: '#95a5a6', fontSize: 15, fontWeight: '500' }
});