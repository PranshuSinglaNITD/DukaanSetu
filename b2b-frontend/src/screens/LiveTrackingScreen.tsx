import React, { useEffect, useState, useRef } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, Alert, Platform, 
  Linking, Animated, Dimensions 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import io from 'socket.io-client';
import * as Location from 'expo-location';
import apiClient from '../api/client';

const { width } = Dimensions.get('window');
const SOCKET_URL = 'http://192.168.1.8:3000'; // 🚨 Update to your actual IP

// Haversine formula to calculate distance between two coordinates in KM
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default function LiveTrackingScreen({ route, navigation }: any) {
  // 🚨 Make sure driverPhone is passed in your navigation params!
  const { shipmentId, driverName, driverPhone, vehicleNumber, sellerId, sellerName } = route.params;

  const [location, setLocation] = useState({ latitude: 28.6139, longitude: 77.2090 });
  const [routeTrail, setRouteTrail] = useState<{latitude: number, longitude: number}[]>([]);
  
  // Mock Destination (Your Warehouse) - Defaulting to slightly offset from start
  const [destination] = useState({ latitude: 28.6300, longitude: 77.2200 });
  
  const [distanceRemaining, setDistanceRemaining] = useState("Calculating...");
  const [isConnected, setIsConnected] = useState(false);
  const [isDriving, setIsDriving] = useState(false);
  
  const socketRef = useRef<any>(null);
  const locationSubscription = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ─── 1. SOCKET & ANIMATION MOUNT ──────────────────────────────────────────
  useEffect(() => {
    // Pulse animation for the live dot
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      ])
    ).start();

    const socket = io(SOCKET_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_tracking', shipmentId);
    });

    socket.on('location_changed', (newCoords) => {
      setLocation({ latitude: newCoords.lat, longitude: newCoords.lng });
      // Add point to the trail to draw the Polyline snake
      setRouteTrail(prev => [...prev, { latitude: newCoords.lat, longitude: newCoords.lng }]);
      updateMetrics(newCoords.lat, newCoords.lng);
    });

    socket.on('disconnect', () => setIsConnected(false));

    return () => {
      if (locationSubscription.current) locationSubscription.current.remove();
      socket.disconnect();
    };
  }, [shipmentId]);

  // ─── 2. DYNAMIC ETA MATH ──────────────────────────────────────────────────
  const updateMetrics = (lat: number, lng: number) => {
    const dist = calculateDistance(lat, lng, destination.latitude, destination.longitude);
    if (dist < 0.5) {
      setDistanceRemaining("Arriving Now");
    } else {
      setDistanceRemaining(`${dist.toFixed(1)} km away`);
    }
  };

  // ─── 3. ACTIONS ───────────────────────────────────────────────────────────
  const startDriving = async () => {
    setIsDriving(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      setIsDriving(false);
      return Alert.alert('Permission Denied', 'App needs location access to track the truck.');
    }

    Alert.alert("GPS Active", "Broadcasting live location to the buyer...");

    // Get initial point to set as "Start"
    const initialLoc = await Location.getCurrentPositionAsync({});
    setRouteTrail([{ latitude: initialLoc.coords.latitude, longitude: initialLoc.coords.longitude }]);

    locationSubscription.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 5 },
      (loc) => {
        const { latitude, longitude } = loc.coords;
        setLocation({ latitude, longitude });
        setRouteTrail(prev => [...prev, { latitude, longitude }]);
        updateMetrics(latitude, longitude);
        
        socketRef.current?.emit('driver_location_update', { shipmentId, lat: latitude, lng: longitude });
      }
    );
  };

  const handleConfirmDelivery = () => {
    Alert.alert(
      "Confirm Arrival",
      "Are you sure the cargo has arrived and quality checks are complete?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Confirm Delivery", 
          style: "destructive",
          onPress: async () => {
            try {
              await apiClient.post('/shipments/delivered', { shipmentId });
              if (locationSubscription.current) locationSubscription.current.remove();
              if (socketRef.current) socketRef.current.disconnect();

              navigation.replace('ReviewForm', { 
                revieweeId: sellerId, 
                revieweeName: sellerName || 'the Seller'
              });
            } catch (error: any) {
              Alert.alert("Error", error.response?.data?.error || "Could not confirm delivery.");
            }
          }
        }
      ]
    );
  };

  const callDriver = () => {
    if (driverPhone) {
      Linking.openURL(`tel:${driverPhone}`);
    } else {
      Alert.alert("Not Available", "Driver phone number was not provided.");
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ─── Premium Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Active Transit</Text>
          <View style={styles.statusPill}>
            <Animated.View style={[styles.dot, { opacity: pulseAnim, backgroundColor: isConnected ? '#10b981' : '#ef4444' }]} />
            <Text style={styles.statusText}>
              {isConnected ? 'GPS SECURE' : 'RECONNECTING'}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={callDriver} style={styles.callHeaderBtn}>
          <Ionicons name="call" size={18} color="#0ea5e9" />
        </TouchableOpacity>
      </View>

      {/* ─── Map View ─── */}
      <MapView 
        style={styles.map} 
        region={{ ...location, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
      >
        {/* Draw the breadcrumb trail behind the truck */}
        {routeTrail.length > 0 && (
          <Polyline coordinates={routeTrail} strokeColor="#3b82f6" strokeWidth={4} lineDashPattern={[0]} />
        )}

        {/* The Truck */}
        <Marker coordinate={location} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={styles.truckMarker}>
             <MaterialCommunityIcons name="truck-fast" size={20} color="#fff" />
          </View>
        </Marker>

        {/* The Destination (Warehouse) */}
        <Marker coordinate={destination}>
          <View style={styles.warehouseMarker}>
             <MaterialCommunityIcons name="warehouse" size={20} color="#0f172a" />
          </View>
        </Marker>
      </MapView>

      {/* ─── Floating Dashboard Card ─── */}
      <View style={styles.infoCard}>
        
        {/* Dynamic Progress Bar */}
        <View style={styles.etaContainer}>
          <View>
            <Text style={styles.etaLabel}>ESTIMATED ARRIVAL</Text>
            <Text style={styles.etaText}>{distanceRemaining === "Arriving Now" ? "Imminent" : "In Transit"}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.etaLabel}>DISTANCE</Text>
            <Text style={styles.distanceText}>{distanceRemaining}</Text>
          </View>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: distanceRemaining === "Arriving Now" ? '100%' : '65%' }]} />
        </View>

        {/* Driver Info Profile */}
        <View style={styles.driverInfoRow}>
          <View style={styles.driverAvatar}>
            <Text style={styles.driverAvatarText}>{driverName ? driverName[0] : 'D'}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.driverText}>{driverName || 'Assigned Driver'}</Text>
            <Text style={styles.plateText}>{vehicleNumber || 'XX-00-0000'}</Text>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={callDriver}>
            <Ionicons name="call" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Test Broadcaster */}
        <TouchableOpacity 
          style={[styles.testBtn, isDriving && styles.testBtnActive]} 
          onPress={startDriving} disabled={isDriving}
        >
          <Ionicons name={isDriving ? "radio" : "play"} size={16} color={isDriving ? "#10b981" : "#64748b"} />
          <Text style={[styles.testBtnText, isDriving && { color: '#10b981' }]}>
            {isDriving ? "GPS Active - Drive Around to see the trail!" : "Simulate Driving (Test)"}
          </Text>
        </TouchableOpacity>

        {/* Security Killswitch */}
        <TouchableOpacity style={styles.deliveryBtn} onPress={handleConfirmDelivery}>
          <Ionicons name="shield-checkmark" size={20} color="#fff" />
          <Text style={styles.btnTextWhite}>Verify Delivery & Secure Funds</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0', zIndex: 10 },
  backBtn: { width: 40 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', letterSpacing: -0.5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  statusText: { fontSize: 10, fontWeight: '700', color: '#475569', letterSpacing: 0.5 },
  callHeaderBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center' },
  
  map: { flex: 1 },
  truckMarker: { backgroundColor: '#3b82f6', padding: 8, borderRadius: 20, borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  warehouseMarker: { backgroundColor: '#fff', padding: 8, borderRadius: 20, borderWidth: 3, borderColor: '#0f172a', elevation: 5 },
  
  infoCard: { position: 'absolute', bottom: Platform.OS === 'ios' ? 40 : 20, left: 16, right: 16, backgroundColor: '#fff', padding: 20, borderRadius: 24, shadowColor: '#0f172a', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 15 },
  
  etaContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  etaLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5 },
  etaText: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 2 },
  distanceText: { fontSize: 16, fontWeight: '700', color: '#3b82f6', marginTop: 4 },
  
  progressTrack: { height: 6, backgroundColor: '#f1f5f9', borderRadius: 3, marginBottom: 20, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 3 },

  driverInfoRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 12, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  driverAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
  driverAvatarText: { fontSize: 20, fontWeight: '800', color: '#64748b' },
  driverText: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  plateText: { fontSize: 13, fontWeight: '600', color: '#64748b', marginTop: 2 },
  callBtn: { backgroundColor: '#0ea5e9', width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', elevation: 3 },
  
  testBtn: { flexDirection: 'row', backgroundColor: '#fff', padding: 14, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 8 },
  testBtnActive: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  testBtnText: { color: '#64748b', fontWeight: '700', fontSize: 13 },
  
  deliveryBtn: { flexDirection: 'row', backgroundColor: '#0f172a', padding: 18, borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 10 },
  btnTextWhite: { color: '#fff', fontWeight: '800', fontSize: 15 },
});