import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../api/client';
import { Ionicons } from '@expo/vector-icons';

export default function AddPropertyScreen({ navigation }: any) {
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  // 🚨 NEW FIELDS ADDED HERE
  const [stateName, setStateName] = useState(''); 
  const [address, setAddress] = useState('');
  
  const [price, setPrice] = useState('');
  const [areaSqFt, setAreaSqFt] = useState('');
  const [listingType, setListingType] = useState('RENT'); 
  const [propertyType, setPropertyType] = useState('SHOP'); 
  
  const [image, setImage] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  const handleAddProperty = async () => {
    // 🚨 UPDATE VALIDATION TO INCLUDE NEW FIELDS
    if (!title || !city || !stateName || !address || !price || !image) {
      return Alert.alert('Error', 'Please fill all required fields and select an image');
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('city', city);
      
      // 🚨 APPEND NEW FIELDS TO FORMDATA
      formData.append('state', stateName);
      formData.append('address', address);
      
      formData.append('price', price);
      formData.append('areaSqFt', areaSqFt || '0');
      formData.append('listingType', listingType);
      formData.append('propertyType', propertyType);
      
      formData.append('images', {
        uri: image.uri,
        name: 'property.jpg',
        type: 'image/jpeg',
      } as any);

      await apiClient.post('/properties/create', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Success', 'Property listed successfully!');
      navigation.navigate('Marketplace'); 
    } catch (error: any) {
      console.log(error.response?.data); // Helpful for debugging
      Alert.alert('Error', error.response?.data?.error || 'Failed to list property');
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#2c3e50" />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>List a Property</Text>
      
      {/* Image Picker */}
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.imagePreview} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="camera-outline" size={40} color="#7f8c8d" />
            <Text style={styles.imagePickerText}>Add Property Photo</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Listing Type Selection (Rent vs Sale) */}
      <View style={styles.selectionRow}>
        <TouchableOpacity 
          style={[styles.selectButton, listingType === 'RENT' && styles.activeSelect]} 
          onPress={() => setListingType('RENT')}
        >
          <Text style={[styles.selectText, listingType === 'RENT' && styles.activeSelectText]}>For Rent</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.selectButton, listingType === 'SALE' && styles.activeSelect]} 
          onPress={() => setListingType('SALE')}
        >
          <Text style={[styles.selectText, listingType === 'SALE' && styles.activeSelectText]}>For Sale</Text>
        </TouchableOpacity>
      </View>

      {/* Property Type Selection (Shop vs Plot) */}
      <View style={styles.selectionRow}>
        <TouchableOpacity 
          style={[styles.selectButton, propertyType === 'SHOP' && styles.activeSelect]} 
          onPress={() => setPropertyType('SHOP')}
        >
          <Text style={[styles.selectText, propertyType === 'SHOP' && styles.activeSelectText]}>Shop</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.selectButton, propertyType === 'PLOT' && styles.activeSelect]} 
          onPress={() => setPropertyType('PLOT')}
        >
          <Text style={[styles.selectText, propertyType === 'PLOT' && styles.activeSelectText]}>Plot / Land</Text>
        </TouchableOpacity>
      </View>

      {/* Text Inputs */}
      <TextInput style={styles.input} placeholder="Listing Title (e.g. Prime Corner Shop)" value={title} onChangeText={setTitle} />
      
      {/* 🚨 NEW INPUTS ADDED HERE */}
      <TextInput style={styles.input} placeholder="Full Address" value={address} onChangeText={setAddress} />
      <View style={styles.rowInputs}>
        <TextInput style={[styles.input, { flex: 1, marginRight: 10 }]} placeholder="City" value={city} onChangeText={setCity} />
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="State" value={stateName} onChangeText={setStateName} />
      </View>

      <TextInput style={styles.input} placeholder={listingType === 'RENT' ? "Monthly Rent (₹)" : "Total Price (₹)"} keyboardType="numeric" value={price} onChangeText={setPrice} />
      <TextInput style={styles.input} placeholder="Area (Sq. Ft) - Optional" keyboardType="numeric" value={areaSqFt} onChangeText={setAreaSqFt} />

      {/* Submit Button */}
      <TouchableOpacity style={styles.submitBtn} onPress={handleAddProperty} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Post Listing</Text>}
      </TouchableOpacity>
      
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  backButton: { marginTop: 40, marginBottom: 20, width: 40 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#2c3e50', marginBottom: 20 },
  
  imagePicker: { height: 180, backgroundColor: '#e1e8ed', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#bdc3c7', borderStyle: 'dashed' },
  imagePlaceholder: { alignItems: 'center' },
  imagePickerText: { color: '#7f8c8d', fontSize: 16, fontWeight: '600', marginTop: 10 },
  imagePreview: { width: '100%', height: '100%' },
  
  selectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  selectButton: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, alignItems: 'center', marginHorizontal: 4, backgroundColor: '#fff' },
  activeSelect: { backgroundColor: '#3498db', borderColor: '#3498db' },
  selectText: { color: '#7f8c8d', fontWeight: 'bold', fontSize: 15 },
  activeSelectText: { color: '#fff' },

  input: { backgroundColor: '#fff', padding: 16, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#ddd', fontSize: 16 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  
  submitBtn: { backgroundColor: '#2ecc71', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 10, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  submitText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});