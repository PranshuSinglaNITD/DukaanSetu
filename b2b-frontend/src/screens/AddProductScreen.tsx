import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image, ScrollView, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';
import { SyncManager } from '../utils/SyncManager';
import NetInfo from '@react-native-community/netinfo';  

const SAFFRON = '#f97316';
const NAVY    = '#1e293b';

const CATEGORIES = ['GRAINS', 'PULSES', 'SPICES', 'OIL', 'SUGAR', 'OTHER'];
const UNITS      = ['KG', 'QUINTAL', 'TON', 'LITRE', 'PIECE'];

export default function AddProductScreen({ navigation }: any) {
  const [name,       setName]     = useState('');
  const [category, setCategory] = useState('');
  const [price,    setPrice]    = useState('');
  const [stock,    setStock]    = useState('');
  const [unit,     setUnit]     = useState('KG');
  const [shelfLife, setShelfLife] = useState(''); // NEW: Holds AI calculated days
  
  const [image,    setImage]    = useState<any>(null);
  const [loading,  setLoading]  = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false); // NEW: AI Loading State
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  const priceRef = useRef<TextInput>(null);
  const stockRef = useRef<TextInput>(null);
  const shelfLifeRef = useRef<TextInput>(null);

  const clearErr = (k: string) => setErrors(p => { const n = {...p}; delete n[k]; return n; });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, 
      quality: 0.7,
      base64: true, // 🚨 CRITICAL: Added to extract data for Gemini
    });
    
    if (!result.canceled) {
      const asset = result.assets[0];
      setImage(asset);
      analyzeImage(asset.base64, asset.mimeType || 'image/jpeg');
    }
  };

  // 🚨 NEW: The AI Background Engine
  const analyzeImage = async (base64Str: string | null | undefined, mimeType: string) => {
    if (!base64Str) return;
    setIsAnalyzing(true);
    
    try {
      const response = await apiClient.post('/products/analyze-image', {
        imageBase64: base64Str,
        mimeType: mimeType
      });

      const { suggestedName, category: aiCat, estimatedShelfLifeDays } = response.data.analysis;

      // Auto-fill the form cleanly
      if (suggestedName) { setName(suggestedName); clearErr('name'); }
      if (aiCat && CATEGORIES.includes(aiCat)) { setCategory(aiCat); clearErr('category'); }
      if (estimatedShelfLifeDays) { setShelfLife(String(estimatedShelfLifeDays)); clearErr('shelfLife'); }

    } catch (err) {
      console.log("Vision API Error", err);
      // Fails silently, user can just type the details manually
    } finally {
      setIsAnalyzing(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!image)          e.image    = 'Product photo is required';
    if (!name.trim())    e.name     = 'Product name is required';
    if (!category)       e.category = 'Select a category';
    if (!price || isNaN(Number(price)) || Number(price) <= 0) e.price = 'Enter a valid price';
    if (!stock || isNaN(Number(stock)) || Number(stock) <= 0) e.stock = 'Enter valid stock quantity';
    if (!shelfLife || isNaN(Number(shelfLife)) || Number(shelfLife) <= 0) e.shelfLife = 'Enter expiry in days';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
  if (!validate()) return;
  setLoading(true);

  // 1. Fetch current network state
  const networkState = await NetInfo.fetch();

  // 2. Create a plain JSON payload (No FormData yet!)
  // We add a special flag 'isMultipart' so the SyncManager knows to rebuild it later.
  const productPayload = {
    name: name.trim(),
    category,
    price,
    stock,
    unit,
    estimatedShelfLifeDays: shelfLife,
    imageUri: image.uri, //We just store the text path to the image
    isMultipart: true    //Our secret flag for the offline queue
  };

  try {
    //here we are online 
    if (networkState.isConnected) {
      // We have Wi-Fi, so build the FormData and send it immediately.
      const formData = new FormData();
      formData.append('name', productPayload.name);
      formData.append('category', productPayload.category);
      formData.append('price', productPayload.price);
      formData.append('stock', productPayload.stock);
      formData.append('unit', productPayload.unit);
      formData.append('estimatedShelfLifeDays', productPayload.estimatedShelfLifeDays);
      formData.append('images', { uri: productPayload.imageUri, name: 'product.jpg', type: 'image/jpeg' } as any);
      
      await apiClient.post('/products/create', formData, { 
        headers: { 'Content-Type': 'multipart/form-data' } 
      });
      
      Alert.alert('Listed!', `${name} added to Mandi.`, [{ text: 'OK', onPress: () => navigation.navigate('Landing') }]);
      //here we are offline
    } else {
      // No Wi-Fi. Send the plain JSON object to our persistent queue.
      await SyncManager.addJobToQueue('/products/create', productPayload);
      Alert.alert(
        'Offline Mode', 
        `${name} saved locally. It will automatically upload to the marketplace when your connection returns.`, 
        [{ text: 'OK', onPress: () => navigation.navigate('Landing') }]
      );
    }
  } catch (err: any) {
    await SyncManager.addJobToQueue('/products/create', productPayload);
    Alert.alert('Server Timeout', 'Saved to offline queue. Will retry automatically.', [{ text: 'OK', onPress: () => navigation.navigate('Landing') }]);
  } finally {
    setLoading(false);
  }
};

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={NAVY} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>List a Product</Text>
        <Text style={styles.subtitle}>Add to the Mandi marketplace</Text>

        {/* Image Picker */}
        <TouchableOpacity style={[styles.imagePicker, errors.image && styles.inputError]} onPress={pickImage} activeOpacity={0.8} disabled={isAnalyzing}>
          {image ? (
            <>
              <Image source={{ uri: image.uri }} style={styles.imagePreview} />
              <View style={styles.imageOverlay}>
                {isAnalyzing ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.imageOverlayText}>AI Auto-Filling...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="camera" size={20} color="#fff" />
                    <Text style={styles.imageOverlayText}>Change Photo</Text>
                  </>
                )}
              </View>
            </>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="camera-outline" size={36} color="#94a3b8" />
              <Text style={styles.imagePlaceholderText}>Tap to add Product Photo</Text>
              <Text style={styles.imagePlaceholderSub}>Clear photo = more buyers</Text>
            </View>
          )}
        </TouchableOpacity>
        {errors.image && <Text style={styles.errText}>{errors.image}</Text>}

        {/* Product Name */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Product Name</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            placeholder="e.g. Wheat, Basmati Rice"
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={t => { setName(t); clearErr('name'); }}
            returnKeyType="next"
            onSubmitEditing={() => priceRef.current?.focus()}
            autoCapitalize="words"
          />
          {errors.name && <Text style={styles.errText}>{errors.name}</Text>}
        </View>

        {/* Category Chips */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Category</Text>
          <View style={styles.chips}>
            {CATEGORIES.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, category === c && styles.chipActive]}
                onPress={() => { setCategory(c); clearErr('category'); }}
              >
                <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.category && <Text style={styles.errText}>{errors.category}</Text>}
        </View>

        {/* Price + Unit Row */}
        <View style={styles.row}>
          <View style={[styles.fieldWrap, styles.flex]}>
            <Text style={styles.label}>Price per {unit}</Text>
            <View style={[styles.inputRow, errors.price && styles.inputError]}>
              <Text style={styles.prefix}>₹</Text>
              <TextInput
                ref={priceRef}
                style={styles.inputInner}
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={price}
                onChangeText={t => { setPrice(t); clearErr('price'); }}
                returnKeyType="next"
                onSubmitEditing={() => stockRef.current?.focus()}
              />
            </View>
            {errors.price && <Text style={styles.errText}>{errors.price}</Text>}
          </View>

          <View style={[styles.fieldWrap, { width: 110, marginLeft: 12 }]}>
            <Text style={styles.label}>Unit</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chips}>
                {UNITS.map(u => (
                  <TouchableOpacity key={u} style={[styles.chip, unit === u && styles.chipActive]} onPress={() => setUnit(u)}>
                    <Text style={[styles.chipText, unit === u && styles.chipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Stock */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Available Stock ({unit})</Text>
          <View style={[styles.inputRow, errors.stock && styles.inputError]}>
            <Ionicons name="cube-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              ref={stockRef}
              style={styles.inputInner}
              placeholder={`Quantity in ${unit}`}
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={stock}
              onChangeText={t => { setStock(t); clearErr('stock'); }}
              returnKeyType="next"
              onSubmitEditing={() => shelfLifeRef.current?.focus()}
            />
          </View>
          {errors.stock && <Text style={styles.errText}>{errors.stock}</Text>}
        </View>

        {/* 🚨 NEW: Shelf Life (Auto-filled by AI) */}
        <View style={styles.fieldWrap}>
          <Text style={styles.label}>Shelf Life (Days)</Text>
          <View style={[styles.inputRow, errors.shelfLife && styles.inputError]}>
            <Ionicons name="calendar-outline" size={16} color={isAnalyzing ? SAFFRON : "#94a3b8"} style={{ marginRight: 8 }} />
            <TextInput
              ref={shelfLifeRef}
              style={styles.inputInner}
              placeholder={isAnalyzing ? "AI is calculating..." : "Days until expiry"}
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              value={shelfLife}
              onChangeText={t => { setShelfLife(t); clearErr('shelfLife'); }}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>
          {errors.shelfLife && <Text style={styles.errText}>{errors.shelfLife}</Text>}
        </View>

        {/* Submit */}
        <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <View style={styles.loadRow}><ActivityIndicator color="#fff" size="small" /><Text style={styles.submitText}> Listing…</Text></View>
            : <Text style={styles.submitText}>List on Mandi →</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:    { flex: 1, backgroundColor: '#f1f5f9' },
  scroll:  { padding: 20, paddingBottom: 48 },

  backBtn:  { flexDirection: 'row', alignItems: 'center', marginTop: Platform.OS === 'ios' ? 50 : 20, marginBottom: 16, gap: 6 },
  backText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  title:    { fontSize: 26, fontWeight: '800', color: NAVY, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },

  // Image
  imagePicker:      { height: 180, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderStyle: 'dashed', marginBottom: 4 },
  imagePreview:     { width: '100%', height: '100%' },
  imageOverlay:     { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  imageOverlayText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  imagePlaceholderText: { fontSize: 15, fontWeight: '700', color: '#475569' },
  imagePlaceholderSub:  { fontSize: 12, color: '#94a3b8' },

  // Fields
  fieldWrap: { marginBottom: 16 },
  label:     { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, letterSpacing: 0.2 },
  input: {
    backgroundColor: '#fff', padding: 14, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e2e8f0', fontSize: 15, color: NAVY,
  },
  inputRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', paddingHorizontal: 12, minHeight: 50 },
  inputInner: { flex: 1, fontSize: 15, color: NAVY, paddingVertical: Platform.OS === 'ios' ? 12 : 8 },
  inputError: { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  prefix:     { fontSize: 16, fontWeight: '700', color: '#475569', marginRight: 6 },
  errText:    { fontSize: 12, color: '#ef4444', marginTop: 4, marginLeft: 2 },

  // Chips
  chips:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  chipActive:   { backgroundColor: '#fff7ed', borderColor: SAFFRON },
  chipText:     { fontSize: 12, fontWeight: '700', color: '#64748b' },
  chipTextActive: { color: SAFFRON },

  row: { flexDirection: 'row', alignItems: 'flex-start' },

  // Submit
  submitBtn: {
    backgroundColor: SAFFRON, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
    shadowColor: SAFFRON, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  submitBtnDisabled: { backgroundColor: '#fdba74', shadowOpacity: 0.1 },
  submitText:        { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  loadRow:           { flexDirection: 'row', alignItems: 'center' },
});