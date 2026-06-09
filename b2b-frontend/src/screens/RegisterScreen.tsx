import React, { useState, useContext, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInputProps,
} from 'react-native';
import { AuthContext } from '../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const SAFFRON = '#f97316';
const NAVY    = '#1e293b';

type Role = 'RETAILER' | 'WHOLESALER';

const ROLES: { key: Role; label: string; icon: string; desc: string }[] = [
  {
    key:   'RETAILER',
    label: 'Retailer',
    icon:  '🏪',
    desc:  'I sell directly to customers',
  },
  {
    key:   'WHOLESALER',
    label: 'Wholesaler',
    icon:  '🏭',
    desc:  'I supply goods in bulk',
  },
];

// ─── Password Strength ────────────────────────────────────────────────────────
const getStrength = (pw: string): { level: number; label: string; color: string } => {
  if (!pw) return { level: 0, label: '', color: '#e2e8f0' };
  let score = 0;
  if (pw.length >= 8)           score++;
  if (/[A-Z]/.test(pw))         score++;
  if (/[0-9]/.test(pw))         score++;
  if (/[^A-Za-z0-9]/.test(pw))  score++;

  const map = [
    { level: 0, label: '',         color: '#e2e8f0' },
    { level: 1, label: 'Weak',     color: '#ef4444' },
    { level: 2, label: 'Fair',     color: '#f97316' },
    { level: 3, label: 'Good',     color: '#eab308' },
    { level: 4, label: 'Strong',   color: '#22c55e' },
  ];
  return map[score] ?? map[0];
};

