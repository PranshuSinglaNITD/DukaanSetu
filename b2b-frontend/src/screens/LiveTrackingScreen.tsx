import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import io from 'socket.io-client';
import * as Location from 'expo-location';
import apiClient from '../api/client'; // Fixed import path to match standard Expo

// 🚨 WARNING: Use your exact computer IP address here!
const SOCKET_URL = 'http://192.168.1.8:3000'; 

export default function LiveTrackingScreen({ route, navigation }: any) {
  const { shipmentId, driverName, vehicleNumber } = route.params;

  // Default coordinates while waiting for GPS lock
  const [location, setLocation] = useState({
    latitude: 28.6139,
    longitude: 77.2090,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const [isConnected, setIsConnected] = useState(false);
  const [isDriving, setIsDriving] = useState(false);
  const socketRef = useRef<any>(null);
  const locationSubscription = useRef<any>(null);

  useEffect(() => {
    // 1. Connect to Node.js WebSocket Server
    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      // 2. Tell the server we want to watch THIS specific truck
      socket.emit('join_tracking', shipmentId);
    });

    // 3. Listen for live coordinate updates
    socket.on('location_changed', (newCoords) => {
      setLocation(prev => ({
        ...prev,
        latitude: newCoords.lat,
        longitude: newCoords.lng,
      }));
    });

    socket.on('disconnect', () => setIsConnected(false));

    // Cleanup when user leaves the screen
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
      socket.disconnect();
    };
  }, [shipmentId]);

  // 🚨 The Driver's Emitter Function (TESTING ONLY)
  const startDriving = async () => {
    setIsDriving(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      setIsDriving(false);
      return Alert.alert('Permission Denied', 'App needs location access to track the truck.');
    }

    Alert.alert("GPS Active", "Broadcasting live location to the buyer...");

    // Watch the phone's GPS and emit to the socket every time it moves
    locationSubscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
      (loc) => {
        const { latitude, longitude } = loc.coords;
        
        // Update local map instantly
        setLocation(prev => ({ ...prev, latitude, longitude }));
        
        // Broadcast to Node.js Server
        socketRef.current?.emit('driver_location_update', {
          shipmentId: shipmentId,
          lat: latitude,
          lng: longitude
        });
      }
    );
  };

  // 🚨 SECURITY: KILLS THE TRACKING AND CLOSES THE DEAL
  const handleConfirmDelivery = () => {
    Alert.alert(
      "Confirm Delivery",
      "Has the truck arrived and the goods have been received?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Delivered", 
          style: "destructive",
          onPress: async () => {
            try {
              // 1. Tell the backend to update the status to DELIVERED
              await apiClient.post('/shipments/delivered', { shipmentId });
              
              // 2. KILL THE GPS TRACKER (Saves battery!)
              if (locationSubscription.current) {
                locationSubscription.current.remove();
              }
              
              // 3. SEVER THE WEBSOCKET TUNNEL (Saves server memory!)
              if (socketRef.current) {
                socketRef.current.disconnect();
              }

              Alert.alert("Deal Concluded", "Delivery successful! Tracking has been securely disabled.");
              navigation.navigate('BuyerOrders'); // Kick them back to the orders list
            } catch (error: any) {
              Alert.alert("Error", error.response?.data?.error || "Could not confirm delivery.");
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Live Tracking</Text>
          <Text style={{ color: isConnected ? '#27ae60' : '#e74c3c', fontSize: 12, fontWeight: 'bold' }}>
            {isConnected ? '● LIVE CONNECTION' : '○ RECONNECTING...'}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <MapView 
        style={styles.map}
        region={location}
        showsUserLocation={true}
      >
        <Marker
          coordinate={{ latitude: location.latitude, longitude: location.longitude }}
          title={driverName || "Driver"}
          description={vehicleNumber}
        >
          <View style={styles.truckIcon}>
             <Ionicons name="bus" size={24} color="#fff" />
          </View>
        </Marker>
      </MapView>

      <View style={styles.infoCard}>
        <View style={{ marginBottom: 15 }}>
          <Text style={styles.driverText}>Driver: {driverName || 'Assigned Driver'}</Text>
          <Text style={styles.vehicleText}>Vehicle: {vehicleNumber}</Text>
        </View>
        
        {/* 🚨 TEST BUTTON */}
        <TouchableOpacity 
          style={[styles.driveBtn, isDriving && { backgroundColor: '#e74c3c' }, { marginBottom: 10 }]} 
          onPress={startDriving}
          disabled={isDriving}
        >
          <Ionicons name={isDriving ? "radio" : "play"} size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.btnTextWhite}>
            {isDriving ? "Broadcasting GPS..." : "Simulate Driving (Test)"}
          </Text>
        </TouchableOpacity>

        {/* 🚨 SECURITY BUTTON */}
        <TouchableOpacity 
          style={styles.deliveryBtn} 
          onPress={handleConfirmDelivery}
        >
          <Ionicons name="checkmark-done-circle" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.btnTextWhite}>Confirm Delivery & Stop Tracking</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, zIndex: 10, backgroundColor: '#fff', elevation: 5 },
  backBtn: { width: 40 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  map: { flex: 1 },
  truckIcon: { backgroundColor: '#2980b9', padding: 8, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },
  infoCard: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#fff', padding: 20, borderRadius: 15, elevation: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 },
  driverText: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  vehicleText: { fontSize: 14, color: '#7f8c8d', marginTop: 5 },
  driveBtn: { flexDirection: 'row', backgroundColor: '#27ae60', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  btnTextWhite: { color: '#fff', fontWeight: 'bold' },
  deliveryBtn: { flexDirection: 'row', backgroundColor: '#c0392b', padding: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }
});