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

// ─── Inline SVG-style icons using Unicode/emoji fallbacks ─────────────────────
// Replace with react-native-vector-icons or lucide-react-native if available
const EyeIcon = ({ visible }: { visible: boolean }) => (
  <Text style={{ fontSize: 18, color: '#94a3b8' }}>{visible ? '🙈' : '👁️'}</Text>
);

// ─── Trust Badge Component ─────────────────────────────────────────────────────
const TrustBadge = ({ icon, label }: { icon: string; label: string }) => (
  <View style={styles.badge}>
    <Text style={styles.badgeIcon}>{icon}</Text>
    <Text style={styles.badgeText}>{label}</Text>
  </View>
);

// ─── Labelled Input Component ──────────────────────────────────────────────────
interface LabelledInputProps extends TextInputProps {
  label: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

const LabelledInput = React.forwardRef<TextInput, LabelledInputProps>(
  ({ label, error, prefix, suffix, style, ...props }, ref) => (
    <View style={styles.fieldWrapper}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, error ? styles.inputRowError : null]}>
        {prefix}
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor="#94a3b8"
          {...props}
        />
        {suffix}
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  )
);

LabelledInput.displayName = 'LabelledInput';

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LoginScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({});

  const passwordRef = useRef<TextInput>(null);

  // @ts-ignore
  const { login } = useContext(AuthContext);

  // ── Validation ───────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    const digits = phone.replace(/\D/g, '');

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (digits.length < 10) {
      newErrors.phone = 'Enter a valid 10-digit phone number';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 4) {
      newErrors.password = 'Password seems too short';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await login(phone.replace(/\D/g, ''), password);
      if (!response.success) {
        Alert.alert('Login Failed', response.message ?? 'Please check your credentials and try again.');
      }
      // On success, AppNavigator automatically switches to HomeScreen
    } catch {
      Alert.alert('Network Error', 'Unable to connect. Please check your internet connection.');
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
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>D</Text>
          </View>
          <Text style={styles.title}>DukaanSetu</Text>
          <Text style={styles.subtitle}>B2B Wholesale Marketplace</Text>
          <Text style={styles.tagline}>Connecting Retailers · Wholesalers · Distributors</Text>
        </View>

        {/* ── Trust Badges ───────────────────────────────────────────────────── */}
        <View style={styles.badgeRow}>
          <TrustBadge icon="🏪" label="50K+ Shops" />
          <TrustBadge icon="📦" label="Bulk Orders" />
          <TrustBadge icon="💸" label="Best Rates" />
        </View>

        {/* ── Form Card ──────────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>
          <Text style={styles.cardSubtitle}>Log in to manage your business</Text>

          {/* Phone Input */}
          <LabelledInput
            label="Mobile Number"
            placeholder="Enter 10-digit number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(t) => {
              setPhone(t);
              if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
            }}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            maxLength={10}
            autoComplete="tel"
            error={errors.phone}
            prefix={
              <View style={styles.phonePrefix}>
                <Text style={styles.phonePrefixText}>🇮🇳 +91</Text>
              </View>
            }
          />

          {/* Password Input */}
          <LabelledInput
            ref={passwordRef}
            label="Password"
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
            }}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            autoComplete="password"
            error={errors.password}
            suffix={
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <EyeIcon visible={showPassword} />
              </TouchableOpacity>
            }
          />

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotWrapper}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.loginButtonText}> Logging in…</Text>
              </View>
            ) : (
              <Text style={styles.loginButtonText}>Log In →</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Register Link ──────────────────────────────────────────────────── */}
        <View style={styles.registerRow}>
          <Text style={styles.registerPrompt}>New to DukaanSetu? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLink}>Create Account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>
          For wholesalers, retailers &amp; distributors across India
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const SAFFRON = '#f97316';   // energetic, marketplace feel
const NAVY    = '#1e293b';   // trust, authority
const CARD_BG = '#ffffff';

const styles = StyleSheet.create({
  flex:   { flex: 1, backgroundColor: '#f1f5f9' },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32 },

  // Header
  header: { alignItems: 'center', paddingTop: 56, paddingBottom: 20 },
  logoMark: {
    width: 60, height: 60, borderRadius: 16,
    backgroundColor: SAFFRON,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
    shadowColor: SAFFRON, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
  },
  logoMarkText: { fontSize: 30, fontWeight: '900', color: '#fff' },
  title:    { fontSize: 28, fontWeight: '800', color: NAVY, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: '600', color: SAFFRON, marginTop: 2, letterSpacing: 0.5 },
  tagline:  { fontSize: 12, color: '#64748b', marginTop: 6, textAlign: 'center' },

  // Trust badges
  badgeRow:  { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20 },
  badge:     { alignItems: 'center', backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  badgeIcon: { fontSize: 16 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#475569', marginTop: 2 },

  // Card
  card: {
    backgroundColor: CARD_BG, borderRadius: 20, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 5,
    marginBottom: 20,
  },
  cardTitle:    { fontSize: 22, fontWeight: '800', color: NAVY, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#64748b', marginBottom: 24 },

  // Field
  fieldWrapper: { marginBottom: 16 },
  fieldLabel:   { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6, letterSpacing: 0.2 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#f8fafc', borderRadius: 12,
    borderWidth: 1.5, borderColor: '#e2e8f0',
    paddingHorizontal: 12, minHeight: 52,
  },
  inputRowError: { borderColor: '#ef4444', backgroundColor: '#fff5f5' },
  input: {
    flex: 1, fontSize: 16, color: NAVY,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  fieldError: { fontSize: 12, color: '#ef4444', marginTop: 4, marginLeft: 2 },

  // Phone prefix
  phonePrefix: {
    paddingRight: 10, borderRightWidth: 1,
    borderRightColor: '#e2e8f0', marginRight: 10,
  },
  phonePrefixText: { fontSize: 14, fontWeight: '600', color: '#475569' },

  // Eye button
  eyeButton: { paddingLeft: 8 },

  // Forgot
  forgotWrapper: { alignItems: 'flex-end', marginTop: -8, marginBottom: 20 },
  forgotText:    { fontSize: 13, fontWeight: '600', color: SAFFRON },

  // Login button
  loginButton: {
    backgroundColor: SAFFRON, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: SAFFRON, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  loginButtonDisabled: { backgroundColor: '#fdba74', shadowOpacity: 0.1 },
  loginButtonText:     { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.3 },
  loadingRow: { flexDirection: 'row', alignItems: 'center' },

  // Register
  registerRow:   { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  registerPrompt:{ fontSize: 15, color: '#64748b' },
  registerLink:  { fontSize: 15, fontWeight: '700', color: SAFFRON },

  // Footer
  footerNote: { textAlign: 'center', fontSize: 11, color: '#94a3b8', marginTop: 16 },
});