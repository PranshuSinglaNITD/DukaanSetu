import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Alert,
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  StyleSheet, 
  Image, 
  KeyboardAvoidingView, 
  Platform,
  ListRenderItemInfo
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import SocketClient from '../utils/socketClient';

// Update with your actual server URL
const API_BASE_URL = 'http://192.168.1.8:3000/api'; 

export type MessageType = 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'SYSTEM';

export interface UserSummary {
  name: string;
  role: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string | null;
  sender?: UserSummary | null;
  type: MessageType;
  text: string;
  isRead: boolean;
  createdAt: string;
}

interface ApiResponse<T> {
  status: string;
  data: T;
  error?: string;
}

interface ChatScreenRouteParams {
  roomId: string;
  currentUserId: string;
}

interface ChatScreenProps {
  route: {
    params: ChatScreenRouteParams;
  };
}

// ==========================================
// MAIN COMPONENT EXPORT
// ==========================================
export default function HumanChatScreen({ route }: ChatScreenProps) {
  const { roomId, currentUserId } = route.params;
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState<string>('');
  
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
  SocketClient.connect().then(() => {
    const activeSocket = SocketClient.getSocket();
    if (activeSocket) {
      activeSocket.emit('join_room', { roomId });

      // Listen for successful messages
      activeSocket.on('receive_message', (newMessage: ChatMessage) => {
        setMessages((prev) => [...prev, newMessage]);
      });

      // 🚨 NEW: Listen for backend rejections!
      activeSocket.on('error_status', (error: { message: string }) => {
        Alert.alert("Message Failed", error.message);
      });
    }
  });

  fetchHistory();

  return () => {
    const activeSocket = SocketClient.getSocket();
    if (activeSocket) {
      activeSocket.off('receive_message');
      activeSocket.off('error_status'); // Clean up the new listener
    }
  };
}, [roomId]);

  const fetchHistory = async (): Promise<void> => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      const response = await fetch(`${API_BASE_URL}/chat/room/${roomId}/messages`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data: ApiResponse<ChatMessage[]> = await response.json();
      if (data.status === 'success') {
        setMessages(data.data);
      }
    } catch (error) {
      console.error("Failed to load historical message payload:", error);
    }
  };

  // ==========================================
  // MESSAGE SENDING AGENTS
  // ==========================================
  const sendTextMessage = (): void => {
  if (inputText.trim() === '') return;
  
  const activeSocket = SocketClient.getSocket();
  
  // 🚨 NEW: Check if the socket is ACTUALLY connected to the backend
  if (!activeSocket || !activeSocket.connected) {
    Alert.alert(
      "Disconnected", 
      "Cannot send message. The chat server is currently unreachable."
    );
    return; // Stop the function here so the input text doesn't disappear!
  }

  // If we pass the gate, emit the message
  activeSocket.emit('send_message', {
    roomId,
    text: inputText,
    type: 'TEXT'
  });
  
  // Now it is safe to clear the text
  setInputText('');
};

  const handleImageUpload = async (): Promise<void> => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      alert("Permission to access the camera roll is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const localUri = result.assets[0].uri;
      
      // Execute standard binary form-data upload to HTTP router
      try {
        const token = await SecureStore.getItemAsync('userToken');
        const formData = new FormData();
        
        // TypeScript safe casting for multi-part boundary transmission
        formData.append('file', {
          uri: localUri,
          name: `upload_${Date.now()}.jpg`,
          type: 'image/jpeg',
        } as any);

        const uploadResponse = await fetch(`${API_BASE_URL}/chat/upload`, {
          method: 'POST',
          body: formData,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        });

        const uploadData: ApiResponse<{ fileUrl: string }> = await uploadResponse.json();
        
        if (uploadData.status === 'success') {
          const activeSocket = SocketClient.getSocket();
          if (activeSocket) {
            activeSocket.emit('send_message', {
              roomId,
              text: uploadData.data.fileUrl,
              type: 'IMAGE'
            });
          }
        }
      } catch (err) {
        console.error("Multi-part image processing failed:", err);
      }
    }
  };

  // ==========================================
  // RENDERING PIPELINES
  // ==========================================
  const renderMessageBubble = ({ item }: ListRenderItemInfo<ChatMessage>) => {
    const isMe = item.senderId === currentUserId;

    if (item.type === 'SYSTEM') {
      return (
        <View style={styles.systemBubble}>
          <Text style={styles.systemText}>{item.text}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.bubbleContainer, isMe ? styles.myBubble : styles.theirBubble]}>
        {item.type === 'TEXT' && (
          <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
            {item.text}
          </Text>
        )}
        
        {item.type === 'IMAGE' && (
          <Image source={{ uri: item.text }} style={styles.chatImage} resizeMode="cover" />
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageBubble}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Actionable Input Footer */}
      <View style={styles.inputContainer}>
        <TouchableOpacity onPress={handleImageUpload} style={styles.attachButton} activeOpacity={0.7}>
          <Text style={styles.attachText}>📷</Text>
        </TouchableOpacity>
        
        <TextInput
          style={styles.textInput}
          placeholder="Type a message..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={setInputText}
        />
        
        <TouchableOpacity onPress={sendTextMessage} style={styles.sendButton} activeOpacity={0.8}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ==========================================
// STYLESHEET ARCHITECTURE
// ==========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f4f5' },
  listContent: { padding: 15 },
  
  bubbleContainer: { maxWidth: '80%', borderRadius: 12, padding: 12, marginBottom: 15 },
  myBubble: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  theirBubble: { alignSelf: 'flex-start', backgroundColor: '#E5E5EA' },
  
  messageText: { fontSize: 16, lineHeight: 22 },
  myText: { color: '#ffffff' },
  theirText: { color: '#000000' },
  
  chatImage: { width: 220, height: 180, borderRadius: 8, marginTop: 2 },
  
  systemBubble: { alignSelf: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 10 },
  systemText: { color: '#92400E', fontSize: 13, fontWeight: '600' },
  
  inputContainer: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 45, backgroundColor: '#ffffff', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  textInput: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, color: '#0f172a', fontSize: 15 },
  attachButton: { padding: 8, marginRight: 4 },
  attachText: { fontSize: 22 },
  sendButton: { backgroundColor: '#007AFF', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  sendText: { color: '#ffffff', fontWeight: 'bold', fontSize: 15 }
});