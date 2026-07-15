import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native'; 
import apiClient from '../api/client';

export default function BuyerOrdersScreen({ navigation }: any) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            fetchOrders();
        }, [])
    );

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/shipments/my-orders');
            setOrders(response.data.data || []);
        } catch (error) {
            console.log("Fetch Orders Error", error);
        }
        setLoading(false);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => {
                        if (navigation.canGoBack()) navigation.goBack();
                        else navigation.navigate('Landing'); 
                    }}
                >
                    <Ionicons name="arrow-back" size={24} color="#2c3e50" />
                </TouchableOpacity>
                
                <Text style={styles.headerTitle}>My Purchases</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#27ae60" style={{ marginTop: 50 }} />
            ) : (
                <ScrollView style={styles.content}>
                    {orders.map((order: any) => {
                        const isDelivered = order.status === 'DELIVERED';
                        
                        // 🚨 NEW: Fallback logic in case the backend hasn't attached Khata data yet
                        const paymentStatus = order.paymentStatus || 'PAID'; 
                        const amountDue = order.amountDue || 0;

                        return (
                            <View key={order.id} style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.productName}>
                                        {order.product?.name || 'Product'} ({order.quantity} {order.product?.unit || 'KG'})
                                    </Text>
                                    
                                    {/* Logistics Status Badge */}
                                    <View style={[styles.badge, { 
                                        backgroundColor: order.status === 'PENDING' ? '#f39c12' : 
                                                         order.status === 'IN_TRANSIT' ? '#3498db' : '#27ae60' 
                                    }]}>
                                        <Text style={styles.badgeText}>{order.status}</Text>
                                    </View>
                                </View>
                                
                                <Text style={styles.sellerText}>
                                    Bought from: {order.seller?.businessName || order.seller?.name || 'Seller'}
                                </Text>

                                {/* 🚨 NEW: KHATA PAYMENT STATUS SECTION */}
                                <View style={styles.financeRow}>
                                    <View style={styles.financeCol}>
                                        <Text style={styles.financeLabel}>Payment Status</Text>
                                        {paymentStatus === 'PAID' ? (
                                            <Text style={styles.paidText}>✅ Fully Paid</Text>
                                        ) : (
                                            <Text style={styles.dueText}>⚠️ Udhaar (Due)</Text>
                                        )}
                                    </View>
                                    {amountDue > 0 && (
                                        <View style={styles.financeColRight}>
                                            <Text style={styles.financeLabel}>Pending Amount</Text>
                                            <Text style={styles.dueAmount}>₹{amountDue.toLocaleString('en-IN')}</Text>
                                        </View>
                                    )}
                                </View>
                                
                                <View style={styles.transportBox}>
                                     <Text style={styles.transportText}>Freight Cost: ₹{order.transportCost}</Text>
                                </View>

                                {order.status === 'PENDING' ? (
                                    <Text style={styles.waitingText}>⏳ Waiting for seller to dispatch truck...</Text>
                                ) : (
                                    <TouchableOpacity 
                                        style={[
                                            styles.trackBtn, 
                                            isDelivered && styles.trackBtnDisabled
                                        ]} 
                                        disabled={isDelivered}
                                        onPress={() => navigation.navigate('LiveTracking', { 
                                            shipmentId: order.id, 
                                            driverName: order.driverName, 
                                            vehicleNumber: order.vehicleNumber,
                                            sellerId:order.sellerId
                                        })}
                                    >
                                        <Ionicons 
                                            name={isDelivered ? "location-outline" : "location"} 
                                            size={18} 
                                            color="#fff" 
                                            style={{ marginRight: 8 }} 
                                        />
                                        <Text style={styles.btnTextWhite}>
                                            {isDelivered ? "Tracking Disabled (Delivered)" : "Track Live Location"}
                                        </Text>
                                    </TouchableOpacity>
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
    sellerText: { color: '#7f8c8d', marginBottom: 10 },
    
    // 🚨 NEW KHATA STYLES
    financeRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
    financeCol: { flex: 1 },
    financeColRight: { alignItems: 'flex-end' },
    financeLabel: { fontSize: 11, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 },
    paidText: { fontSize: 14, fontWeight: 'bold', color: '#16A34A' },
    dueText: { fontSize: 14, fontWeight: 'bold', color: '#D97706' },
    dueAmount: { fontSize: 15, fontWeight: 'bold', color: '#DC2626' },

    transportBox: { backgroundColor: '#f8f9fa', padding: 10, borderRadius: 6, marginBottom: 15 },
    transportText: { color: '#2c3e50', fontWeight: 'bold' },
    waitingText: { color: '#d35400', fontStyle: 'italic', textAlign: 'center', marginTop: 10, fontSize: 13 },
    trackBtn: { flexDirection: 'row', backgroundColor: '#27ae60', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    trackBtnDisabled: { backgroundColor: '#95a5a6' },
    btnTextWhite: { color: '#fff', fontWeight: 'bold' },
});