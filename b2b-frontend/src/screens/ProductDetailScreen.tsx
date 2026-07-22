import React, { useState, useContext } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api/client';

export default function ProductDetailScreen({ route, navigation }: any) {
  const { product, negotiatedPrice, negotiationId } = route.params;
  const displayPrice = negotiatedPrice ? negotiatedPrice : product.price;
  
  // @ts-ignore
  const { user } = useContext(AuthContext);
  const currentUserId = user?.id || user?.userId;

  const [quantity, setQuantity] = useState('1');
  const [amountPaid, setAmountPaid] = useState(''); 
  const [paymentMethod, setPaymentMethod] = useState('UPI'); 
  
  // Loading States
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false); // 🚨 NEW: For chat init
  
  // Negotiation Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerMessage, setOfferMessage] = useState('');

  const isMyOwnProduct = product.sellerId === currentUserId;

  const currentQty = parseInt(quantity, 10) || 0;
  const totalCost = displayPrice * currentQty;
  const currentPaid = amountPaid === '' ? totalCost : (parseFloat(amountPaid) || 0);
  const remainingDue = totalCost - currentPaid;

  // ==========================================
  // 1. DIRECT BUY FLOW
  // ==========================================
  const handleDirectBuy = async () => {
    const qty = parseInt(quantity, 10);
    if (!quantity || qty <= 0 || isNaN(qty)) return Alert.alert("Invalid Quantity", "Please specify a valid numeric volume.");
    if (qty > product.stock) return Alert.alert("Out of Supply", `The seller only has ${product.stock} ${product.unit} available.`);

    const finalPaidAmount = amountPaid === '' ? totalCost : parseFloat(amountPaid);
    if (isNaN(finalPaidAmount) || finalPaidAmount < 0) return Alert.alert("Invalid Payment", "Please specify a valid amount paid.");
    if (finalPaidAmount > totalCost) return Alert.alert("Invalid Payment", "Amount paid cannot exceed total bill.");

    const confirmationMsg = finalPaidAmount === totalCost 
      ? `Buy ${qty} ${product.unit} of ${product.name} for ₹${totalCost}?`
      : `Buy ${qty} ${product.unit} of ${product.name}?\n\nTotal: ₹${totalCost}\nPaid Now: ₹${finalPaidAmount}\nRemaining Udhaar: ₹${totalCost - finalPaidAmount}`;

    Alert.alert(
      "Confirm Purchase",
      confirmationMsg,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Buy",
          onPress: async () => {
            setLoading(true);
            try {
              await apiClient.post('/products/buy', { 
                productId: product.id, 
                quantity: qty,
                negotiationId: negotiationId,
                amountPaid: finalPaidAmount,
                paymentMethod: paymentMethod
              });
              Alert.alert("Deal Settled!", "Transaction finalized and ledger documented.");
              navigation.navigate('Landing');
            } catch (error: any) {
              Alert.alert("Transaction Failed", error.response?.data?.error || "Error executing checkout.");
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // ==========================================
  // 2. NEGOTIATION FLOW
  // ==========================================
  const handleStartNegotiation = async () => {
    if (!offerPrice || isNaN(parseFloat(offerPrice)) || parseFloat(offerPrice) <= 0) {
      return Alert.alert("Invalid Offer", "Please input a valid price proposal.");
    }

    setLoading(true);
    try {
      await apiClient.post('/negotiations/start', {
        sellerId: product.sellerId,
        productId: product.id,
        offerPrice: offerPrice,
        message: offerMessage || `Hi, I want to buy ${quantity} ${product.unit} of ${product.name}. Can we negotiate?`
      });

      Alert.alert(
        "Offer Transmitted", 
        "Negotiation thread created! Check your inbox to manage this deal.",
        [{ text: "OK", onPress: () => { setModalVisible(false); navigation.navigate('Landing'); } }]
      );
    } catch (error: any) {
      Alert.alert("Failed", error.response?.data?.error || "Error transmitting negotiation.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // 3. 🚨 NEW: CHAT FLOW
  // ==========================================
  const handleMessageSeller = async () => {
    setChatLoading(true);
    try {
      // Hit the chat controller to get or create the room
      const response = await apiClient.post('/chat/room', {
        sellerId: product.sellerId,
        productId: product.id
      });
      
      const room = response.data.data;
      
      // Route to the new ChatScreen with the required params
      navigation.navigate('ChatScreen', {
        roomId: room.id,
        currentUserId: currentUserId
      });
    } catch (error: any) {
      Alert.alert("Chat Error", error.response?.data?.error || "Failed to initialize secure chat.");
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Product Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        {product.images && product.images.length > 0 ? (
          <Image source={{ uri: `http://192.168.1.5:3000${product.images[0]}` }} style={styles.bannerImage} />
        ) : (
          <View style={styles.fallbackBanner}>
            <MaterialCommunityIcons name="sack" size={64} color="#bdc3c7" />
          </View>
        )}

        <View style={styles.contentContainer}>
          <View style={styles.rowJustify}>
            <Text style={styles.productName}>{product.name}</Text>
            <View style={styles.categoryBadge}><Text style={styles.categoryText}>{product.category}</Text></View>
          </View>

          <View style={styles.mandiTag}>
            <Ionicons name="location" size={16} color="#e67e22" style={{ marginRight: 4 }} />
            <Text style={styles.mandiText}>Sourced from: <Text style={{fontWeight: '700'}}>{product.mandiName || "Local Mandi Hub"}</Text></Text>
          </View>

          <View style={styles.divider} />

          {/* Pricing & Stock */}
          <View style={styles.metricsBox}>
            <View>
              <Text style={[styles.metricLabel, negotiatedPrice && { color: '#27ae60' }]}>
                {negotiatedPrice ? "Your Negotiated Price" : "Mandi Base Price"}
              </Text>
              <Text style={styles.metricPrice}>₹{displayPrice}<Text style={styles.unitLabel}> / {product.unit}</Text></Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.metricLabel}>Total Batch Stock</Text>
              <Text style={styles.metricStock}>{product.stock} {product.unit}</Text>
            </View>
          </View>

          {/* 🚨 UPDATED: Seller Profile with Chat Button */}
          <Text style={styles.sectionTitle}>Seller Profile</Text>
          <View style={styles.sellerCard}>
            <View style={styles.avatarFrame}>
              <Text style={styles.avatarLetter}>{product.seller?.name?.charAt(0).toUpperCase() || 'V'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName}>{product.seller?.name || "Verified Local Merchant"}</Text>
              <Text style={styles.sellerBusiness}>{product.seller?.businessName || "Independent Farmer"}</Text>
              <Text style={styles.sellerContact}>📞 {product.seller?.phone || "Contact Hidden"}</Text>
            </View>
            
            {/* The Message Button */}
            {!isMyOwnProduct && (
              <TouchableOpacity 
                style={styles.chatIconButton} 
                onPress={handleMessageSeller} 
                disabled={chatLoading}
              >
                {chatLoading ? (
                  <ActivityIndicator color="#3498db" size="small" />
                ) : (
                  <>
                    <Ionicons name="chatbubble-ellipses" size={24} color="#3498db" />
                    <Text style={styles.chatIconText}>Message</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Order Configuration */}
          <Text style={styles.sectionTitle}>Configure Order Volume</Text>
          <View style={styles.quantityInputWrapper}>
            <TextInput 
              style={styles.quantityInput} keyboardType="numeric" value={quantity} onChangeText={setQuantity}
              placeholder={`Available weight in ${product.unit}...`}
            />
            <Text style={styles.inputUnitAppend}>{product.unit}</Text>
          </View>

          {/* Khata Payment Arrangement Section */}
          {!isMyOwnProduct && (
            <View style={styles.khataContainer}>
              <Text style={styles.sectionTitle}>Khata Credit Arrangement</Text>
              
              <View style={styles.billBreakdown}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Total Bill Amount:</Text>
                  <Text style={styles.breakdownValue}>₹{totalCost.toLocaleString('en-IN')}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Remaining Balance Due (Udhaar):</Text>
                  <Text style={[styles.breakdownValue, remainingDue > 0 ? styles.textRed : styles.textGreen]}>
                    ₹{remainingDue < 0 ? 0 : remainingDue.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>

              <Text style={styles.inputSubLabel}>Advance Cash/UPI Paid Upfront (Optional)</Text>
              <View style={styles.quantityInputWrapper}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput 
                  style={styles.quantityInput} 
                  keyboardType="numeric" 
                  value={amountPaid} 
                  onChangeText={setAmountPaid}
                  placeholder={`Leave blank if paying full amount ₹${totalCost}...`}
                />
              </View>

              <Text style={[styles.inputSubLabel, { marginTop: 12 }]}>Payment Channel</Text>
              <View style={styles.methodToggleRow}>
                {['UPI', 'CASH', 'PLATFORM_CREDIT'].map((method) => (
                  <TouchableOpacity 
                    key={method} 
                    style={[styles.methodTab, paymentMethod === method && styles.activeMethodTab]}
                    onPress={() => setPaymentMethod(method)}
                  >
                    <Text style={[styles.methodTabText, paymentMethod === method && styles.activeMethodTabText]}>
                      {method.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Call to Action Buttons */}
          {isMyOwnProduct ? (
            <View style={styles.ownProductWarning}>
              <Ionicons name="information-circle" size={24} color="#3498db" />
              <Text style={styles.ownProductText}>This is your own listing.</Text>
            </View>
          ) : (
            <View style={styles.ctaGrid}>
              {!negotiationId && (
                <TouchableOpacity style={styles.negotiateButton} onPress={() => setModalVisible(true)}>
                  <MaterialCommunityIcons name="handshake" size={22} color="#e67e22" style={{ marginRight: 8 }} />
                  <Text style={styles.negotiateButtonText}>Make Offer</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.buyButton} onPress={handleDirectBuy} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="cart" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.buyButtonText}>Buy Now</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* MODAL FOR NEGOTIATIONS */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Start Negotiation</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={28} color="#95a5a6" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Your Target Price (per {product.unit})</Text>
              <View style={styles.priceInputRow}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput style={styles.modalPriceInput} keyboardType="numeric" placeholder={`Current price is ₹${product.price}`} value={offerPrice} onChangeText={setOfferPrice} />
              </View>

              <Text style={styles.modalLabel}>Message to Seller (Optional)</Text>
              <ScrollView style={{maxHeight: 120}} keyboardShouldPersistTaps="handled">
                <TextInput style={styles.modalMessageInput} multiline={true} numberOfLines={4} placeholder="I want to buy in bulk, can we agree on this price?" value={offerMessage} onChangeText={setOfferMessage} />
              </ScrollView>

              <TouchableOpacity style={styles.transmitOfferBtn} onPress={handleStartNegotiation} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.transmitOfferBtnText}>Send Counter Offer</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f2f6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#2c3e50' },
  scrollContainer: { flex: 1 },
  bannerImage: { width: '100%', height: 240, resizeMode: 'cover' },
  fallbackBanner: { width: '100%', height: 200, backgroundColor: '#eaeded', justifyContent: 'center', alignItems: 'center' },
  contentContainer: { padding: 20, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20, minHeight: 600 },
  rowJustify: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { fontSize: 24, fontWeight: '900', color: '#2c3e50', flex: 1, marginRight: 10 },
  categoryBadge: { backgroundColor: '#eafaf1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  categoryText: { color: '#27ae60', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  mandiTag: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  mandiText: { fontSize: 14, color: '#7f8c8d', fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#f1f2f6', marginVertical: 18 },
  metricsBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f4f6f8', padding: 18, borderRadius: 16 },
  metricLabel: { fontSize: 12, color: '#7f8c8d', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  metricPrice: { fontSize: 26, fontWeight: '900', color: '#2c3e50', marginTop: 4 },
  unitLabel: { fontSize: 14, color: '#7f8c8d', fontWeight: '500' },
  metricStock: { fontSize: 20, fontWeight: '800', color: '#27ae60', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#2c3e50', marginTop: 25, marginBottom: 12 },
  
  sellerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#f1f2f6' },
  avatarFrame: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e8f4fd', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarLetter: { color: '#3498db', fontSize: 22, fontWeight: '900' },
  sellerName: { fontSize: 16, fontWeight: '800', color: '#2c3e50' },
  sellerBusiness: { fontSize: 13, color: '#7f8c8d', marginTop: 2, fontWeight: '500' },
  sellerContact: { fontSize: 13, color: '#3498db', marginTop: 5, fontWeight: '600' },
  
  // 🚨 NEW CHAT ICON STYLE
  chatIconButton: { backgroundColor: '#e8f4fd', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  chatIconText: { color: '#3498db', fontSize: 11, fontWeight: '800', marginTop: 2 },
  
  quantityInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f4f6f8', borderRadius: 12, borderWidth: 1, borderColor: '#e5e8e8', paddingHorizontal: 15 },
  quantityInput: { flex: 1, height: 50, fontSize: 16, color: '#2c3e50', fontWeight: '700' },
  inputUnitAppend: { fontSize: 15, fontWeight: '700', color: '#7f8c8d' },
  currencyPrefix: { fontSize: 16, fontWeight: '700', color: '#7f8c8d', marginRight: 5 },
  
  khataContainer: { marginTop: 10, padding: 5 },
  billBreakdown: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  breakdownLabel: { fontSize: 13, color: '#475569', fontWeight: '500' },
  breakdownValue: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  inputSubLabel: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6 },
  textGreen: { color: '#16A34A' },
  textRed: { color: '#DC2626' },
  methodToggleRow: { flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 4, borderRadius: 8, gap: 4 },
  methodTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  activeMethodTab: { backgroundColor: '#FFF', elevation: 1 },
  methodTabText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  activeMethodTabText: { color: '#1E3A8A', fontWeight: '700' },

  ctaGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30, marginBottom: 40 },
  negotiateButton: { flex: 1, flexDirection: 'row', height: 55, borderColor: '#e67e22', borderWidth: 1.5, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  negotiateButtonText: { color: '#e67e22', fontSize: 16, fontWeight: '800' },
  buyButton: { flex: 1, flexDirection: 'row', height: 55, backgroundColor: '#27ae60', borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  buyButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  
  ownProductWarning: { flexDirection: 'row', backgroundColor: '#e8f4fd', padding: 15, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 30, marginBottom: 40 },
  ownProductText: { color: '#3498db', fontWeight: 'bold', fontSize: 16, marginLeft: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalPanel: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f2f6', paddingBottom: 10 },
  modalHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#2c3e50' },
  modalLabel: { fontSize: 14, fontWeight: '700', color: '#34495e', marginBottom: 8, marginTop: 15 },
  priceInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#d5dbdb' },
  currencySymbol: { fontSize: 18, fontWeight: '700', color: '#7f8c8d', marginRight: 6 },
  modalPriceInput: { flex: 1, height: 50, fontSize: 16, color: '#2c3e50', fontWeight: '700' },
  modalMessageInput: { backgroundColor: '#f8f9fa', borderRadius: 12, padding: 15, fontSize: 15, color: '#2c3e50', borderWidth: 1, borderColor: '#d5dbdb', textAlignVertical: 'top' },
  transmitOfferBtn: { backgroundColor: '#e67e22', height: 55, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 30, marginBottom: 20 },
  transmitOfferBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' }
});