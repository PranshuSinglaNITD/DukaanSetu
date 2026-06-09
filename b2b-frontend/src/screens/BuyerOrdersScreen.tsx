import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native'; 
import apiClient from '../api/client';

export default function BuyerOrdersScreen({ navigation }: any) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    // Forces a fresh data fetch every time the user comes back to this screen
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
                {/* 🚨 THE SAFE BACK BUTTON */}
                <TouchableOpacity
                    onPress={() => {
                        if (navigation.canGoBack()) {
                            navigation.goBack();
                        } else {
                            // Fallback if opened directly from a sidebar
                            navigation.navigate('Landing'); 
                        }
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
                        
                        // Check if the order is delivered to easily control the button state
                        const isDelivered = order.status === 'DELIVERED';

                        return (
                            <View key={order.id} style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.productName}>
                                        {order.product?.name || 'Product'} ({order.quantity} KG)
                                    </Text>
                                    
                                    {/* Dynamic Status Badge */}
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
                                
                                <View style={styles.transportBox}>
                                     <Text style={styles.transportText}>Freight Cost: ₹{order.transportCost}</Text>
                                </View>

                                {/* 🚨 SIMPLIFIED TRACKING LOGIC */}
                                {order.status === 'PENDING' ? (
                                    <Text style={styles.waitingText}>⏳ Waiting for seller to dispatch truck...</Text>
                                ) : (
                                    /* The Button handles BOTH In_Transit and Delivered states */
                                    <TouchableOpacity 
                                        style={[
                                            styles.trackBtn, 
                                            isDelivered && styles.trackBtnDisabled // Add gray style if delivered
                                        ]} 
                                        disabled={isDelivered} // Physically blocks the click if delivered
                                        onPress={() => navigation.navigate('LiveTracking', { 
                                            shipmentId: order.id, 
                                            driverName: order.driverName, 
                                            vehicleNumber: order.vehicleNumber 
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
    content: { padding: 15 },
    card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    productName: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    sellerText: { color: '#7f8c8d', marginBottom: 10 },
    transportBox: { backgroundColor: '#f8f9fa', padding: 10, borderRadius: 6, marginBottom: 15 },
    transportText: { color: '#2c3e50', fontWeight: 'bold' },
    
    waitingText: { color: '#d35400', fontStyle: 'italic', textAlign: 'center', marginTop: 10, fontSize: 13 },
    
    // Standard Active Button
    trackBtn: { flexDirection: 'row', backgroundColor: '#27ae60', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    
    // Disabled Gray Button
    trackBtnDisabled: { backgroundColor: '#95a5a6' },
    
    btnTextWhite: { color: '#fff', fontWeight: 'bold' },
});