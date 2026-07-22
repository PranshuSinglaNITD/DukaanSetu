import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert, Modal, TextInput
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

export default function KhataScreen() {
  const [summary, setSummary] = useState({ toReceive: 0, toPay: 0, debtors: [] as any[], creditors: [] as any[] });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'GET' | 'GIVE'>('GET');

  // Modal State for collecting/paying money
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTransaction, setActiveTransaction] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const BACKEND_URL = 'http://192.168.1.8:3000/api/khata';

  const loadKhata = async () => {
    setIsLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${BACKEND_URL}/summary`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await response.json();

      if (json.status === 'success') {
        setSummary(json.data);
      }
    } catch (error) {
      Alert.alert("Error", "Could not load Khata data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadKhata(); }, []);

  const handleOpenPaymentModal = (item: any) => {
    setActiveTransaction(item);
    setPaymentAmount(item.amountDue.toString()); // Auto-fill with total due
    setModalVisible(true);
  };

  const submitInstallment = async () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      return Alert.alert("Invalid Amount", "Please enter a valid payment amount.");
    }
    if (parseFloat(paymentAmount) > activeTransaction.amountDue) {
      return Alert.alert("Error", "Payment cannot be greater than the pending due.");
    }

    setIsSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      
      // 🚨 UPDATED PAYLOAD: Dynamically pulling the type and seller ID from the item!
      const payload = {
        transactionId: activeTransaction.id,
        type: activeTransaction.type, // 'OFFLINE_SALE' or 'B2B_TRANSACTION'
        paymentAmount: parseFloat(paymentAmount),
        method: 'CASH', 
        targetSellerId: activeTransaction.targetSellerId || undefined
      };

      const response = await fetch(`${BACKEND_URL}/installment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await response.json();

      if (json.status === 'success') {
        Alert.alert("Success", "Payment recorded successfully!");
        setModalVisible(false);
        loadKhata(); // Refresh the dashboard
      } else {
        Alert.alert("Error", json.error);
      }
    } catch (error) {
      Alert.alert("Error", "Network connection failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTransaction = ({ item }: any) => {
    const isDebtor = activeTab === 'GET';
    
    // 🚨 MASSIVELY SIMPLIFIED: The backend already normalized this for us!
    const name = item.name;
    const date = new Date(item.date).toLocaleDateString('en-IN');
    const isB2B = item.type === 'B2B_TRANSACTION';

    return (
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.date}>{date}</Text>
        </View>
        <View style={styles.actionBlock}>
          <Text style={[styles.dueAmount, isDebtor ? styles.textGreen : styles.textRed]}>
            ₹{item.amountDue.toLocaleString('en-IN')}
          </Text>
          <TouchableOpacity
            style={[styles.payBtn, isDebtor ? styles.bgGreen : styles.bgRed]}
            onPress={() => handleOpenPaymentModal(item)}
          >
            <Text style={styles.payBtnText}>{isDebtor ? 'Receive' : 'Pay'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#1E3A8A" /></View>;

  return (
  <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Digital KhataBook</Text>
      <Text style={styles.headerTitle}>Manage your receivables and payables</Text>
    </View>

    {/* ─── Financial Dashboard ─── */}
    <View style={styles.dashboard}>
      <View style={[styles.card, styles.cardGreen]}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="arrow-bottom-left-thick" size={18} color="#059669" />
          <Text style={styles.cardLabel}>To Receive (₹)</Text>
        </View>
        <Text style={styles.cardAmountGreen}>
          {summary?.toReceive ? summary.toReceive.toLocaleString('en-IN') : '0'}
        </Text>
      </View>
      
      <View style={[styles.card, styles.cardRed]}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="arrow-top-right-thick" size={18} color="#dc2626" />
          <Text style={styles.cardLabel}>To Pay (₹)</Text>
        </View>
        <Text style={styles.cardAmountRed}>
          {summary?.toPay ? summary.toPay.toLocaleString('en-IN') : '0'}
        </Text>
      </View>
    </View>

    {/* ─── Toggle Tabs ─── */}
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'GET' && styles.activeTabGet]}
        onPress={() => setActiveTab('GET')}
      >
        <Text style={[styles.tabText, activeTab === 'GET' && styles.activeTabTextGet]}>
          Receivables (Get)
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.tab, activeTab === 'GIVE' && styles.activeTabGive]}
        onPress={() => setActiveTab('GIVE')}
      >
        <Text style={[styles.tabText, activeTab === 'GIVE' && styles.activeTabTextGive]}>
          Payables (Give)
        </Text>
      </TouchableOpacity>
    </View>

    {/* ─── Transaction List ─── */}
    <FlatList
      data={activeTab === 'GET' ? summary?.debtors : summary?.creditors}
      keyExtractor={(item) => item.id.toString()}
      renderItem={renderTransaction}
      contentContainerStyle={styles.listPadding}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="check-circle-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>
            No pending {activeTab === 'GET' ? 'receivables' : 'payables'}. You are all settled up!
          </Text>
        </View>
      }
    />

    {/* ─── Payment Entry Modal ─── */}
    <Modal visible={modalVisible} animationType="fade" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {activeTab === 'GET' ? 'Record Collection' : 'Record Payment'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close-circle" size={28} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <View style={styles.dueContainer}>
            <Text style={styles.dueLabel}>Total Pending</Text>
            <Text style={styles.dueAmount}>
              ₹{activeTransaction?.amountDue ? activeTransaction.amountDue.toLocaleString('en-IN') : '0'}
            </Text>
          </View>

          <Text style={styles.inputLabel}>Enter Amount (₹)</Text>
          <TextInput
            style={styles.modalInput}
            keyboardType="numeric"
            value={paymentAmount}
            onChangeText={setPaymentAmount}
            placeholder="0.00"
            placeholderTextColor="#94a3b8"
            autoFocus
          />

          <TouchableOpacity
            style={[styles.submitBtn, activeTab === 'GET' ? styles.bgGreen : styles.bgRed]}
            onPress={submitInstallment}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.submitBtnText}>
                {activeTab === 'GET' ? 'Confirm Receipt' : 'Confirm Payment'}
              </Text>
            )}
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  </SafeAreaView>
);
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dueContainer: {
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  dueLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dueAmount: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#E2E8F0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  dashboard: { flexDirection: 'row', padding: 16, gap: 12 },
  card: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1 },
  cardGreen: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  cardRed: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  cardLabel: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  cardAmountGreen: { fontSize: 22, fontWeight: 'bold', color: '#16A34A' },
  cardAmountRed: { fontSize: 22, fontWeight: 'bold', color: '#DC2626' },
  tabContainer: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: '#E2E8F0', borderRadius: 8, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  activeTabGet: { backgroundColor: '#FFF', shadowColor: '#000', elevation: 2 },
  activeTabGive: { backgroundColor: '#FFF', shadowColor: '#000', elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  activeTabTextGet: { color: '#16A34A' },
  activeTabTextGive: { color: '#DC2626' },
  listPadding: { paddingBottom: 100 },
  row: { flexDirection: 'row', backgroundColor: '#FFF', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, alignItems: 'center', elevation: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#475569' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  date: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  actionBlock: { alignItems: 'flex-end' },
  textGreen: { color: '#16A34A' },
  textRed: { color: '#DC2626' },
  payBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 6 },
  bgGreen: { backgroundColor: '#16A34A' },
  bgRed: { backgroundColor: '#DC2626' },
  payBtnText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 300 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  modalSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 24 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 8 },
  modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 16, fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 24 },
  submitBtn: { paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
});