import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, Alert, Animated, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
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
  { id: '1', icon: 'chart-line',             label: 'Sales & Profit', query: 'Analyze my sales, revenue, and profit for the last 30 days.' },
  { id: '2', icon: 'crystal-ball',            label: 'Best Buys',      query: 'Based on upcoming weather and live market, what should I buy right now?' },
  { id: '3', icon: 'weather-lightning-rainy', label: 'Weather Risk',   query: 'What is the exact weather forecast and risk for my city?' },
];

const WELCOME_MSG: Message = {
  id: 'welcome',
  text: 'Namaste! I am **MandiBrain**.\n\nAsk me to:\n* Analyze your 30-day profits\n* Check local weather risks\n* Predict the best crops to source today',
  sender: 'ai',
  timestamp: new Date().toISOString(),
};

// ─── Inline bold parser ───────────────────────────────────────────────────────
function renderInline(line: string, boldColor: string, baseColor: string): React.ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <Text key={i} style={{ fontWeight: '800', color: boldColor }}>{part.slice(2, -2)}</Text>
      : <Text key={i} style={{ color: baseColor }}>{part}</Text>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
const MarkdownText = ({ text, isUser }: { text: string; isUser: boolean }) => {
  const base = isUser ? '#fff' : '#1e293b';
  const bold = isUser ? '#fff' : '#0f172a';

  return (
    <View style={{ gap: 6 }}>
      {text.split(/\n{2,}/).map((block, bi) => {
        const lines = block.split('\n');
        const isList = lines.every(l => l.trimStart().startsWith('* ') || l.trim() === '');

        if (isList) {
          return (
            <View key={bi} style={{ gap: 5 }}>
              {lines.filter(l => l.trim()).map((line, li) => (
                <View key={li} style={styles.bulletRow}>
                  <View style={[styles.bulletDot, { backgroundColor: isUser ? 'rgba(255,255,255,0.65)' : '#059669' }]} />
                  <Text style={[styles.mdBase, { color: base, flex: 1 }]}>
                    {renderInline(line.replace(/^\s*\*\s*/, ''), bold, base)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        return (
          <Text key={bi} style={[styles.mdBase, { color: base }]}>
            {lines.map((line, li) => (
              <React.Fragment key={li}>
                {li > 0 ? '\n' : null}
                {renderInline(line, bold, base)}
              </React.Fragment>
            ))}
          </Text>
        );
      })}
    </View>
  );
};

// ─── Typing indicator ─────────────────────────────────────────────────────────
const TypingIndicator = () => {
  const dots = [0,1,2].map(() => useRef(new Animated.Value(0)).current);
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.timing(d, { toValue: -6, duration: 280, useNativeDriver: true }),
        Animated.timing(d, { toValue:  0, duration: 280, useNativeDriver: true }),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.typingRow}>
      <LinearGradient colors={['#052e16','#059669']} style={styles.aiAvatar}>
        <MaterialCommunityIcons name="brain" size={14} color="#fff" />
      </LinearGradient>
      <View style={styles.typingBubble}>
        <Text style={styles.typingLabel}>MandiBrain is thinking</Text>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {dots.map((d, i) => (
            <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: d }] }]} />
          ))}
        </View>
      </View>
    </View>
  );
};

