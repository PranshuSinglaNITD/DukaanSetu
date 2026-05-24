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

const Stack = createNativeStackNavigator();

const AppNavigator = () => {
  const { user, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          /* USER IS LOGGED IN: Show Marketplace Stack */
          <>
            <Stack.Screen name="Landing" component={LandingScreen} />
            <Stack.Screen name="Marketplace" component={HomeScreen} />
            <Stack.Screen name="AddProduct" component={AddProductScreen} />
            <Stack.Screen name="AddProperty" component={AddPropertyScreen} />
            <Stack.Screen name="Inventory" component={InventoryScreen} />
            <Stack.Screen
              name="InventoryDetail"
              component={InventoryDetailScreen}
              options={{ presentation: 'modal', headerShown: false }}
            />
            <Stack.Screen name="ProductDetail" component={ProductDetailScreen}></Stack.Screen>
          </>
        ) : (
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