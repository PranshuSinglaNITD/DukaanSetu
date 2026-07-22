import React, { useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  ListRenderItemInfo 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';

// ==========================================
// TYPESCRIPT DEFINITIONS
// ==========================================
export type MessageType = 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'SYSTEM';

export interface UserSummary {
  id: string;
  name: string;
  businessName: string;
}

export interface ProductSummary {
  name: string;
}

export interface MessagePreview {
  type: MessageType;
  text: string;
  createdAt: string;
}

export interface InboxRoom {
  id: string;
  buyer: UserSummary;
  seller: UserSummary;
  product: ProductSummary | null;
  messages: MessagePreview[];
}

interface ApiResponse<T> {
  status: string;
  data: T;
  error?: string;
}

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function InboxScreen({ navigation }: any) {
  const [inbox, setInbox] = useState<InboxRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // useFocusEffect triggers every time the user navigates back to this tab
  useFocusEffect(
    useCallback(() => {
      fetchInbox();
    }, [])
  );

  const fetchInbox = async (): Promise<void> => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync('userToken');
      
      if (token) {
        // Safely parse the JWT payload to find out who is logged in
        const payload = JSON.parse(atob(token.split('.')[1]));
        setCurrentUserId(payload.userId || payload.id);
      }

      const response = await apiClient.get<ApiResponse<InboxRoom[]>>('/chat/inbox');
      
      if (response.data.status === 'success') {
        setInbox(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching inbox payload:", error);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // RENDERER
  // ==========================================
  const renderInboxItem = ({ item }: ListRenderItemInfo<InboxRoom>) => {
    // Determine who the "other" person in the room is
    const isMeBuyer = item.buyer.id === currentUserId;
    const otherUser = isMeBuyer ? item.seller : item.buyer;
    
    // Format the latest message preview safely
    const latestMessage = item.messages && item.messages.length > 0 ? item.messages[0] : null;
    let messagePreview = "No messages yet";
    
    if (latestMessage) {
      if (latestMessage.type === 'IMAGE') messagePreview = "📷 Sent an image";
      else if (latestMessage.type === 'DOCUMENT') messagePreview = "📄 Sent a document";
      else if (latestMessage.type === 'SYSTEM') messagePreview = "🔔 System notification";
      else messagePreview = latestMessage.text;
    }

    return (
      <TouchableOpacity 
        style={styles.roomCard}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ChatScreen', { 
          roomId: item.id, 
          currentUserId: currentUserId 
        })}
      >
        <View style={styles.avatarFrame}>
          <Text style={styles.avatarLetter}>
            {otherUser?.name ? otherUser.name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        
        <View style={styles.roomInfo}>
          <View style={styles.headerRow}>
            <Text style={styles.userName}>{otherUser?.name || "Unknown User"}</Text>
            <Text style={styles.productBadge} numberOfLines={1}>
              {item.product?.name || "General Inquiry"}
            </Text>
          </View>
          <Text style={styles.businessName}>{otherUser?.businessName || "Independent"}</Text>
          <Text style={styles.messagePreview} numberOfLines={1}>{messagePreview}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={inbox}
        keyExtractor={(item) => item.id}
        renderItem={renderInboxItem}
        contentContainerStyle={styles.listPadding}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={60} color="#bdc3c7" />
            <Text style={styles.emptyText}>You have no active conversations.</Text>
          </View>
        }
      />
    </View>
  );
}

// ==========================================
// STYLESHEET
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listPadding: { padding: 15 },
  
  roomCard: { 
    flexDirection: 'row', 
    backgroundColor: '#fff', 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#f1f2f6', 
    alignItems: 'center' 
  },
  
  avatarFrame: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    backgroundColor: '#e8f4fd', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 15 
  },
  avatarLetter: { color: '#3498db', fontSize: 20, fontWeight: '900' },
  
  roomInfo: { flex: 1, overflow: 'hidden' },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 2 
  },
  
  userName: { fontSize: 16, fontWeight: '800', color: '#2c3e50', flexShrink: 1, marginRight: 8 },
  businessName: { fontSize: 12, color: '#7f8c8d', marginBottom: 6, fontWeight: '500' },
  
  productBadge: { 
    fontSize: 10, 
    backgroundColor: '#eafaf1', 
    color: '#27ae60', 
    paddingHorizontal: 6, 
    paddingVertical: 3, 
    borderRadius: 6, 
    overflow: 'hidden', 
    fontWeight: 'bold',
    maxWidth: 100
  },
  
  messagePreview: { fontSize: 14, color: '#555' },
  
  emptyState: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 15, fontSize: 16, color: '#7f8c8d', fontWeight: '500' }
});