// ─── Message bubble ───────────────────────────────────────────────────────────
const MessageBubble = ({ item }: { item: Message }) => {
  const isAi   = item.sender === 'ai';
  const opacity = useRef(new Animated.Value(0)).current;
  const slideY  = useRef(new Animated.Value(10)).current;
  const scale   = useRef(new Animated.Value(0.97)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(slideY,  { toValue: 0, useNativeDriver: true, speed: 24, bounciness: 5 }),
      Animated.spring(scale,   { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 5 }),
    ]).start();
  }, []);

  const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Animated.View style={[styles.msgRow, isAi ? styles.aiRow : styles.userRow, { opacity, transform: [{ translateY: slideY },{ scale }] }]}>
      {isAi && (
        <LinearGradient colors={['#052e16','#059669']} style={[styles.aiAvatar, { marginBottom: 22 }]}>
          <MaterialCommunityIcons name="brain" size={14} color="#fff" />
        </LinearGradient>
      )}

      <View style={{ maxWidth: '82%' }}>
        {isAi ? (
          <View style={styles.aiBubble}>
            <MarkdownText text={item.text} isUser={false} />
            <Text style={styles.aiTime}>{time}</Text>
            <View style={styles.tailLeft} />
          </View>
        ) : (
          <LinearGradient colors={['#052e16','#0a5e40']} style={styles.userBubble} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <MarkdownText text={item.text} isUser />
            <Text style={styles.userTime}>{time}</Text>
            <View style={styles.tailRight} />
          </LinearGradient>
        )}
      </View>
    </Animated.View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ChatScreen({ navigation }: any) {
  const [messages,  setMessages]  = useState<Message[]>([WELCOME_MSG]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => { loadSession(); }, []);

  const loadSession = async () => {
    try {
      const [saved, session] = await Promise.all([
        AsyncStorage.getItem('@mandi_chat_history'),
        AsyncStorage.getItem('@mandi_chat_session'),
      ]);
      if (saved)   setMessages(JSON.parse(saved));
      if (session) setSessionId(session);
      else {
        const id = Date.now().toString();
        setSessionId(id);
        await AsyncStorage.setItem('@mandi_chat_session', id);
      }
    } catch { setSessionId(Date.now().toString()); }
  };

  const save = async (msgs: Message[]) => {
    setMessages(msgs);
    try { await AsyncStorage.setItem('@mandi_chat_history', JSON.stringify(msgs)); } catch {}
  };

  const scrollDown = () =>
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

  const handleClear = () =>
    Alert.alert('Clear Chat', "AI will forget this conversation's context.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
          const id = Date.now().toString();
          setSessionId(id);
          await save([WELCOME_MSG]);
          try { await AsyncStorage.setItem('@mandi_chat_session', id); } catch {}
      }},
    ]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), text, sender: 'user', timestamp: new Date().toISOString() };
    const next = [...messages, userMsg];
    await save(next);
    setInputText('');
    setIsLoading(true);
    scrollDown();
    try {
      const res = await apiClient.post('/ai', { message: text, sessionId });
      await save([...next, { id: (Date.now()+1).toString(), text: res.data.reply || 'Something went wrong.', sender: 'ai', timestamp: new Date().toISOString() }]);
    } catch {
      await save([...next, { id: (Date.now()+1).toString(), text: 'Unable to connect to MandiBrain. Please check your connection.', sender: 'ai', timestamp: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
      scrollDown();
    }
  };

  const canSend = inputText.trim().length > 0 && !isLoading;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>

      {/* ── Header ── */}
      <LinearGradient colors={['#052e16','#065f46','#0a7a57']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
        <View style={styles.headerBlob} />
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation?.goBack()}>
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <View style={styles.brainRing}>
            <MaterialCommunityIcons name="brain" size={20} color="#fbbf24" />
          </View>
          <View>
            <Text style={styles.headerTitle}>MandiBrain AI</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Powered by LangGraph</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={handleClear}>
          <Ionicons name="trash-outline" size={18} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Messages ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={i => i.id}
        renderItem={({ item }) => <MessageBubble item={item} />}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={scrollDown}
        ListFooterComponent={isLoading ? <TypingIndicator /> : null}
        showsVerticalScrollIndicator={false}
      />

      {/* ── Bottom ── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {/* Quick chips */}
        <View style={styles.chipsWrap}>
          <FlatList
            horizontal
            data={QUICK_ACTIONS}
            keyExtractor={i => i.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsList}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
                onPress={() => handleSend(item.query)}
                disabled={isLoading}
              >
                <MaterialCommunityIcons name={item.icon as any} size={13} color="#059669" />
                <Text style={styles.chipText}>{item.label}</Text>
              </Pressable>
            )}
          />
        </View>

        {/* Input */}
        <View style={styles.inputRow}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Ask MandiBrain anything…"
              placeholderTextColor="#94a3b8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              editable={!isLoading}
            />
            {inputText.length > 0 && (
              <Text style={styles.charCount}>{inputText.length}/500</Text>
            )}
          </View>
          <TouchableOpacity onPress={() => handleSend(inputText)} disabled={!canSend} activeOpacity={0.8}>
            {canSend ? (
              <LinearGradient colors={['#052e16','#059669']} style={styles.sendBtn}>
                <Ionicons name="send" size={17} color="#fff" />
              </LinearGradient>
            ) : (
              <View style={[styles.sendBtn, styles.sendOff]}>
                <Ionicons name="send" size={17} color="#94a3b8" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0ede8' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12, overflow: 'hidden',
    shadowColor: '#052e16', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  headerBlob: { position: 'absolute', right: -30, top: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(245,158,11,0.1)' },
  headerBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  headerMid: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brainRing: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(251,191,36,0.15)', borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.35)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399' },
  onlineText: { fontSize: 10, color: '#a7f3d0', fontWeight: '500' },

  listContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },

  msgRow: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  aiRow:  { justifyContent: 'flex-start' },
  userRow:{ justifyContent: 'flex-end' },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 8 },

  aiBubble: {
    backgroundColor: '#fff', borderRadius: 18, borderTopLeftRadius: 4, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  userBubble: { borderRadius: 18, borderTopRightRadius: 4, padding: 14 },

  tailLeft:  { position: 'absolute', left: -5,  top: 0, width: 0, height: 0, borderTopWidth: 8, borderRightWidth: 8, borderTopColor: '#fff',    borderRightColor: 'transparent' },
  tailRight: { position: 'absolute', right: -5, top: 0, width: 0, height: 0, borderTopWidth: 8, borderLeftWidth: 8,  borderTopColor: '#052e16', borderLeftColor: 'transparent' },

  aiTime:   { fontSize: 10, color: '#94a3b8', marginTop: 8, textAlign: 'right' },
  userTime: { fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 8, textAlign: 'right' },

  // Markdown
  mdBase:    { fontSize: 14, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },

  // Typing
  typingRow:    { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, marginBottom: 14 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 11, gap: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  typingLabel:  { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  dot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: '#059669' },

  // Chips
  chipsWrap:  { backgroundColor: '#f0ede8', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e0d8cf' },
  chipsList:  { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  chip:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  chipPressed:{ backgroundColor: '#ecfdf5' },
  chipText:   { fontSize: 12, color: '#065f46', fontWeight: '700' },

  // Input
  inputRow:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 10 },
  inputWrap: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 22, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 10 },
  input:     { fontSize: 14, color: '#1e293b', maxHeight: 100, textAlignVertical: 'top', includeFontPadding: false },
  charCount: { fontSize: 10, color: '#94a3b8', textAlign: 'right', marginTop: 2 },
  sendBtn:   { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendOff:   { backgroundColor: '#f1f5f9' },
});