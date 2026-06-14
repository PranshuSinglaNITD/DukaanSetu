import React, { createContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import apiClient from '../api/client';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Check if the user is already logged in when the app opens
  useEffect(() => {
    checkLoginStatus();
  }, []);

  const checkLoginStatus = async () => {
    try {
      // 🚨 Ensure we use exactly 'userToken'
      const token = await SecureStore.getItemAsync('userToken');
      const userData = await SecureStore.getItemAsync('userData');

      if (token && userData) {
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.log("Error checking local storage:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Login Function
  const login = async (phone, password) => {
    try {
      const response = await apiClient.post('/auth/login', { phone, password });
      const { token, user: loggedInUser } = response.data;

      // 🚨 Save exactly to 'userToken'
      await SecureStore.setItemAsync('userToken', token);
      await SecureStore.setItemAsync('userData', JSON.stringify(loggedInUser));

      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(loggedInUser);
      return { success: true };
    } catch (error) {
      console.log("FULL LOGIN ERROR:", error.response?.data || error.message);
      return { success: false, message: error.response?.data?.error || "Login failed" };
    }
  };

  // 3. Register Function
  const registerUser = async (name, phone, password, role, city) => {
    try {
      await apiClient.post('/auth/register', { name, phone, password, role, city });
      return await login(phone, password);
    } catch (error) {
      return { success: false, message: error.response?.data?.error || "Registration failed" };
    }
  };

  // 4. Logout Function
  const logout = async () => {
    // 🚨 Clear exactly 'userToken'
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userData');
    apiClient.defaults.headers.common['Authorization'] = '';
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, registerUser }}>
      {children}
    </AuthContext.Provider>
  );
};