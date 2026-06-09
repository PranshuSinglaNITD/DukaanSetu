import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '../api/client';

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      // You'll need a quick GET route in your backend for this!
      const response = await apiClient.get('/notifications'); 
      setNotifications(response.data.data);
    } catch (error) {
      console.log(error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'DEAL': return { name: 'pricetag', color: '#27ae60' };
      case 'WEATHER': return { name: 'thunderstorm', color: '#f39c12' };
      case 'NEGOTIATION': return { name: 'chatbubbles', color: '#3498db' };
      default: return { name: 'notifications', color: '#7f8c8d' };
    }
  };

  return (
    <View style={styles.container}>
       <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#2c3e50" />
          </TouchableOpacity>
          <Text style={styles.title}>Updates & Alerts</Text>
          <View style={{width: 24}}/>
       </View>

      <FlatList
        data={notifications}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => {
          const icon = getIcon(item.type);
          return (
            <View style={[styles.card, !item.isRead && styles.unread]}>
              <View style={styles.iconBox}>
                <Ionicons name={icon.name as any} size={24} color={icon.color} />
              </View>
              <View style={styles.textContainer}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMessage}>{item.message}</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff', elevation: 2 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50' },
  card: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, marginHorizontal: 15, marginTop: 10, borderRadius: 10, elevation: 1 },
  unread: { backgroundColor: '#eaf2f8', borderLeftWidth: 4, borderLeftColor: '#3498db' },
  iconBox: { marginRight: 15, justifyContent: 'center' },
  textContainer: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 },
  cardMessage: { fontSize: 13, color: '#64748b' }
});