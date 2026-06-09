import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';

export default function DispatchSetupScreen({ route, navigation }: any) {
  // We pass these from the Negotiation detail screen
  const { negotiationId, quantity,shipmentId } = route.params;

  const [transportCost, setTransportCost] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!transportCost || !driverName || !vehicleNumber) {
      return Alert.alert("Missing Info", "Please fill out all required transport details.");
    }

    setLoading(true);
    try {
      await apiClient.post('/shipments/setup', {
        negotiationId,
        shipmentId,
        quantity,
        transportCost,
        driverName,
        driverPhone,
        vehicleNumber
      });
      Alert.alert("Success", shipmentId ? "Truck Dispatched!" : "Transport quote attached! Waiting for buyer payment.");
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Failed to setup dispatch.");
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={24} color="#2c3e50" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Arrange Transport</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Logistics Details</Text>
        
        <TextInput style={styles.input} placeholder="Transport Cost (₹)" keyboardType="numeric" value={transportCost} onChangeText={setTransportCost} />
        <TextInput style={styles.input} placeholder="Driver Name" value={driverName} onChangeText={setDriverName} />
        <TextInput style={styles.input} placeholder="Driver Phone Number" keyboardType="phone-pad" value={driverPhone} onChangeText={setDriverPhone} />
        <TextInput style={styles.input} placeholder="Vehicle Number (e.g. DL-1C-1234)" autoCapitalize="characters" value={vehicleNumber} onChangeText={setVehicleNumber} />

        <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Generate Freight Quote</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff', elevation: 2 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  content: { padding: 20 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#7f8c8d', marginBottom: 15 },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#ecf0f1', marginBottom: 15, fontSize: 16 },
  btn: { backgroundColor: '#3498db', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});