// ─── Labelled Input (reusable) ────────────────────────────────────────────────
interface LabelledInputProps extends TextInputProps {
  label: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

const LabelledInput = React.forwardRef<TextInput, LabelledInputProps>(
  ({ label, error, prefix, suffix, style, ...props }, ref) => (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={[fieldStyles.row, error ? fieldStyles.rowError : null]}>
        {prefix}
        <TextInput
          ref={ref}
          style={[fieldStyles.input, style]}
          placeholderTextColor="#94a3b8"
          {...props}
        />
        {suffix}
      </View>
      {error ? <Text style={fieldStyles.error}>{error}</Text> : null}
    </View>
  )
);

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label:   { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, letterSpacing: 0.2 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    paddingHorizontal: 12, minHeight: 52,
  },
  rowError:  { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  input:     { flex: 1, fontSize: 16, color: NAVY, paddingVertical: Platform.OS === 'ios' ? 14 : 10 },
  error:     { fontSize: 12, color: '#ef4444', marginTop: 4, marginLeft: 2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function RegisterScreen({ navigation }: any) {
  const [name,        setName]        = useState('');
  const [phone,       setPhone]       = useState('');
  const [city,        setCity]        = useState(''); // 🚨 NEW: City State
  const [password,    setPassword]    = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [role,        setRole]        = useState<Role>('RETAILER');
  const [showPw,      setShowPw]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState<Record<string, string>>({});

  const phoneRef   = useRef<TextInput>(null);
  const cityRef    = useRef<TextInput>(null); // 🚨 NEW: City Ref for Keyboard
  const pwRef      = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  // @ts-ignore
  const { registerUser } = useContext(AuthContext);

  const strength = getStrength(password);

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!name.trim())                    e.name     = 'Full name is required';
    else if (name.trim().length < 2)     e.name     = 'Name is too short';

    const digits = phone.replace(/\D/g, '');
    if (!phone.trim())                   e.phone    = 'Phone number is required';
    else if (digits.length < 10)         e.phone    = 'Enter a valid 10-digit number';

    // 🚨 NEW: City Validation
    if (!city.trim())                    e.city     = 'City is required for weather alerts';

    if (!password)                       e.password = 'Password is required';
    else if (password.length < 6)        e.password = 'Must be at least 6 characters';

    if (!confirmPw)                      e.confirmPw = 'Please confirm your password';
    else if (confirmPw !== password)     e.confirmPw = 'Passwords do not match';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const clearError = (key: string) =>
    setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      // 🚨 Ensure your `registerUser` function in AuthContext expects this 5th parameter!
      const response = await registerUser(
        name.trim(),
        phone.replace(/\D/g, ''),
        password,
        role,
        city.trim() 
      );
      if (!response.success) {
        Alert.alert('Registration Failed', response.message ?? 'Please try again.');
      }
    } catch {
      Alert.alert('Network Error', 'Unable to connect. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Back + Header ──────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Back to Login</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>D</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join the DukaanSetu network</Text>
        </View>

        {/* ── Role Selector ──────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>I am a…</Text>
          <View style={styles.roleRow}>
            {ROLES.map((r) => {
              const active = role === r.key;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.roleCard, active && styles.roleCardActive]}
                  onPress={() => setRole(r.key)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.roleIcon}>{r.icon}</Text>
                  <Text style={[styles.roleLabel, active && styles.roleLabelActive]}>
                    {r.label}
                  </Text>
                  <Text style={[styles.roleDesc, active && styles.roleDescActive]}>
                    {r.desc}
                  </Text>
                  {active && <View style={styles.roleCheck}><Text style={styles.roleCheckText}>✓</Text></View>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Personal Details ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Your Details</Text>

          {/* Full Name */}
          <LabelledInput
            label="Full Name / Shop Name"
            placeholder="e.g. Ramesh Traders"
            value={name}
            onChangeText={(t) => { setName(t); clearError('name'); }}
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
            autoCapitalize="words"
            autoComplete="name"
            error={errors.name}
            prefix={<Text style={styles.inputIcon}>👤</Text>}
          />

          {/* Phone */}
          <LabelledInput
            ref={phoneRef}
            label="Mobile Number"
            placeholder="10-digit number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(t) => { setPhone(t); clearError('phone'); }}
            returnKeyType="next"
            onSubmitEditing={() => cityRef.current?.focus()} // 🚨 Jumps to City
            maxLength={10}
            autoComplete="tel"
            error={errors.phone}
            prefix={
              <View style={styles.phonePrefix}>
                <Text style={styles.phonePrefixText}>🇮🇳 +91</Text>
              </View>
            }
          />

          {/* 🚨 NEW: City Field */}
          <LabelledInput
            ref={cityRef}
            label="City / District"
            placeholder="e.g. Ludhiana, Delhi"
            value={city}
            onChangeText={(t) => { setCity(t); clearError('city'); }}
            returnKeyType="next"
            onSubmitEditing={() => pwRef.current?.focus()} // 🚨 Jumps to Password
            autoCapitalize="words"
            error={errors.city}
            prefix={<Text style={styles.inputIcon}>📍</Text>}
          />

          {/* Password */}
          <LabelledInput
            ref={pwRef}
            label="Password"
            placeholder="Minimum 6 characters"
            secureTextEntry={!showPw}
            value={password}
            onChangeText={(t) => { setPassword(t); clearError('password'); }}
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            autoComplete="new-password"
            error={errors.password}
            prefix={<Text style={styles.inputIcon}>🔒</Text>}
            suffix={
              <TouchableOpacity onPress={() => setShowPw((v) => !v)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 16, color: '#94a3b8' }}>{showPw ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            }
          />

          {/* Password strength bar */}
          {password.length > 0 && (
            <View style={styles.strengthWrapper}>
              <View style={styles.strengthBars}>
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthSegment,
                      { backgroundColor: i <= strength.level ? strength.color : '#e2e8f0' },
                    ]}
                  />
                ))}
              </View>
              {strength.label ? (
                <Text style={[styles.strengthLabel, { color: strength.color }]}>
                  {strength.label}
                </Text>
              ) : null}
            </View>
          )}

          {/* Confirm Password */}
          <LabelledInput
            ref={confirmRef}
            label="Confirm Password"
            placeholder="Re-enter password"
            secureTextEntry={!showConfirm}
            value={confirmPw}
            onChangeText={(t) => { setConfirmPw(t); clearError('confirmPw'); }}
            returnKeyType="done"
            onSubmitEditing={handleRegister}
            autoComplete="new-password"
            error={errors.confirmPw}
            prefix={<Text style={styles.inputIcon}>🔒</Text>}
            suffix={
              <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ fontSize: 16, color: '#94a3b8' }}>{showConfirm ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            }
          />

          {/* Register Button */}
          <TouchableOpacity
            style={[styles.registerBtn, loading && styles.registerBtnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.registerBtnText}> Creating account…</Text>
              </View>
            ) : (
              <Text style={styles.registerBtnText}>Create Account →</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.termsNote}>
            By registering, you agree to our{' '}
            <Text style={styles.termsLink}>Terms of Service</Text>
            {' '}&amp;{' '}
            <Text style={styles.termsLink}>Privacy Policy</Text>
          </Text>
        </View>

        {/* ── Login Link ────────────────────────────────────────────────── */}
        <View style={styles.loginRow}>
          <Text style={styles.loginPrompt}>Already on DukaanSetu? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.loginLink}>Log In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40 },

  // Back
  backBtn:  { marginTop: Platform.OS === 'ios' ? 56 : 20, marginBottom: 4 },
  backText: { fontSize: 14, fontWeight: '600', color: '#64748b' },

  // Header
  header:       { alignItems: 'center', paddingVertical: 20 },
  logoMark: {
    width: 56, height: 56, borderRadius: 14,
    backgroundColor: SAFFRON,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
    shadowColor: SAFFRON, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  logoMarkText: { fontSize: 26, fontWeight: '900', color: '#fff' },
  title:        { fontSize: 26, fontWeight: '800', color: NAVY, letterSpacing: -0.5 },
  subtitle:     { fontSize: 14, color: '#64748b', marginTop: 4 },

  // Card
  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07, shadowRadius: 16, elevation: 4,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13, fontWeight: '800', color: '#94a3b8',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14,
  },

  // Role selector
  roleRow:       { flexDirection: 'row', gap: 12 },
  roleCard: {
    flex: 1, borderWidth: 1.5, borderColor: '#e2e8f0',
    borderRadius: 14, padding: 14, alignItems: 'center',
    backgroundColor: '#f8fafc', position: 'relative',
  },
  roleCardActive: {
    borderColor: SAFFRON, backgroundColor: '#fff7ed',
  },
  roleIcon:       { fontSize: 26, marginBottom: 6 },
  roleLabel:      { fontSize: 14, fontWeight: '800', color: '#475569', marginBottom: 4 },
  roleLabelActive:{ color: SAFFRON },
  roleDesc:       { fontSize: 11, color: '#94a3b8', textAlign: 'center', lineHeight: 15 },
  roleDescActive: { color: '#c2410c' },
  roleCheck: {
    position: 'absolute', top: 8, right: 8,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: SAFFRON, alignItems: 'center', justifyContent: 'center',
  },
  roleCheckText:  { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Input helpers
  inputIcon:    { fontSize: 16, marginRight: 8, color: '#94a3b8' },
  phonePrefix:  { paddingRight: 10, borderRightWidth: 1, borderRightColor: '#e2e8f0', marginRight: 10 },
  phonePrefixText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  eyeBtn:       { paddingLeft: 8 },

  // Strength bar
  strengthWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -8, marginBottom: 16 },
  strengthBars:    { flexDirection: 'row', gap: 4, flex: 1 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 4 },
  strengthLabel:   { fontSize: 12, fontWeight: '700', minWidth: 44 },

  // Register button
  registerBtn: {
    backgroundColor: SAFFRON, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
    shadowColor: SAFFRON, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  registerBtnDisabled: { backgroundColor: '#fdba74', shadowOpacity: 0.1 },
  registerBtnText:     { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  loadingRow:          { flexDirection: 'row', alignItems: 'center' },

  // Terms
  termsNote: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 14, lineHeight: 17 },
  termsLink: { color: SAFFRON, fontWeight: '600' },

  // Login link
  loginRow:    { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  loginPrompt: { fontSize: 15, color: '#64748b' },
  loginLink:   { fontSize: 15, fontWeight: '700', color: SAFFRON },
}); 