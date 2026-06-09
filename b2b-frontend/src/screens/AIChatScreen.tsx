import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../api/client';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: string; 
}

const QUICK_ACTIONS = [
  { id: '1', label: '📊 Check Stock', query: 'Check my inventory and items near expiry.' },
  { id: '2', label: '⛈️ Weather Risks', query: 'Are there any weather risks for my city today?' },
  { id: '3', label: '🌾 Market Trends', query: 'What are the daily mandi price trends?' },
];

const WELCOME_MSG: Message = {
  id: 'welcome',
  text: 'Namaste! I am MandiBrain. Ask me about your inventory status, daily mandi prices, or local weather risks.',
  sender: 'ai',
  timestamp: new Date().toISOString(),
};

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadChatSession();
  }, []);

  const loadChatSession = async () => {
    try {
      const savedMessages = await AsyncStorage.getItem('@mandi_chat_history');
      const savedSession = await AsyncStorage.getItem('@mandi_chat_session');

      if (savedMessages) {
        setMessages(JSON.parse(savedMessages));
      }
      
      if (savedSession) {
        setSessionId(savedSession);
      } else {
        const newSession = Date.now().toString();
        setSessionId(newSession);
        await AsyncStorage.setItem('@mandi_chat_session', newSession);
      }
    } catch (error) {
      // 🚨 CRASH NET: If AsyncStorage is missing native links, catch the error and keep app running!
      console.warn("⚠️ AsyncStorage Native Module missing. Chat history will not save between reloads.");
      setSessionId(Date.now().toString()); // Set in memory instead
    }
  };

  const saveMessagesToStorage = async (newMessages: Message[]) => {
    setMessages(newMessages); // Always update UI
    try {
      await AsyncStorage.setItem('@mandi_chat_history', JSON.stringify(newMessages));
    } catch (error) {
      // Ignore storage error to prevent red screen crash
    }
  };

  const handleClearChat = () => {
    Alert.alert(
      "Clear Chat History",
      "Are you sure you want to clear this conversation? The AI will forget the context of this chat.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Clear", 
          style: "destructive", 
          onPress: async () => {
            const newSession = Date.now().toString(); 
            setSessionId(newSession);
            setMessages([WELCOME_MSG]);
            try {
              await AsyncStorage.setItem('@mandi_chat_session', newSession);
              await AsyncStorage.setItem('@mandi_chat_history', JSON.stringify([WELCOME_MSG]));
            } catch (error) {
              console.log("Storage skipped on clear");
            }
          }
        }
      ]
    );
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: textToSend,
      sender: 'user',
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    await saveMessagesToStorage(updatedMessages);
    
    setInputText('');
    setIsLoading(true);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await apiClient.post('/ai', { 
        message: textToSend,
        sessionId: sessionId 
      });
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: response.data.reply || 'Something went wrong. Please try again.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };

      await saveMessagesToStorage([...updatedMessages, aiMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Unable to connect to MandiBrain. Please check your internet connection.',
        sender: 'ai',
        timestamp: new Date().toISOString(),
      };
      await saveMessagesToStorage([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isAi = item.sender === 'ai';
    const timeString = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return (
      <View style={[styles.messageRow, isAi ? styles.aiRow : styles.userRow]}>
        {isAi && (
          <View style={styles.avatarCircle}>
            <MaterialCommunityIcons name="brain" size={18} color="#FFF" />
          </View>
        )}
        <View style={[styles.messageBubble, isAi ? styles.aiBubble : styles.userBubble]}>
          <Text style={[styles.messageText, isAi ? styles.aiText : styles.userText]}>
            {item.text}
          </Text>
          <Text style={[styles.timeText, isAi ? styles.aiTime : styles.userTime]}>
            {timeString}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconContainer}>
            <MaterialCommunityIcons name="brain" size={24} color="#1b4d3e" />
          </View>
          <View>
            <Text style={styles.headerTitle}>MandiBrain AI</Text>
            <View style={styles.statusContainer}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Your Business Partner</Text>
            </View>
          </View>
        </View>
        
        <TouchableOpacity style={styles.clearButton} onPress={handleClearChat}>
          <Ionicons name="trash-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Chat History Area */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessageItem}
        contentContainerStyle={styles.chatListContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Loading Indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#1b4d3e" />
          <Text style={styles.loadingText}>MandiBrain is thinking...</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.chipsWrapper}>
          <FlatList
            horizontal
            data={QUICK_ACTIONS}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsContainer}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.chipButton}
                onPress={() => handleSend(item.query)}
                disabled={isLoading}
              >
                <Text style={styles.chipText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask MandiBrain anything..."
            placeholderTextColor="#8e8e93"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            editable={!isLoading}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() ? styles.sendButtonDisabled : styles.sendButtonActive,
            ]}
            onPress={() => handleSend(inputText)}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fa' },
  header: { height: 60, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#eef2f3', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerIconContainer: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#e8f5e9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  statusContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4caf50', marginRight: 4 },
  statusText: { fontSize: 11, color: '#666' },
  clearButton: { padding: 8, backgroundColor: '#fef2f2', borderRadius: 20 },
  chatListContent: { paddingHorizontal: 16, paddingVertical: 16 },
  messageRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  aiRow: { justifyContent: 'flex-start' },
  userRow: { justifyContent: 'flex-end' },
  avatarCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1b4d3e', justifyContent: 'center', alignItems: 'center', marginRight: 8, marginBottom: 4 },
  messageBubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  aiBubble: { backgroundColor: '#FFF', borderTopLeftRadius: 4, borderWidth: 1, borderBottomWidth: 1.5, borderColor: '#e2e8f0' },
  userBubble: { backgroundColor: '#1b4d3e', borderTopRightRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  aiText: { color: '#2d3748' },
  userText: { color: '#FFF' },
  timeText: { fontSize: 10, marginTop: 4, textAlign: 'right' },
  aiTime: { color: '#a0aec0' },
  userTime: { color: '#a3b899' },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, backgroundColor: 'transparent' },
  loadingText: { fontSize: 13, color: '#718096', marginLeft: 8 },
  chipsWrapper: { backgroundColor: '#f7f9fa', paddingTop: 8 },
  chipsContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  chipButton: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 1 },
  chipText: { fontSize: 13, color: '#334155', fontWeight: '500' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  textInput: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 8, paddingTop: 8, fontSize: 15, color: '#1e293b', maxHeight: 100 },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
  sendButtonActive: { backgroundColor: '#1b4d3e' },
  sendButtonDisabled: { backgroundColor: '#cbd5e1' },
});