import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';

export default function SellerSalesScreen({ navigation }: any) {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
    const unsubscribe = navigation.addListener('focus', fetchSales);
    return unsubscribe;
  }, [navigation]);

  const fetchSales = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/shipments/my-sales'); 
      setShipments(response.data.data || []);
    } catch (error) {
      console.log("Sales Error", error);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Sales & Dispatches</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#27ae60" style={{ marginTop: 50 }} />
      ) : (
        <ScrollView style={styles.content}>
          {shipments.map((shipment: any) => {
            
            // 🚨 KHATA STATUS: Fallback logic in case backend data is missing
            const paymentStatus = shipment.paymentStatus || 'PAID';
            const amountDue = shipment.amountDue || 0;

            return (
              <View key={shipment.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.productName}>
                    {shipment.product?.name || 'Product'} ({shipment.quantity} KG)
                  </Text>
                  <View style={[styles.badge, { backgroundColor: shipment.status === 'PENDING' ? '#f39c12' : '#27ae60' }]}>
                    <Text style={styles.badgeText}>{shipment.status}</Text>
                  </View>
                </View>
                
                <Text style={styles.buyerText}>Sold to: {shipment.buyer?.businessName || shipment.buyer?.name || 'Buyer'}</Text>

                {/* 🚨 NEW: KHATA PAYMENT STATUS SECTION */}
                <View style={styles.financeRow}>
                  <View style={styles.financeCol}>
                    <Text style={styles.financeLabel}>Payment Status</Text>
                    {paymentStatus === 'PAID' ? (
                      <Text style={styles.paidText}>✅ Fully Paid</Text>
                    ) : (
                      <Text style={styles.dueText}>⚠️ To Collect (Udhaar)</Text>
                    )}
                  </View>
                  {amountDue > 0 && (
                    <View style={styles.financeColRight}>
                      <Text style={styles.financeLabel}>Pending Amount</Text>
                      <Text style={styles.dueAmount}>₹{amountDue.toLocaleString('en-IN')}</Text>
                    </View>
                  )}
                </View>

                {shipment.status === 'PENDING' ? (
                  <TouchableOpacity 
                    style={styles.dispatchBtn} 
                    onPress={() => navigation.navigate('DispatchSetup', { shipmentId: shipment.id, quantity: shipment.quantity })}
                  >
                    <Ionicons name="bus" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.btnTextWhite}>Dispatch Truck</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.infoBox}>
                    <Text style={styles.driverText}>Driver: {shipment.driverName} ({shipment.vehicleNumber})</Text>
                    <Text style={styles.trackingText}>🟢 Live Tracking Active</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff', elevation: 2 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  content: { padding: 15, paddingBottom: 40 },
  card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  productName: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  buyerText: { color: '#7f8c8d', marginBottom: 10 },
  
  // 🚨 NEW KHATA STYLES
  financeRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 15 },
  financeCol: { flex: 1 },
  financeColRight: { alignItems: 'flex-end' },
  financeLabel: { fontSize: 11, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 },
  paidText: { fontSize: 14, fontWeight: 'bold', color: '#16A34A' },
  dueText: { fontSize: 14, fontWeight: 'bold', color: '#D97706' },
  dueAmount: { fontSize: 15, fontWeight: 'bold', color: '#DC2626' },

  dispatchBtn: { flexDirection: 'row', backgroundColor: '#34495e', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnTextWhite: { color: '#fff', fontWeight: 'bold' },
  infoBox: { backgroundColor: '#eafaf1', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#27ae60' },
  driverText: { color: '#2c3e50', fontWeight: 'bold' },
  trackingText: { color: '#27ae60', marginTop: 5, fontSize: 12, fontWeight: 'bold' }
});