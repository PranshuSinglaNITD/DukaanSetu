import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, 
  SafeAreaView, Alert, FlatList, Platform
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
//@ts-ignore
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';

export default function LedgerPreviewScreen({ navigation }: any) {
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [summary, setSummary] = useState({ inflow: 0, outflow: 0, balance: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [pickerConfig, setPickerConfig] = useState<{show: boolean, mode: 'start' | 'end'}>({ show: false, mode: 'start' });

  const BACKEND_BASE_URL = 'http://192.168.1.8:3000/api/analytics/export'; 

  const formatDateString = (dateObj: Date) => {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const fetchPreviewData = async () => {
    setIsLoading(true);
    try {
      const token = await SecureStore.getItemAsync('userToken');
      let queryUrl = `${BACKEND_BASE_URL}/ledger-data`;
      if (startDate && endDate) {
        queryUrl += `?startDate=${formatDateString(startDate)}&endDate=${formatDateString(endDate)}`;
      }

      const response = await fetch(queryUrl, { headers: { Authorization: `Bearer ${token}` } });
      const json = await response.json();
      
      if (json.error === "Invalid or expired token." || response.status === 401) {
         Alert.alert("Session Expired", "Please log in again to continue.");
         await SecureStore.deleteItemAsync('userToken'); 
         navigation.replace('Login'); 
         return;
      }

      if (json.status === 'success') {
        setLedgerData(json.data);
        setSummary({ inflow: json.totalInflow, outflow: json.totalOutflow, balance: json.balance });
      } else {
         Alert.alert("Error", json.error || "Failed to load data.");
      }
      
    } catch (error) {
      console.error("Fetch Error:", error);
      Alert.alert("Network Error", "Could not connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if ((startDate && endDate) || (!startDate && !endDate)) {
      fetchPreviewData();
    }
  }, [startDate, endDate]);

  const onDateChange = (event: any, newDate?: Date) => {
    const currentMode = pickerConfig.mode;
    setPickerConfig({ ...pickerConfig, show: Platform.OS === 'ios' });
    
    if (newDate) {
      if (currentMode === 'start') {
        setStartDate(newDate);
        if (endDate && newDate > endDate) setEndDate(null);
      } else {
        setEndDate(newDate);
      }
    }
  };

  const saveFile = async (uri: string) => {
    try {
      await Sharing.shareAsync(uri, { 
        UTI: 'com.adobe.pdf', 
        mimeType: 'application/pdf', 
        dialogTitle: 'Export Ledger' 
      });
    } catch (error) {
      Alert.alert("Error", "Could not open the save dialog.");
    }
  };

  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);

      const token = await SecureStore.getItemAsync('userToken');
      const filename = `Ledger_${Date.now()}.pdf`;

      // Construct your backend URL
      let queryUrl = `${BACKEND_BASE_URL}/ledger-pdf`;
      if (startDate && endDate) {
        queryUrl += `?startDate=${formatDateString(startDate)}&endDate=${formatDateString(endDate)}`;
      }

      // Download using FileSystem (Exactly like the video)
      const result = await FileSystem.downloadAsync(
        queryUrl,
        (FileSystem as any).documentDirectory + filename,
        {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        }
      );

      console.log("Download Result:", result);

      // Pass the URI to the save function
      saveFile(result.uri);

    } catch (error) {
      console.error("Download Error: ", error);
      Alert.alert("Error", "Failed to download the PDF.");
    } finally {
      setIsDownloading(false);
    }
  };
  const renderTransaction = ({ item }: any) => {
    const isSale = item.type === 'SALE';
    // 🚨 KHATA STATUS: Read the payment status (fallback to PAID if missing)
    const pStatus = item.paymentStatus || 'PAID';
    
    return (
      <View style={styles.row}>
        <View style={styles.colLeft}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemMeta}>{new Date(item.date).toLocaleDateString()} • {item.qty} {item.unit}</Text>
        </View>
        <View style={styles.colRight}>
          
          {/* 🚨 NEW: Amount Row with Khata Badge */}
          <View style={styles.amountRow}>
            <Text style={[styles.khataBadge, pStatus === 'PAID' ? styles.textGreen : styles.textOrange]}>
              [{pStatus}]
            </Text>
            <Text style={[styles.amount, isSale ? styles.textGreen : styles.textRed]}>
              {isSale ? '+' : '-'}₹{item.total.toLocaleString('en-IN')}
            </Text>
          </View>

          <View style={[styles.badge, isSale ? styles.badgeGreen : styles.badgeRed]}>
            <Text style={[styles.badgeText, isSale ? styles.textGreen : styles.textRed]}>{item.type}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#1E3A8A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Master Ledger</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.dateRow}>
          <TouchableOpacity style={styles.dateBox} onPress={() => setPickerConfig({ show: true, mode: 'start' })}>
            <Text style={styles.dateLabel}>From Date</Text>
            <Text style={styles.dateValue}>{startDate ? startDate.toLocaleDateString() : 'Select'}</Text>
          </TouchableOpacity>
          <Ionicons name="arrow-forward" size={16} color="#94A3B8" />
          <TouchableOpacity 
            style={[styles.dateBox, !startDate && styles.dateBoxDisabled]} 
            onPress={() => setPickerConfig({ show: true, mode: 'end' })}
            disabled={!startDate}
          >
            <Text style={styles.dateLabel}>To Date</Text>
            <Text style={styles.dateValue}>{endDate ? endDate.toLocaleDateString() : 'Select'}</Text>
          </TouchableOpacity>
        </View>

        {(startDate || endDate) && (
          <TouchableOpacity style={styles.clearFiltersBtn} onPress={() => { setStartDate(null); setEndDate(null); }}>
            <Text style={styles.clearFiltersText}>Clear Range (Show All Time)</Text>
          </TouchableOpacity>
        )}
      </View>

      {pickerConfig.show && (
        <DateTimePicker
          value={pickerConfig.mode === 'start' ? (startDate || new Date()) : (endDate || new Date())}
          mode="date" display="default" onChange={onDateChange}
          minimumDate={pickerConfig.mode === 'end' && startDate ? startDate : undefined}
          maximumDate={new Date()} 
        />
      )}

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#1E3A8A" /></View>
      ) : (
        <>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Cash Inflow</Text>
              <Text style={[styles.summaryValue, styles.textGreen]}>₹{summary.inflow.toLocaleString('en-IN')}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Cash Outflow</Text>
              <Text style={[styles.summaryValue, styles.textRed]}>₹{summary.outflow.toLocaleString('en-IN')}</Text>
            </View>
          </View>

          <FlatList
            data={ledgerData}
            keyExtractor={(item) => item.id}
            renderItem={renderTransaction}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={<Text style={styles.emptyText}>No records found for this date range.</Text>}
          />

          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.exportBtn, isDownloading && styles.exportBtnDisabled]} 
              onPress={handleDownloadPDF} disabled={isDownloading}
            >
              {isDownloading ? <ActivityIndicator color="#FFF" /> : (
                <>
                  <MaterialIcons name="picture-as-pdf" size={20} color="#FFF" />
                  <Text style={styles.exportBtnText}>{(startDate && endDate) ? "Download Range PDF" : "Download Complete PDF"}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', height: 60, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1E3A8A' },
  filterContainer: { backgroundColor: '#EFF6FF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#DBEAFE' },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateBox: { backgroundColor: '#FFF', flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE', marginHorizontal: 8 },
  dateBoxDisabled: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0', opacity: 0.7 },
  dateLabel: { fontSize: 11, color: '#64748B', textTransform: 'uppercase', marginBottom: 4 },
  dateValue: { fontSize: 14, fontWeight: '600', color: '#1E3A8A' },
  clearFiltersBtn: { alignSelf: 'center', marginTop: 12 },
  clearFiltersText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryContainer: { flexDirection: 'row', padding: 16, justifyContent: 'space-between' },
  summaryCard: { backgroundColor: '#FFF', width: '48%', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  summaryLabel: { fontSize: 12, color: '#64748B', marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: 'bold' },
  textGreen: { color: '#059669' },
  textRed: { color: '#DC2626' },
  textOrange: { color: '#D97706' }, // 🚨 NEW: For Unpaid/Partial
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFF', padding: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, elevation: 1 },
  colLeft: { flex: 1 },
  colRight: { alignItems: 'flex-end' },
  itemName: { fontSize: 15, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  itemMeta: { fontSize: 12, color: '#64748B' },
  
  // 🚨 NEW: Amount Row Alignment
  amountRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  khataBadge: { fontSize: 10, fontWeight: '800', marginRight: 6 },
  amount: { fontSize: 15, fontWeight: 'bold' },
  
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeGreen: { backgroundColor: '#D1FAE5' },
  badgeRed: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 10, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#94A3B8' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: 'rgba(248,250,252,0.9)' },
  exportBtn: { backgroundColor: '#1E3A8A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, elevation: 3 },
  exportBtnDisabled: { backgroundColor: '#94A3B8' },
  exportBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600', marginLeft: 8 },
});