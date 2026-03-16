import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { isAxiosError } from '../api/axios';
import { useLogin } from '../hooks/useAuth';

export default function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [secureText, setSecureText] = useState(true);

  const login = useLogin();

  function getErrorMessage(error: unknown): string {
    if (__DEV__ && isAxiosError(error)) {
      console.error('[LoginScreen] login error:', {
        code: error.code,
        message: error.message,
        baseURL: error.config?.baseURL,
        status: error.response?.status,
      });
    } else if (__DEV__) {
      console.error('[LoginScreen] login error (non-axios):', error);
    }

    if (isAxiosError(error)) {
      // Network error — server never responded (wrong IP, backend down, firewall, etc.)
      if (!error.response) {
        const url = error.config?.baseURL ?? '';
        return `Tidak dapat terhubung ke server.\n\nPastikan:\n• Backend berjalan\n• HP dan PC di jaringan Wi-Fi yang sama\n• IP di .env sudah benar\n  (${url})`;
      }
      if (error.response.status === 429) return 'Terlalu banyak percobaan. Silakan tunggu.';
      if (error.response.status >= 500) return 'Server error. Silakan coba lagi nanti.';

      // Structured error codes from backend
      const data = error.response.data as {
        code?: string;
        attempts_remaining?: number;
        retry_in_minutes?: number;
      } | undefined;
      const code = data?.code;
      if (code === 'USER_NOT_FOUND') return 'Username tidak ditemukan.';
      if (code === 'WRONG_PASSWORD') {
        const rem = data?.attempts_remaining;
        return rem != null
          ? `Password salah. Sisa percobaan: ${rem} kali.`
          : 'Password salah.';
      }
      if (code === 'ACCOUNT_LOCKED') {
        const mins = data?.retry_in_minutes;
        return mins != null
          ? `Akun terkunci. Coba lagi dalam ${mins} menit.`
          : 'Akun terkunci. Coba lagi beberapa menit lagi.';
      }
      if (code === 'ACCOUNT_INACTIVE') return 'Akun tidak aktif. Hubungi administrator.';

      if (error.response.status === 401) return 'Email/ID atau password salah.';
    }
    // Internal auth errors (e.g. "No refresh token available") must never surface raw
    return 'Login gagal. Periksa username dan password.';
  }

  async function handleLogin() {
    if (!identifier.trim() || !password) return;

    try {
      await login.mutateAsync({ identifier: identifier.trim(), password });
    } catch {
      // Error displayed via login.error
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>P</Text>
            </View>
            <Text style={styles.appName}>Presensi SSB</Text>
            <Text style={styles.subtitle}>Attendance Management</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email / Employee ID</Text>
              <TextInput
                style={styles.input}
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="Enter email or employee ID"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                editable={!login.isPending}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={secureText}
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  editable={!login.isPending}
                />
                <Pressable
                  style={styles.eyeBtn}
                  onPress={() => setSecureText((v) => !v)}
                  accessibilityLabel={secureText ? 'Show password' : 'Hide password'}
                >
                  <Text style={styles.eyeText}>{secureText ? '👁' : '🙈'}</Text>
                </Pressable>
              </View>
            </View>

            {login.error != null && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>
                  {getErrorMessage(login.error)}
                </Text>
              </View>
            )}

            <Pressable
              style={[
                styles.button,
                (login.isPending || !identifier.trim() || !password) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={login.isPending || !identifier.trim() || !password}
            >
              {login.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Login</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
  },
  eyeBtn: {
    height: 48,
    width: 48,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  eyeText: {
    fontSize: 18,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
  },
  errorText: {
    fontSize: 13,
    color: '#B91C1C',
  },
  button: {
    height: 52,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#93C5FD',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
