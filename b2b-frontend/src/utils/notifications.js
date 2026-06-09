// 🚨 EXPO GO HOTFIX:
// We have commented out 'expo-notifications' entirely because SDK 53+ 
// removed Android push notification support from the Expo Go app.
// Importing it causes a fatal native crash. 
// When you are ready to build a custom APK, uncomment these and rebuild.

// import * as Device from 'expo-device';
// import * as Notifications from 'expo-notifications';
// import Constants from 'expo-constants';
import { Platform } from 'react-native';
// import apiClient from '../api/client';

/**
 * Dummy function for Expo Go.
 * In a real Dev Build, this requests permissions and saves the token to the DB.
 */
export async function registerForPushNotificationsAsync() {
  console.log('⚠️ Running in Expo Go: Hardware Push Notifications are temporarily disabled to prevent crashes.');
  return null;
}

/**
 * Dummy function for Expo Go.
 * In a real Dev Build, this listens for the user tapping a notification.
 */
export function setupNotificationListener(navigation) {
  console.log('⚠️ Running in Expo Go: Notification tap listeners are disabled.');
  
  // Return a dummy cleanup function so the useEffect doesn't crash on unmount
  return () => {
     // Cleanup logic would go here in a dev build
  };
}