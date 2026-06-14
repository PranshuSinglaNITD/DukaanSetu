import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Voice, { SpeechResultsEvent, SpeechErrorEvent } from '@react-native-voice/voice';
import apiClient from '../api/client'; // Adjust path if needed

export default function VoiceAssistantScreen({ navigation }: any) {
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState<any>(null);

  // 🎤 Initialize Voice Listeners
  useEffect(() => {
    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    
    // As the user speaks, update the text on screen
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (e.value && e.value.length > 0) {
        setSpokenText(e.value[0]); 
      }
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      setIsListening(false);
      if (e.error?.message !== '7/No match') { // Ignore silent timeout errors
        Alert.alert("Microphone Error", "Could not hear you properly. Try again.");
      }
    };

    // Cleanup when leaving the screen
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  // ▶️ Start Listening
  const startRecording = async () => {
    setSpokenText('');
    setAiResponse(null);
    try {
      // 'hi-IN' is crucial here! It tells Android to expect Hindi/Hinglish
      await Voice.start('hi-IN');
    } catch (error) {
      console.error(error);
    }
  };

  // ⏹️ Stop Listening & Send to Backend
  const stopRecordingAndProcess = async () => {
    try {
      await Voice.stop();
      setIsListening(false);
      
      if (!spokenText) return; // Don't send if they didn't say anything

      setIsProcessing(true);

      // 🚀 Send to our new Gemini Backend Route
      const response = await apiClient.post('/voice/process', {
        spokenText: spokenText
      });

      if (response.data.status === 'success') {
        setAiResponse(response.data.extractedData);
        Alert.alert("Success! 🎉", response.data.message);
      }
    } catch (error: any) {
      console.error("API Error:", error);
      Alert.alert("Error", error.response?.data?.error || "MandiBrain could not process this.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={28} color="#2c3e50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>MandiBrain Assistant</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instructions}>
          Hold the microphone and speak naturally in Hindi or English.
        </Text>
        <Text style={styles.exampleText}>
          Try saying: "Ravi ko 2 kilo gehu diya 100 rupaye mein udhaar par"
        </Text>

        {/* Live Text Display */}
        <View style={styles.transcriptBox}>
          <Text style={[styles.transcriptText, !spokenText && { color: '#bdc3c7' }]}>
            {spokenText || "Waiting for you to speak..."}
          </Text>
        </View>

        {/* AI Action Result Banner */}
        {aiResponse && (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>✅ Saved to Database</Text>
            <Text style={styles.successDetail}>Action: <Text style={styles.bold}>{aiResponse.transactionType}</Text></Text>
            <Text style={styles.successDetail}>Name: <Text style={styles.bold}>{aiResponse.partyName}</Text></Text>
            <Text style={styles.successDetail}>Amount: <Text style={styles.bold}>₹{aiResponse.totalAmount}</Text></Text>
            <Text style={styles.successDetail}>Status: <Text style={[styles.bold, {color: aiResponse.paymentStatus === 'UNPAID' ? '#e74c3c' : '#27ae60'}]}>{aiResponse.paymentStatus}</Text></Text>
          </View>
        )}
      </View>

      {/* The Giant Microphone Button */}
      <View style={styles.footer}>
        {isProcessing ? (
          <View style={styles.processingBox}>
            <ActivityIndicator size="large" color="#8e44ad" />
            <Text style={styles.processingText}>MandiBrain is thinking...</Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.micButton, isListening && styles.micButtonActive]}
            onPressIn={startRecording}
            onPressOut={stopRecordingAndProcess}
          >
            <Ionicons name={isListening ? "mic" : "mic-outline"} size={50} color="#fff" />
          </TouchableOpacity>
        )}
        <Text style={styles.micHint}>
          {isListening ? "Release to process..." : "Press and hold to speak"}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15 },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#8e44ad' },
  
  content: { flex: 1, padding: 20, alignItems: 'center', marginTop: 20 },
  instructions: { fontSize: 16, color: '#2c3e50', textAlign: 'center', fontWeight: '600' },
  exampleText: { fontSize: 13, color: '#7f8c8d', textAlign: 'center', marginTop: 8, fontStyle: 'italic', marginBottom: 40 },
  
  transcriptBox: { width: '100%', minHeight: 120, backgroundColor: '#fff', borderRadius: 16, padding: 20, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  transcriptText: { fontSize: 22, color: '#2c3e50', fontWeight: '500', lineHeight: 30 },

  successBox: { width: '100%', backgroundColor: '#e8f8f5', padding: 20, borderRadius: 16, marginTop: 20, borderWidth: 1, borderColor: '#1abc9c' },
  successTitle: { fontSize: 16, fontWeight: 'bold', color: '#16a085', marginBottom: 10 },
  successDetail: { fontSize: 14, color: '#2c3e50', marginBottom: 4 },
  bold: { fontWeight: 'bold' },

  footer: { paddingBottom: 50, alignItems: 'center' },
  micButton: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#8e44ad', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#8e44ad', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
  micButtonActive: { backgroundColor: '#e74c3c', transform: [{ scale: 1.1 }] },
  micHint: { marginTop: 15, fontSize: 14, color: '#7f8c8d', fontWeight: '500' },
  
  processingBox: { alignItems: 'center', height: 90, justifyContent: 'center' },
  processingText: { marginTop: 10, fontSize: 14, color: '#8e44ad', fontWeight: 'bold' }
});