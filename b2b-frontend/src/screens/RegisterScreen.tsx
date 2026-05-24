import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { AuthContext } from '../context/AuthContext';

export default function RegisterScreen({ navigation }: any) { 
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('RETAILER');
  const [loading, setLoading] = useState(false);

  // @ts-ignore
  const { registerUser } = useContext(AuthContext);

  const handleRegister = async () => {
    if (!name || !phone || !password) return Alert.alert('Error', 'Please fill all fields');

    setLoading(true);
    const response = await registerUser(name, phone, password, role);
    setLoading(false);

    if (!response.success) Alert.alert('Registration Failed', response.message);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>
      <Text style={styles.subtitle}>Join the DukaanSetu network</Text>

      <View style={styles.roleContainer}>
        <TouchableOpacity style={[styles.roleButton, role === 'RETAILER' && styles.activeRole]} onPress={() => setRole('RETAILER')}>
          <Text style={[styles.roleText, role === 'RETAILER' && styles.activeRoleText]}>Retailer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.roleButton, role === 'WHOLESALER' && styles.activeRole]} onPress={() => setRole('WHOLESALER')}>
          <Text style={[styles.roleText, role === 'WHOLESALER' && styles.activeRoleText]}>Wholesaler</Text>
        </TouchableOpacity>
      </View>

      <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Phone Number" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />

      <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Register</Text>}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.linkText}>Already have an account? Log In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f8f9fa' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#2c3e50', textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#7f8c8d', textAlign: 'center', marginBottom: 30 },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  roleButton: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, alignItems: 'center', marginHorizontal: 5 },
  activeRole: { backgroundColor: '#3498db', borderColor: '#3498db' },
  roleText: { color: '#7f8c8d', fontWeight: 'bold' },
  activeRoleText: { color: '#fff' },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#ddd', fontSize: 16 },
  button: { backgroundColor: '#2ecc71', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkText: { color: '#3498db', textAlign: 'center', fontSize: 16, marginTop: 20 }
});