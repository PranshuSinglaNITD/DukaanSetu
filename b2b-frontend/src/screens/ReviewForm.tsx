import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, TextInput, TouchableOpacity, 
  SafeAreaView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';

export default function ReviewForm({ route, navigation }: any) {
  // Received from the LiveTrackingScreen replacement
  const { revieweeId, revieweeName } = route.params;

  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic text helper based on stars
  const getRatingLabel = () => {
    switch (rating) {
      case 5: return "Excellent - Highly Recommended";
      case 4: return "Good - Smooth Transaction";
      case 3: return "Average - Met Expectations";
      case 2: return "Poor - Had Issues";
      case 1: return "Terrible - Do Not Recommend";
      default: return "Tap a star to rate";
    }
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      return Alert.alert("Rating Required", "Please select a star rating before submitting.");
    }
    console.log("PAYLOAD CHECK:", { revieweeId, rating, feedback });
    setIsSubmitting(true);
    try {
      const res = await apiClient.post('/reviews/submit', {
        revieweeId: revieweeId,
        rating: rating,
        feedback: feedback.trim()
      });

      if (res.data.status === 'success') {
        Alert.alert("Thank You!", "Your feedback helps keep the marketplace safe.");
        // Route them back to their main dashboard/orders list
        // navigation.navigate('BuyerOrders'); 
        navigation.goBack();
      }
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Failed to submit review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    navigation.goBack();

  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          
          <View style={styles.header}>
            <Ionicons name="checkmark-circle" size={64} color="#10b981" />
            <Text style={styles.title}>Delivery Complete!</Text>
            <Text style={styles.subtitle}>
              How was your experience doing business with {revieweeName}?
            </Text>
          </View>

          {/* Interactive Star Rating */}
          <View style={styles.starContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity 
                key={star} 
                onPress={() => setRating(star)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={rating >= star ? "star" : "star-outline"} 
                  size={48} 
                  color={rating >= star ? "#fbbf24" : "#cbd5e1"} 
                  style={{ marginHorizontal: 4 }}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingLabel}>{getRatingLabel()}</Text>

          {/* Feedback Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Written Feedback (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g., Grain quality was perfect, but delivery was delayed by a day."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              value={feedback}
              onChangeText={setFeedback}
              textAlignVertical="top"
            />
          </View>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.submitBtn, rating === 0 && styles.submitBtnDisabled]} 
              onPress={handleSubmit}
              disabled={isSubmitting || rating === 0}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Review</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipBtnText}>Skip for now</Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  keyboardView: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginTop: 16, marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
  
  starContainer: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  ratingLabel: { textAlign: 'center', fontSize: 14, fontWeight: '600', color: '#059669', marginBottom: 40 },
  
  inputContainer: { marginBottom: 30 },
  inputLabel: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: { 
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', 
    borderRadius: 16, padding: 16, fontSize: 15, color: '#0f172a', minHeight: 120 
  },
  
  footer: { marginTop: 'auto', gap: 12 },
  submitBtn: { backgroundColor: '#059669', padding: 18, borderRadius: 16, alignItems: 'center', shadowColor: '#059669', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  submitBtnDisabled: { backgroundColor: '#94a3b8', shadowOpacity: 0, elevation: 0 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  skipBtn: { padding: 16, alignItems: 'center' },
  skipBtnText: { color: '#64748b', fontSize: 15, fontWeight: '600' }
});