import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, Modal, TextInput, Alert, RefreshControl, Platform
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/client';
import { AuthContext } from '../context/AuthContext';

// ─── Interfaces ────────────────────────────────────────────────────────────

interface Buyer {
  name: string;
  businessName: string | null;
  role: 'WHOLESALER' | 'RETAILER';
  phone: string;
}

interface DemandData {
  id: string;
  buyerId: string;
  cropName: string;
  region: string;
  status: string;
  createdAt: string;
  buyer: Buyer;
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function MandiPulseScreen() {
  // @ts-ignore
  const { user } = useContext(AuthContext);
  const role = user?.role || 'FARMER';
  const currentUserId = user?.userId || user?.id; // Depending on your JWT structure

  const [demands, setDemands] = useState<DemandData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    cropName: '',
  });

  // ─── Data Fetching ───────────────────────────────────────────────────────

  const fetchDemands = async () => {
    try {
      // 🚨 Upgraded to fetch the detailed list instead of just the pulse summary
      const res = await apiClient.get('/demands/list');
      if (res.data.status === 'success') {
        setDemands(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch demands list", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDemands();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDemands();
  };

  // ─── Actions ─────────────────────────────────────────────────────────────

  const handlePostDemand = async () => {
    if (!formData.cropName.trim()) {
      return Alert.alert("Error", "Please enter a valid crop name.");
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post('/demands/create', {
        cropName: formData.cropName.trim(),
        isCustomCrop: true 
      });

      if (res.status === 201 || res.status === 200) {
        Alert.alert("Broadcast Live", "Your procurement requirement has been distributed to sellers.");
        setModalVisible(false);
        setFormData({ cropName: '' });
        fetchDemands(); 
      }
    } catch (error: any) {
      const backendError = error.response?.data?.error || error.response?.data?.errors?.[0]?.issue || "Could not broadcast demand.";
      Alert.alert("Error", backendError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseDemand = (demandId: string) => {
    Alert.alert(
      "Mark as Fulfilled",
      "Are you sure you want to close this demand? It will be removed from the market pulse.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Yes, Close it", 
          style: "destructive",
          onPress: async () => {
            try {
              const res = await apiClient.put(`/demands/${demandId}/close`);
              if (res.data.status === 'success') {
                // Instantly remove it from the UI for a snappy feel
                setDemands(prev => prev.filter(d => d.id !== demandId));
              }
            } catch (error: any) {
              Alert.alert("Error", error.response?.data?.error || "Failed to close demand.");
            }
          }
        }
      ]
    );
  };

  // ─── Renderers ───────────────────────────────────────────────────────────

  const renderDemandCard = ({ item }: { item: DemandData }) => {
    const isMyDemand = item.buyerId === currentUserId;
    const isRetailer = item.buyer.role === 'RETAILER';
    const dateObj = new Date(item.createdAt);
    const dateString = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    return (
      <View style={styles.card}>
        {/* Card Header (Crop & Role Badge) */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cropName}>{item.cropName}</Text>
            <Text style={styles.dateText}>Posted {dateString}</Text>
          </View>
          
          <View style={[styles.roleBadge, { backgroundColor: isRetailer ? '#fee2e2' : '#dbeafe' }]}>
            <MaterialCommunityIcons 
              name={isRetailer ? "storefront-outline" : "warehouse"} 
              size={12} 
              color={isRetailer ? '#991b1b' : '#1e40af'} 
            />
            <Text style={[styles.roleBadgeText, { color: isRetailer ? '#991b1b' : '#1e40af' }]}>
              {item.buyer.role}
            </Text>
          </View>
        </View>

        {/* Buyer Info Row */}
        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="account-tie-outline" size={18} color="#64748b" />
          <Text style={styles.infoText}>
            {item.buyer.businessName || item.buyer.name}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <MaterialCommunityIcons name="map-marker-outline" size={18} color="#64748b" />
          <Text style={styles.infoText}>{item.region}</Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.cardActions}>
          {isMyDemand ? (
            <TouchableOpacity 
              style={[styles.actionBtn, styles.closeBtn]} 
              onPress={() => handleCloseDemand(item.id)}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#059669" />
              <Text style={styles.closeBtnText}>Mark as Fulfilled</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.actionBtn, styles.contactBtn]}>
              <Ionicons name="call-outline" size={16} color="#fff" />
              <Text style={styles.contactBtnText}>Contact Buyer</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Market Demands</Text>
        <Text style={styles.headerSubtitle}>Real-time procurement requests</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#059669" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={demands}
          keyExtractor={(item) => item.id}
          renderItem={renderDemandCard}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#059669"]} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="clipboard-text-off-outline" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>No active market demands tracked today.</Text>
            </View>
          }
        />
      )}

      {/* 🚨 FAB is HIDDEN for Farmers */}
      {role !== 'FARMER' && (
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>Broadcast Demand</Text>
        </TouchableOpacity>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Request Procurement</Text>
              <Text style={styles.modalSubtitle}>Signal local suppliers that you are actively buying.</Text>
            </View>

            <Text style={styles.inputLabel}>Commodity Needed</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Sharbati Wheat, Grade A Potatoes"
              placeholderTextColor="#94a3b8"
              value={formData.cropName}
              onChangeText={(text) => setFormData({ cropName: text })}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => { setModalVisible(false); setFormData({cropName: ''}); }}
                disabled={submitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.submitBtn} 
                onPress={handlePostDemand}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitBtnText}>Broadcast Live</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  
  header: { 
    padding: 20, paddingTop: Platform.OS === 'android' ? 50 : 60, 
    backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#f1f5f9' 
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  
  card: { 
    backgroundColor: '#fff', padding: 18, borderRadius: 16, marginBottom: 14, 
    borderWidth: 1, borderColor: '#f1f5f9',
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cropName: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  dateText: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '500' },
  
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  roleBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoText: { fontSize: 13, color: '#475569', fontWeight: '500', flex: 1 },
  
  cardActions: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderColor: '#f1f5f9' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10 },
  
  closeBtn: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  closeBtnText: { color: '#059669', fontSize: 13, fontWeight: '700' },
  
  contactBtn: { backgroundColor: '#0ea5e9' },
  contactBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 16, fontSize: 14, fontWeight: '500' },
  
  fab: { 
    position: 'absolute', bottom: 30, right: 24, 
    backgroundColor: '#059669', paddingVertical: 14, paddingHorizontal: 20, 
    borderRadius: 30, elevation: 6, shadowColor: '#059669', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    flexDirection: 'row', alignItems: 'center', gap: 8
  },
  fabText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#64748b', lineHeight: 18 },
  
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8 },
  input: { 
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', 
    borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 24, color: '#0f172a'
  },
  
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, backgroundColor: '#f1f5f9' },
  cancelBtnText: { color: '#475569', fontSize: 14, fontWeight: '700' },
  submitBtn: { backgroundColor: '#059669', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, minWidth: 140, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' }
});