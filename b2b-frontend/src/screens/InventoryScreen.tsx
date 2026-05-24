import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/client';

export default function InventoryScreen({ navigation }: any) {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
    // Refresh inventory whenever we come back to this screen
    const unsubscribe = navigation.addListener('focus', fetchInventory);
    return unsubscribe;
  }, [navigation]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/inventory');
      setInventory(response.data.data || []);
    } catch (error) {
      console.log("Error fetching inventory", error);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Warehouse</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#27ae60" /></View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {inventory.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={48} color="#bdc3c7" />
              <Text style={styles.emptyText}>Your inventory is completely empty.</Text>
            </View>
          ) : (
            inventory.map((item: any) => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.card} 
                activeOpacity={0.8}
                // 🚨 THIS IS THE MAGIC: It passes the item data to the Detail screen
                onPress={() => navigation.navigate('InventoryDetail', { item })}
              >
                <View style={styles.iconBg}>
                  <MaterialCommunityIcons name="store" size={28} color="#3498db" />
                </View>
                <View style={styles.details}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemSub}>Bought at ₹{item.buyPrice} / {item.unit}</Text>
                </View>
                <View style={styles.stockTag}>
                  <Text style={styles.stockText}>{item.quantity}</Text>
                  <Text style={styles.unitText}>{item.unit} left</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f2f6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#2c3e50' },
  content: { padding: 20 },
  
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 15, elevation: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  iconBg: { width: 55, height: 55, borderRadius: 14, backgroundColor: '#e8f4fd', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  details: { flex: 1 },
  itemName: { fontSize: 18, fontWeight: '800', color: '#2c3e50', marginBottom: 4 },
  itemSub: { fontSize: 13, color: '#7f8c8d', fontWeight: '500' },
  stockTag: { alignItems: 'flex-end', backgroundColor: '#f4f6f8', padding: 10, borderRadius: 10 },
  stockText: { fontSize: 20, fontWeight: '900', color: '#3498db' },
  unitText: { fontSize: 12, color: '#7f8c8d', marginTop: 2, fontWeight: '700' },

  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyText: { color: '#95a5a6', fontSize: 16, marginTop: 15, fontWeight: '500' }
});