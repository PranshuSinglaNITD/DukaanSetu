import React, { useState, useEffect, useContext, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/client';

export default function NegotiationDetailScreen({ route, navigation }: any) {
  const { negotiationId } = route.params;
  
  // @ts-ignore
  const { user } = useContext(AuthContext);
  const currentUserId = user?.id || user?.userId;
  const scrollViewRef = useRef<ScrollView>(null);

  const [thread, setThread] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  const [showCounterBox, setShowCounterBox] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterMessage, setCounterMessage] = useState('');

  useEffect(() => {
    fetchThread();
  }, []);

  const fetchThread = async () => {
    try {
      const response = await apiClient.get(`/negotiation/${negotiationId}`);
      setThread(response.data.data);
    } catch (error) {
      Alert.alert("Error", "Could not load thread");
      navigation.goBack();
    }
    setLoading(false);
  };

  const handleResolve = async (action: 'ACCEPTED' | 'REJECTED') => {
    setActionLoading(true);
    try {
      await apiClient.post('/negotiation/resolve', { negotiationId, action });
      Alert.alert(action === 'ACCEPTED' ? "Deal Accepted!" : "Deal Rejected", "Status updated successfully.");
      fetchThread(); 
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Failed to update status");
    }
    setActionLoading(false);
  };

  const handleSendCounter = async () => {
    if (!counterPrice) return Alert.alert("Error", "Enter a counter price");
    setActionLoading(true);
    try {
      await apiClient.post('/negotiation/offer', { negotiationId, price: counterPrice, message: counterMessage });
      setCounterPrice('');
      setCounterMessage('');
      setShowCounterBox(false);
      fetchThread(); 
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Failed to send offer");
    }
    setActionLoading(false);
  };

  const handleCheckout = () => {
    navigation.navigate('ProductDetail', { 
      product: thread.product, 
      negotiatedPrice: finalPrice, // The discounted price
      negotiationId: thread.id     // Pass the ID so the backend knows to apply the discount
    });
  };

  if (loading || !thread) return <View style={styles.center}><ActivityIndicator size="large" color="#27ae60" /></View>;

  // 🚨 UI State Variables
  const isActive = thread.status === 'ACTIVE';
  const isAccepted = thread.status === 'ACCEPTED';
  const isCompleted = thread.status === 'COMPLETED'; // <-- The new completed check
  const isBuyer = thread.buyerId === currentUserId;
  
  const latestOffer = thread.offers[thread.offers.length - 1];
  const finalPrice = latestOffer?.price || thread.product.price;
  const totalAmount = finalPrice * thread.quantity;

  const isMyTurn = latestOffer?.senderId !== currentUserId;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{thread.product.name}</Text>
          <Text style={styles.headerSub}>{thread.quantity} {thread.product.unit} • {thread.status}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView 
          style={styles.chatContainer} 
          ref={scrollViewRef}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {thread.offers.map((offer: any) => {
            const isMe = offer.senderId === currentUserId;
            return (
              <View key={offer.id} style={[styles.messageWrapper, isMe ? styles.messageMe : styles.messageThem]}>
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={[styles.bubblePrice, isMe ? styles.textWhite : styles.textDark]}>₹{offer.price}</Text>
                  {offer.message ? <Text style={[styles.bubbleMsg, isMe ? styles.textWhite : styles.textDark]}>{offer.message}</Text> : null}
                </View>
                <Text style={styles.timestamp}>{new Date(offer.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
              </View>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>

        {/* 🚨 DYNAMIC BOTTOM BARS */}

        {/* 1. ACTIVE DEAL: Show Accept/Reject/Counter options */}
        {/* 1A. ACTIVE DEAL (YOUR TURN): Show Accept/Reject/Counter options */}
        {isActive && isMyTurn && !showCounterBox && (
          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.actionBtnReject} onPress={() => handleResolve('REJECTED')}>
              <Text style={styles.btnTextWhite}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnCounter} onPress={() => setShowCounterBox(true)}>
              <Text style={styles.btnTextWhite}>Counter</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtnAccept} onPress={() => handleResolve('ACCEPTED')}>
              <Text style={styles.btnTextWhite}>Accept</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 1B. ACTIVE DEAL (WAITING FOR THEM): You just sent an offer */}
        {isActive && !isMyTurn && (
          <View style={[styles.waitingContainer, { backgroundColor: '#e8f4fd', borderColor: '#d6eaf8' }]}>
            <Ionicons name="paper-plane" size={24} color="#3498db" />
            <Text style={[styles.waitingText, { color: '#2980b9' }]}>Offer sent! Waiting for their response.</Text>
          </View>
        )}

        {/* 2. ACCEPTED DEAL (BUYER VIEW): Show Payment Button */}
        {isAccepted && isBuyer && (
          <View style={styles.checkoutContainer}>
             <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
                 <Ionicons name="cart" size={20} color="#fff" style={{ marginRight: 8 }} />
                 <Text style={styles.btnTextWhite}>Proceed to Buy (₹{finalPrice}/unit)</Text>
             </TouchableOpacity>
          </View>
        )}

        {/* 3. ACCEPTED DEAL (SELLER VIEW): Show Waiting Status */}
        {isAccepted && !isBuyer && (
          <View style={styles.waitingContainer}>
            <Ionicons name="time" size={24} color="#f39c12" />
            <Text style={styles.waitingText}>Deal secured! Awaiting buyer payment.</Text>
          </View>
        )}

        {/* 4. COMPLETED DEAL: Show Success Message */}
        {isCompleted && (
          <View style={styles.completedContainer}>
            <Ionicons name="checkmark-circle" size={24} color="#27ae60" />
            <Text style={styles.completedText}>Deal Completed! Items are in the warehouse.</Text>
          </View>
        )}

        {/* COUNTER OFFER INPUT BOX */}
        {isActive && showCounterBox && (
          <View style={styles.counterBox}>
            <View style={styles.counterHeader}>
              <Text style={styles.counterTitle}>Send Counter Offer</Text>
              <TouchableOpacity onPress={() => setShowCounterBox(false)}><Ionicons name="close" size={24} color="#7f8c8d" /></TouchableOpacity>
            </View>
            <TextInput style={styles.input} placeholder={`Price per ${thread.product.unit}`} keyboardType="numeric" value={counterPrice} onChangeText={setCounterPrice} />
            <TextInput style={styles.input} placeholder="Message (Optional)" value={counterMessage} onChangeText={setCounterMessage} />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendCounter} disabled={actionLoading}>
              {actionLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTextWhite}>Send Offer</Text>}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 15, backgroundColor: '#fff', elevation: 2 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#2c3e50' },
  headerSub: { fontSize: 12, color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase' },
  chatContainer: { flex: 1, padding: 15 },
  
  messageWrapper: { marginBottom: 15, maxWidth: '80%' },
  messageMe: { alignSelf: 'flex-end' },
  messageThem: { alignSelf: 'flex-start' },
  bubble: { padding: 15, borderRadius: 16 },
  bubbleMe: { backgroundColor: '#3498db', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#ecf0f1' },
  bubblePrice: { fontSize: 20, fontWeight: '900', marginBottom: 4 },
  bubbleMsg: { fontSize: 14 },
  textWhite: { color: '#fff' },
  textDark: { color: '#2c3e50' },
  timestamp: { fontSize: 10, color: '#95a5a6', marginTop: 4, alignSelf: 'flex-end' },

  actionBar: { flexDirection: 'row', padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#ecf0f1', gap: 10 },
  actionBtnReject: { flex: 1, backgroundColor: '#e74c3c', padding: 15, borderRadius: 10, alignItems: 'center' },
  actionBtnCounter: { flex: 1, backgroundColor: '#f39c12', padding: 15, borderRadius: 10, alignItems: 'center' },
  actionBtnAccept: { flex: 1, backgroundColor: '#27ae60', padding: 15, borderRadius: 10, alignItems: 'center' },
  btnTextWhite: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  checkoutContainer: { padding: 15, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#ecf0f1' },
  checkoutBtn: { flexDirection: 'row', backgroundColor: '#27ae60', padding: 18, borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  
  waitingContainer: { flexDirection: 'row', backgroundColor: '#fdf2e9', padding: 20, justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderColor: '#ecf0f1' },
  waitingText: { color: '#d35400', fontWeight: 'bold', fontSize: 15, marginLeft: 10 },

  // 🚨 New Completed State Style
  completedContainer: { flexDirection: 'row', backgroundColor: '#eafaf1', padding: 20, justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderColor: '#ecf0f1' },
  completedText: { color: '#27ae60', fontWeight: 'bold', fontSize: 15, marginLeft: 10 },

  counterBox: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 10 },
  counterHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  counterTitle: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' },
  input: { backgroundColor: '#f8f9fa', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#ecf0f1', marginBottom: 10, fontSize: 16 },
  sendBtn: { backgroundColor: '#3498db', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 5 }
});