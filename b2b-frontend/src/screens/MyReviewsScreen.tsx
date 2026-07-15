import React, { useState, useEffect, useContext } from 'react';
import { 
  View, Text, StyleSheet, FlatList, ActivityIndicator, 
  SafeAreaView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import apiClient from '../api/client';
import { AuthContext } from '../context/AuthContext';

interface Review {
  id: string;
  rating: number;
  feedback: string | null;
  reply: string | null;
  createdAt: string;
  reviewer?: { name: string; businessName: string | null; role: string; };
  reviewee?: { name: string; businessName: string | null; role: string; };
}

export default function MyReviewsScreen({ navigation }: any) {
  const {user} = useContext(AuthContext); 

  // Tab State
  const [activeTab, setActiveTab] = useState<'received' | 'given'>('received');

  // Data States
  const [receivedReviews, setReceivedReviews] = useState<Review[]>([]);
  const [givenReviews, setGivenReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Feature States
  const [aiSentiment, setAiSentiment] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 🚨 1. Grab the ID from your AuthContext
      const currentUserId = user?.id || user?.userId; 

      if (!currentUserId) return; // Safety check

      // 🚨 2. Attach the ID directly into the URLs!
      const [receivedRes, givenRes] = await Promise.all([
        apiClient.get(`/reviews/me/${currentUserId}`),
        apiClient.get(`/reviews/given/${currentUserId}`)
      ]);

      if (receivedRes.data.status === 'success') setReceivedReviews(receivedRes.data.data);
      if (givenRes.data.status === 'success') setGivenReviews(givenRes.data.data);
    } catch (error) {
      console.error("Failed to load reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSentiment = async () => {
    setIsGeneratingAi(true);
    try {
      const res = await apiClient.get('/reviews/sentiment');
      if (res.data.status === 'success') setAiSentiment(res.data.sentimentAnalysis);
    } catch (error: any) {
      Alert.alert("Analysis Failed", error.response?.data?.error || "Not enough data.");
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSubmitReply = async (reviewId: string) => {
    if (!replyText.trim()) return Alert.alert("Required", "Reply cannot be empty.");
    const currentUserId = user?.id || user?.userId; 

    try {
      const res = await apiClient.put(`/reviews/${reviewId}/reply`, { replyText, userId: currentUserId });
      if (res.data.status === 'success') {
        setReceivedReviews(prev => prev.map(r => r.id === reviewId ? { ...r, reply: replyText.trim() } : r));
        setReplyingToId(null);
        setReplyText('');
      }
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.error || "Failed to post reply.");
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, idx) => (
      <Ionicons key={idx} name={idx < rating ? "star" : "star-outline"} size={14} color={idx < rating ? "#fbbf24" : "#cbd5e1"} />
    ));
  };

  const renderReviewCard = ({ item }: { item: Review }) => {
    const isReceived = activeTab === 'received';
    // If received, show who wrote it. If given, show who it was written for.
    const targetUser = isReceived ? item.reviewer : item.reviewee;
    const dateStr = new Date(item.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewHeader}>
          <View>
            <Text style={styles.reviewerName}>
              {isReceived ? targetUser?.businessName || targetUser?.name : `To: ${targetUser?.businessName || targetUser?.name}`}
            </Text>
            <Text style={styles.reviewerRole}>{targetUser?.role} • {dateStr}</Text>
          </View>
          <View style={styles.starRow}>{renderStars(item.rating)}</View>
        </View>

        <Text style={[styles.feedbackText, !item.feedback && styles.emptyFeedback]}>
          {item.feedback ? `"${item.feedback}"` : "Only a star rating was provided."}
        </Text>

        {/* Reply Logic */}
        {item.reply ? (
          <View style={styles.sellerReplyBox}>
            <Text style={styles.replyLabel}>{isReceived ? "Your Reply:" : "Seller's Reply:"}</Text>
            <Text style={styles.replyText}>{item.reply}</Text>
          </View>
        ) : (isReceived && replyingToId === item.id) ? (
          <View style={styles.replyInputContainer}>
            <TextInput style={styles.replyInput} placeholder="Type your professional response..." value={replyText} onChangeText={setReplyText} multiline />
            <View style={styles.replyActions}>
              <TouchableOpacity onPress={() => setReplyingToId(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.submitReplyBtn} onPress={() => handleSubmitReply(item.id)}><Text style={styles.submitReplyText}>Post Reply</Text></TouchableOpacity>
            </View>
          </View>
        ) : (isReceived && item.feedback) ? (
          <TouchableOpacity style={styles.openReplyBtn} onPress={() => setReplyingToId(item.id)}>
            <Ionicons name="arrow-undo-outline" size={14} color="#0ea5e9" />
            <Text style={styles.openReplyText}>Reply to Buyer</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Reviews</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* ─── CUSTOM TAB BAR ─── */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'received' && styles.activeTab]} 
            onPress={() => setActiveTab('received')}
          >
            <Text style={[styles.tabText, activeTab === 'received' && styles.activeTabText]}>Received ({receivedReviews.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabButton, activeTab === 'given' && styles.activeTab]} 
            onPress={() => setActiveTab('given')}
          >
            <Text style={[styles.tabText, activeTab === 'given' && styles.activeTabText]}>Given ({givenReviews.length})</Text>
          </TouchableOpacity>
        </View>

        {/* AI Sentiment Analysis Box (Only show on Received tab) */}
        {activeTab === 'received' && (
          <View style={styles.aiContainer}>
            {aiSentiment ? (
              <View style={styles.aiResultBox}>
                <View style={styles.aiResultHeader}>
                  <MaterialCommunityIcons name="robot-outline" size={20} color="#8b5cf6" />
                  <Text style={styles.aiResultTitle}>Gemini AI Insights</Text>
                </View>
                <Text style={styles.aiResultText}>{aiSentiment}</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.aiButton} onPress={handleGenerateSentiment} disabled={isGeneratingAi || receivedReviews.length === 0}>
                {isGeneratingAi ? <ActivityIndicator color="#fff" /> : <MaterialCommunityIcons name="robot-outline" size={22} color="#fff" />}
                <Text style={styles.aiButtonText}>{isGeneratingAi ? "Analyzing Reputation..." : "Generate AI Sentiment Analysis"}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Review List */}
        {loading ? (
          <ActivityIndicator size="large" color="#059669" style={{ marginTop: 50 }} />
        ) : (
          <FlatList
            data={activeTab === 'received' ? receivedReviews : givenReviews}
            keyExtractor={(item) => item.id}
            renderItem={renderReviewCard}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={styles.noReviewsText}>
                {activeTab === 'received' ? "You have no reviews yet. Complete shipments to earn feedback!" : "You haven't left any reviews for other users yet."}
              </Text>
            }
          />
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: Platform.OS === 'android' ? 40 : 20, backgroundColor: '#fff' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  
  // 🚨 New Tab Styles
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  activeTab: { borderColor: '#059669' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  activeTabText: { color: '#059669', fontWeight: '800' },

  aiContainer: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#f1f5f9' },
  aiButton: { flexDirection: 'row', backgroundColor: '#8b5cf6', padding: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },
  aiButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  aiResultBox: { backgroundColor: '#f5f3ff', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#ddd6fe' },
  aiResultHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  aiResultTitle: { fontSize: 14, fontWeight: '800', color: '#7c3aed' },
  aiResultText: { fontSize: 13, color: '#4c1d95', lineHeight: 22 },
  
  listContainer: { padding: 16, paddingBottom: 40 },
  reviewCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#f1f5f9' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  reviewerName: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  reviewerRole: { fontSize: 11, color: '#64748b', marginTop: 2, textTransform: 'capitalize' },
  starRow: { flexDirection: 'row', gap: 2 },
  feedbackText: { fontSize: 14, color: '#475569', lineHeight: 20 },
  emptyFeedback: { fontStyle: 'italic', color: '#94a3b8' },
  
  sellerReplyBox: { marginTop: 12, backgroundColor: '#f8fafc', padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#059669' },
  replyLabel: { fontSize: 11, fontWeight: '800', color: '#059669', marginBottom: 4, textTransform: 'uppercase' },
  replyText: { fontSize: 13, color: '#334155', lineHeight: 18 },
  
  openReplyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  openReplyText: { color: '#0ea5e9', fontSize: 13, fontWeight: '700' },
  
  replyInputContainer: { marginTop: 12 },
  replyInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 13, minHeight: 60, textAlignVertical: 'top' },
  replyActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 8 },
  cancelText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
  submitReplyBtn: { backgroundColor: '#0ea5e9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  submitReplyText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  
  noReviewsText: { textAlign: 'center', marginTop: 40, color: '#94a3b8', fontSize: 15 }
});