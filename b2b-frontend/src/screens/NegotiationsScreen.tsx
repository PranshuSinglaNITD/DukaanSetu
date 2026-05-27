import React, { useState, useEffect, useContext } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/client';

export default function NegotiationsScreen({ navigation }: any) {
  // @ts-ignore
  const { user } = useContext(AuthContext);
  const currentUserId = user?.id || user?.userId;

  const [negotiations, setNegotiations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInbox();
    const unsubscribe = navigation.addListener('focus', fetchInbox);
    return unsubscribe;
  }, [navigation]);

  const fetchInbox = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/negotiation/inbox');
      setNegotiations(response.data.data || []);
    } catch (error) {
      console.log("Inbox Error", error);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    if (status === 'ACCEPTED') return '#27ae60';
    if (status === 'REJECTED') return '#e74c3c';
    return '#f39c12'; // ACTIVE
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Negotiations Inbox</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#27ae60" /></View>
      ) : (
        <ScrollView style={styles.content}>
          {negotiations.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="chatbubbles-outline" size={48} color="#bdc3c7" />
              <Text style={styles.emptyText}>You have no active negotiations.</Text>
            </View>
          ) : (
            negotiations.map((neg: any) => {
              const isBuyer = neg.buyerId === currentUserId;
              const otherParty = isBuyer ? neg.seller : neg.buyer;
              const latestOffer = neg.offers[0];

              return (
                <TouchableOpacity 
                  key={neg.id} 
                  style={styles.card}
                  onPress={() => navigation.navigate('NegotiationDetail', { negotiationId: neg.id })}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.productName}>{neg.product.name} ({neg.quantity} units)</Text>
                    <View style={[styles.badge, { backgroundColor: getStatusColor(neg.status) }]}>
                      <Text style={styles.badgeText}>{neg.status}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.partyText}>{isBuyer ? 'Selling by:' : 'Buying by:'} {otherParty.name}</Text>
                  
                  {latestOffer && (
                    <View style={styles.latestOfferBox}>
                      <Text style={styles.offerLabel}>Latest Offer:</Text>
                      <Text style={styles.offerPrice}>₹{latestOffer.price}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
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
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 15, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  productName: { fontSize: 16, fontWeight: '800', color: '#2c3e50' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  partyText: { fontSize: 13, color: '#7f8c8d', marginBottom: 10 },
  latestOfferBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f4f6f8', padding: 10, borderRadius: 8 },
  offerLabel: { fontSize: 13, color: '#7f8c8d', marginRight: 6 },
  offerPrice: { fontSize: 16, fontWeight: '900', color: '#2c3e50' },
  emptyCard: { padding: 40, alignItems: 'center', justifyContent: 'center', marginTop: 50 },
  emptyText: { color: '#95a5a6', fontSize: 16, marginTop: 15 }
});