import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Image, ScrollView, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';

const SAFFRON = '#f97316';
const NAVY    = '#1e293b';

const LISTING_TYPES  = [{ key: 'RENT', label: 'For Rent', icon: '🔑' }, { key: 'SALE', label: 'For Sale', icon: '🏷️' }];
const PROPERTY_TYPES = [{ key: 'SHOP', label: 'Shop', icon: '🏪' }, { key: 'PLOT', label: 'Plot / Land', icon: '🌿' }, { key: 'WAREHOUSE', label: 'Warehouse', icon: '🏭' }];

export default function AddPropertyScreen({ navigation }: any) {
  const [title,       setTitle]       = useState('');
  const [address,     setAddress]     = useState('');
  const [city,        setCity]        = useState('');
  const [stateName,   setStateName]   = useState('');
  const [price,       setPrice]       = useState('');
  const [areaSqFt,    setAreaSqFt]    = useState('');
  const [listingType, setListingType] = useState('RENT');
  const [propType,    setPropType]    = useState('SHOP');
  const [image,       setImage]       = useState<any>(null);
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const addressRef = useRef<TextInput>(null);
  const cityRef    = useRef<TextInput>(null);
  const stateRef   = useRef<TextInput>(null);
  const priceRef   = useRef<TextInput>(null);
  const areaRef    = useRef<TextInput>(null);

  const clearErr = (k: string) => setErrors(p => { const n = {...p}; delete n[k]; return n; });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.7,
    });
    if (!result.canceled) { setImage(result.assets[0]); clearErr('image'); }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!image)           e.image    = 'Property photo is required';
    if (!title.trim())    e.title    = 'Listing title is required';
    if (!address.trim())  e.address  = 'Address is required';
    if (!city.trim())     e.city     = 'City is required';
    if (!stateName.trim())e.state    = 'State is required';
    if (!price || isNaN(Number(price)) || Number(price) <= 0) e.price = 'Enter a valid price';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title',        title.trim());
      formData.append('address',      address.trim());
      formData.append('city',         city.trim());
      formData.append('state',        stateName.trim());
      formData.append('price',        price);
      formData.append('areaSqFt',     areaSqFt || '0');
      formData.append('listingType',  listingType);
      formData.append('propertyType', propType);
      formData.append('images', { uri: image.uri, name: 'property.jpg', type: 'image/jpeg' } as any);
      await apiClient.post('/properties/create', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Alert.alert('Listed!', 'Your property is now live.', [{ text: 'OK', onPress: () => navigation.navigate('Marketplace') }]);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to list property');
    }
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={NAVY} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>List a Property</Text>
        <Text style={styles.subtitle}>Shops, plots & warehouses for rent or sale</Text>

        {/* Image Picker */}
        <TouchableOpacity style={[styles.imagePicker, errors.image && styles.borderError]} onPress={pickImage} activeOpacity={0.8}>
          {image ? (
            <>
              <Image source={{ uri: image.uri }} style={styles.imagePreview} />
              <View style={styles.imageOverlay}>
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.imageOverlayText}>Change Photo</Text>
              </View>
            </>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="business-outline" size={36} color="#94a3b8" />
              <Text style={styles.imagePlaceholderText}>Add Property Photo</Text>
              <Text style={styles.imagePlaceholderSub}>Good photos attract more enquiries</Text>
            </View>
          )}
        </TouchableOpacity>
        {errors.image && <Text style={styles.errText}>{errors.image}</Text>}

        {/* Listing Type */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Listing Type</Text>
          <View style={styles.chips}>
            {LISTING_TYPES.map(t => (
              <TouchableOpacity key={t.key} style={[styles.chip, listingType === t.key && styles.chipActive]} onPress={() => setListingType(t.key)}>
                <Text style={styles.chipIcon}>{t.icon}</Text>
                <Text style={[styles.chipText, listingType === t.key && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Property Type</Text>
          <View style={styles.chips}>
            {PROPERTY_TYPES.map(t => (
              <TouchableOpacity key={t.key} style={[styles.chip, propType === t.key && styles.chipActive]} onPress={() => setPropType(t.key)}>
                <Text style={styles.chipIcon}>{t.icon}</Text>
                <Text style={[styles.chipText, propType === t.key && styles.chipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Details */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Property Details</Text>

          {/* Title */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Listing Title</Text>
            <TextInput
              style={[styles.input, errors.title && styles.inputError]}
              placeholder="e.g. Prime Corner Shop, Main Bazar"
              placeholderTextColor="#94a3b8"
              value={title} onChangeText={t => { setTitle(t); clearErr('title'); }}
              returnKeyType="next" onSubmitEditing={() => addressRef.current?.focus()}
              autoCapitalize="words"
            />
            {errors.title && <Text style={styles.errText}>{errors.title}</Text>}
          </View>

          {/* Address */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Full Address</Text>
            <TextInput
              ref={addressRef}
              style={[styles.input, errors.address && styles.inputError]}
              placeholder="Street, locality, landmark"
              placeholderTextColor="#94a3b8"
              value={address} onChangeText={t => { setAddress(t); clearErr('address'); }}
              returnKeyType="next" onSubmitEditing={() => cityRef.current?.focus()}
            />
            {errors.address && <Text style={styles.errText}>{errors.address}</Text>}
          </View>

          {/* City + State */}
          <View style={styles.row}>
            <View style={[styles.fieldWrap, styles.flex]}>
              <Text style={styles.label}>City</Text>
              <TextInput
                ref={cityRef}
                style={[styles.input, errors.city && styles.inputError]}
                placeholder="City"
                placeholderTextColor="#94a3b8"
                value={city} onChangeText={t => { setCity(t); clearErr('city'); }}
                returnKeyType="next" onSubmitEditing={() => stateRef.current?.focus()}
                autoCapitalize="words"
              />
              {errors.city && <Text style={styles.errText}>{errors.city}</Text>}
            </View>
            <View style={{ width: 12 }} />
            <View style={[styles.fieldWrap, styles.flex]}>
              <Text style={styles.label}>State</Text>
              <TextInput
                ref={stateRef}
                style={[styles.input, errors.state && styles.inputError]}
                placeholder="State"
                placeholderTextColor="#94a3b8"
                value={stateName} onChangeText={t => { setStateName(t); clearErr('state'); }}
                returnKeyType="next" onSubmitEditing={() => priceRef.current?.focus()}
                autoCapitalize="words"
              />
              {errors.state && <Text style={styles.errText}>{errors.state}</Text>}
            </View>
          </View>

          {/* Price */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>{listingType === 'RENT' ? 'Monthly Rent' : 'Total Price'}</Text>
            <View style={[styles.inputRow, errors.price && styles.inputError]}>
              <Text style={styles.prefix}>₹</Text>
              <TextInput
                ref={priceRef}
                style={styles.inputInner}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={price} onChangeText={t => { setPrice(t); clearErr('price'); }}
                returnKeyType="next" onSubmitEditing={() => areaRef.current?.focus()}
              />
            </View>
            {errors.price && <Text style={styles.errText}>{errors.price}</Text>}
          </View>

          {/* Area */}
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>Area (Sq. Ft) <Text style={styles.optional}>— Optional</Text></Text>
            <View style={styles.inputRow}>
              <Ionicons name="resize-outline" size={16} color="#94a3b8" style={{ marginRight: 8 }} />
              <TextInput
                ref={areaRef}
                style={styles.inputInner}
                placeholder="e.g. 450"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                value={areaSqFt} onChangeText={setAreaSqFt}
                returnKeyType="done" onSubmitEditing={handleSubmit}
              />
              <Text style={styles.suffix}>sq.ft</Text>
            </View>
          </View>
        </View>

        {/* Submit */}
        <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <View style={styles.loadRow}><ActivityIndicator color="#fff" size="small" /><Text style={styles.submitText}> Posting…</Text></View>
            : <Text style={styles.submitText}>Post Listing →</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { padding: 20, paddingBottom: 48 },

  backBtn:  { flexDirection: 'row', alignItems: 'center', marginTop: Platform.OS === 'ios' ? 50 : 20, marginBottom: 16, gap: 6 },
  backText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  title:    { fontSize: 26, fontWeight: '800', color: NAVY, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#64748b', marginBottom: 20 },

  imagePicker:      { height: 180, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderStyle: 'dashed', marginBottom: 4 },
  imagePreview:     { width: '100%', height: '100%' },
  imageOverlay:     { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', gap: 4 },
  imageOverlayText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  imagePlaceholderText: { fontSize: 15, fontWeight: '700', color: '#475569' },
  imagePlaceholderSub:  { fontSize: 12, color: '#94a3b8' },
  borderError:      { borderColor: '#ef4444' },

  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 16, elevation: 4 },
  sectionLabel: { fontSize: 13, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },

  chips:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:          { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  chipActive:    { backgroundColor: '#fff7ed', borderColor: SAFFRON },
  chipIcon:      { fontSize: 14 },
  chipText:      { fontSize: 13, fontWeight: '700', color: '#64748b' },
  chipTextActive:{ color: SAFFRON },

  fieldWrap: { marginBottom: 14 },
  label:     { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  optional:  { fontWeight: '400', color: '#94a3b8' },
  input:     { backgroundColor: '#f8fafc', padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', fontSize: 15, color: NAVY },
  inputRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 1.5, borderColor: '#e2e8f0', paddingHorizontal: 12, minHeight: 50 },
  inputInner:{ flex: 1, fontSize: 15, color: NAVY, paddingVertical: Platform.OS === 'ios' ? 12 : 8 },
  inputError:{ borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  prefix:    { fontSize: 16, fontWeight: '700', color: '#475569', marginRight: 6 },
  suffix:    { fontSize: 13, color: '#94a3b8', marginLeft: 4 },
  errText:   { fontSize: 12, color: '#ef4444', marginTop: 4, marginLeft: 2 },

  row: { flexDirection: 'row' },

  submitBtn:         { backgroundColor: SAFFRON, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4, shadowColor: SAFFRON, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  submitBtnDisabled: { backgroundColor: '#fdba74', shadowOpacity: 0.1 },
  submitText:        { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  loadRow:           { flexDirection: 'row', alignItems: 'center' },
});