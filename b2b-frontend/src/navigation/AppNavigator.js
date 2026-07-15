import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { AuthContext } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import AddProductScreen from '../screens/AddProductScreen';
import AddPropertyScreen from '@/screens/AddPropertyScreen';
import LandingScreen from '@/screens/LandingScreen';
import InventoryDetailScreen from '@/screens/InventoryDetailScreen';
import InventoryScreen from '@/screens/InventoryScreen';
import ProductDetailScreen from '@/screens/ProductDetailScreen';
import NegotiationDetailScreen from '@/screens/NegotiationDetailScreen';
import NegotiationsScreen from '@/screens/NegotiationsScreen';
import DispatchSetupScreen from '@/screens/DispatchSetupScreen';
import LiveTrackingScreen from '@/screens/LiveTrackingScreen';
import SellerSalesScreen from '@/screens/SellerSalesScreen';
import BuyerOrdersScreen from '@/screens/BuyerOrdersScreen';
import ChatScreen from '@/screens/AIChatScreen';
import AnalyticsScreen from '@/screens/AnalyticsScreen';
import LedgerPreviewScreen from '@/screens/LedgerPreviewScreen';
import KhataScreen from '@/screens/KhataScreen';
import QualityCheckScreen from '@/screens/QualityCheckScreen';
import MandiPulseScreen from '@/screens/MandiPulseScreen';
import ReviewForm from '@/screens/ReviewForm';
import MyReviewsScreen from '@/screens/MyReviewsScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  const role = user?.role || 'FARMER';
  
  const isFarmer = role === 'FARMER';
  const isWholesaler = role === 'WHOLESALER';
  const isRetailer = role === 'RETAILER';

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            {/* ========================================== */}
            {/* 1. UNIVERSAL SCREENS (Everyone sees these) */}
            {/* ========================================== */}
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Marketplace" component={HomeScreen} />
            <Stack.Screen name="Negotiations" component={NegotiationsScreen} />
            <Stack.Screen name="NegotiationDetail" component={NegotiationDetailScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="AddProperty" component={AddPropertyScreen} />
            <Stack.Screen name="MandiPulse" component={MandiPulseScreen} />
            <Stack.Screen name="MyReviews" component={MyReviewsScreen} />
            <Stack.Screen name="ReviewForm" component={ReviewForm} />

            {/* ========================================== */}
            {/* 2. SUPPLY SIDE (Farmers & Wholesalers)     */}
            {/* ========================================== */}
            {(isFarmer || isWholesaler) && (
              <>
                <Stack.Screen name="AddProduct" component={AddProductScreen} />
                <Stack.Screen name="Inventory" component={InventoryScreen} />
                <Stack.Screen 
                  name="InventoryDetail" 
                  component={InventoryDetailScreen} 
                  options={{ presentation: 'modal', headerShown: false }} 
                />
                <Stack.Screen name="SellerSales" component={SellerSalesScreen} />
                <Stack.Screen name="Khata" component={KhataScreen} />
                <Stack.Screen name="DispatchSetup" component={DispatchSetupScreen} />
              
              </>
            )}

            {/* ========================================== */}
            {/* 3. DEMAND SIDE (Retailers & Wholesalers)   */}
            {/* ========================================== */}
            {(isRetailer || isWholesaler) && (
              <>
                {/* 🚨 ProductDetailScreen moved here */}
                <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
                <Stack.Screen name="BuyerOrders" component={BuyerOrdersScreen} />
                <Stack.Screen name="LiveTracking" component={LiveTrackingScreen} />
                <Stack.Screen name="Analytics" component={AnalyticsScreen} />
                <Stack.Screen name="Ledger" component={LedgerPreviewScreen} />
              </>
            )}

            {isRetailer && (
              <Stack.Screen name="Quality" component={QualityCheckScreen} />
            )}
          </>
        ) : (
          /* ========================================== */
          /* UNAUTHENTICATED STACK                      */
          /* ========================================== */
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;