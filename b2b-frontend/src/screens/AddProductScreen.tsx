import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import apiClient from '../api/client';
import { Ionicons } from '@expo/vector-icons';

export default function AddProductScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
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

  const handleAddProduct = async () => {
    if (!name || !category || !price || !stock || !image) {
      return Alert.alert('Error', 'Please fill all fields and select an image');
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('category', category);
      formData.append('price', price);
      formData.append('stock', stock);
      formData.append('unit', 'KG'); 
      
      formData.append('images', {
        uri: image.uri,
        name: 'product.jpg',
        type: 'image/jpeg',
      } as any);

      await apiClient.post('/products/create', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Success', 'Product added to Mandi!');
      navigation.navigate('Home'); // <-- Standard Navigation
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.error || 'Failed to add product');
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color="#2c3e50" />
      </TouchableOpacity>
      
      <Text style={styles.title}>Add New Product</Text>
      
      <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
        {image ? (
          <Image source={{ uri: image.uri }} style={styles.imagePreview} />
        ) : (
          <Text style={styles.imagePickerText}>📸 Tap to add Product Photo</Text>
        )}
      </TouchableOpacity>

      <TextInput style={styles.input} placeholder="Product Name (e.g. Wheat)" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Category (e.g. GRAINS)" value={category} onChangeText={setCategory} />
      <TextInput style={styles.input} placeholder="Price per KG" keyboardType="numeric" value={price} onChangeText={setPrice} />
      <TextInput style={styles.input} placeholder="Available Stock (KG)" keyboardType="numeric" value={stock} onChangeText={setStock} />

      <TouchableOpacity style={styles.submitBtn} onPress={handleAddProduct} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>List Product</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa', padding: 20 },
  backButton: { marginTop: 40, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#2c3e50', marginBottom: 20 },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#ddd', fontSize: 16 },
  imagePicker: { height: 150, backgroundColor: '#e1e8ed', borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 20, overflow: 'hidden' },
  imagePickerText: { color: '#7f8c8d', fontSize: 16, fontWeight: 'bold' },
  imagePreview: { width: '100%', height: '100%' },
  submitBtn: { backgroundColor: '#2ecc71', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  submitText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});