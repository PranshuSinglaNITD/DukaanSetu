import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={toggleSidebar} style={styles.iconButton}>
        <Ionicons name="menu-outline" size={32} color="#2c3e50" />
      </TouchableOpacity>
      <View style={styles.headerTitleContainer}>
        <Text style={styles.headerTitle}>DukaanSetu</Text>
        <Text style={styles.headerSubtitle}>Live Mandi</Text>
      </View>
      <TouchableOpacity style={styles.iconButton}>
        <Ionicons name="notifications-outline" size={26} color="#2c3e50" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f2f6' },
  iconButton: { padding: 5 },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#2c3e50', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: 12, color: '#3498db', fontWeight: '600', textTransform: 'uppercase' },
});