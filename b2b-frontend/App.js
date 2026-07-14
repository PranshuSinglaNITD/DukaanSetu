import React from 'react';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import NetInfo from '@react-native-community/netinfo'
import { SyncManager } from './src/utils/SyncManager';
import { useEffect } from 'react';
export default function App() {
  useEffect(() => {
    // This listens for network changes constantly in the background
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        console.log("Internet restored! Triggering queue flush...");
        SyncManager.processQueue();
      }
    });

    return () => unsubscribe();
  }, []);
  return (
    <AuthProvider>
      <AppNavigator />
    </AuthProvider>
  );
}