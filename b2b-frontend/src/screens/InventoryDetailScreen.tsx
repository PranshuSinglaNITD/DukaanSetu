import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';

export default function InventoryDetailScreen({ route, navigation }: any) {
  // Extract the item passed from the InventoryScreen
  const { item } = route.params;

  const [sellPrice, setSellPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [selling, setSelling] = useState(false);

  // 🤖 The AI Pricing Function
  const fetchSmartPrice = async () => {
    setAiLoading(true);
    try {
      const response = await apiClient.post('/inventory/smart-price', {
        name: item.name,
        category: item.category,
        buyPrice: item.buyPrice,
        unit: item.unit
      });
      
      const suggestion = response.data.data;
      setAiSuggestion(suggestion);
      setSellPrice(suggestion.suggestedPrice.toString()); // Auto-fill the price!
    } catch (error) {
      Alert.alert("AI Error", "MandiBrain is currently sleeping. Try again later.");
    }
    setAiLoading(false);
  };

  // 💰 The Sell Function
  const handleSell = async () => {
    if (!sellPrice || !quantity) return Alert.alert("Error", "Enter price and quantity");
    if (parseInt(quantity) > item.quantity) return Alert.alert("Error", "Not enough stock!");

    setSelling(true);
    try {
      await apiClient.post('/inventory/sell', {
        inventoryId: item.id,
        quantitySold: quantity,
        sellPrice: sellPrice
      });
      
      Alert.alert("Success!", "Sale recorded and profit calculated.");
      navigation.goBack(); // Go back to inventory list
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Failed to sell item");
    }
    setSelling(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={28} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{item.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        
        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Purchased At</Text>
            <Text style={styles.statValue}>₹{item.buyPrice}</Text>
            <Text style={styles.statSub}>per {item.unit}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Current Stock</Text>
            <Text style={[styles.statValue, { color: '#3498db' }]}>{item.quantity}</Text>
            <Text style={styles.statSub}>{item.unit} available</Text>
          </View>
        </View>

        {/* AI Action Button */}
        <TouchableOpacity style={styles.aiButton} onPress={fetchSmartPrice} disabled={aiLoading}>
          {aiLoading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="sparkles" size={20} color="#fff" style={{ marginRight: 10 }} />
              <Text style={styles.aiButtonText}>MandiBrain: Get Best Price</Text>
            </>
          )}
        </TouchableOpacity>

        {/* AI Result Banner */}
        {aiSuggestion && (
          <View style={styles.aiResultBox}>
            <Text style={styles.aiReasoning}>"{aiSuggestion.reasoning}"</Text>
            <View style={styles.marginPill}>
              <Text style={styles.marginText}>Expected Margin: {aiSuggestion.profitMarginPercent}%</Text>
            </View>
          </View>
        )}

        {/* Action Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Record a Sale</Text>
          
          <Text style={styles.inputLabel}>Selling Price (per {item.unit})</Text>
          <TextInput style={styles.input} placeholder="₹ 0.00" value={sellPrice} onChangeText={setSellPrice} keyboardType="numeric" />
          
          <Text style={styles.inputLabel}>Quantity Sold</Text>
          <TextInput style={styles.input} placeholder={`Max: ${item.quantity}`} value={quantity} onChangeText={setQuantity} keyboardType="numeric" />

          <TouchableOpacity style={styles.sellButton} onPress={handleSell} disabled={selling}>
            {selling ? <ActivityIndicator color="#fff" /> : <Text style={styles.sellText}>Confirm Sale</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#2c3e50' },
  content: { padding: 20 },
  
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { backgroundColor: '#fff', padding: 20, borderRadius: 16, flex: 1, marginHorizontal: 5, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  statLabel: { fontSize: 13, color: '#7f8c8d', marginBottom: 8, fontWeight: '600' },
  statValue: { fontSize: 24, fontWeight: '900', color: '#2c3e50' },
  statSub: { fontSize: 12, color: '#95a5a6', marginTop: 4 },

  aiButton: { flexDirection: 'row', backgroundColor: '#8e44ad', padding: 18, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 15, elevation: 4, shadowColor: '#8e44ad', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  aiButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  
  aiResultBox: { backgroundColor: '#fdf2e9', padding: 15, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#e67e22', marginBottom: 20 },
  aiReasoning: { fontSize: 14, color: '#2c3e50', fontStyle: 'italic', marginBottom: 10, lineHeight: 20 },
  marginPill: { alignSelf: 'flex-start', backgroundColor: '#e67e22', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  marginText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

  formCard: { backgroundColor: '#fff', padding: 20, borderRadius: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginBottom: 15 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#34495e', marginBottom: 8 },
  input: { backgroundColor: '#f8f9fa', padding: 15, borderRadius: 12, marginBottom: 20, fontSize: 16, borderWidth: 1, borderColor: '#ecf0f1' },
  sellButton: { backgroundColor: '#27ae60', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 5 },
  sellText: { color: '#fff', fontWeight: 'bold', fontSize: 18 }
});