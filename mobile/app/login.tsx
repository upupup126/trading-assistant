import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/authStore';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const { login, loading, error, clearError } = useAuthStore();
  const router = useRouter();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('提示', '请输入用户名和密码');
      return;
    }
    clearError();
    const ok = await login(username.trim(), password);
    if (ok) {
      router.replace('/(tabs)/dashboard');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="trending-up" size={40} color={Colors.primary} />
            </View>
            <Text style={styles.title}>交易助手</Text>
            <Text style={styles.subtitle}>登录您的账户</Text>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <Text style={styles.label}>用户名</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="请输入用户名"
                placeholderTextColor={Colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={styles.label}>密码</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="请输入密码"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPwd}
              />
              <TouchableOpacity onPress={() => setShowPwd(!showPwd)}>
                <Ionicons
                  name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>登 录</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => router.push('/register')}
          >
            <Text style={styles.registerText}>
              还没有账户？<Text style={styles.registerHighlight}>立即注册</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xxl },
  header: { alignItems: 'center', marginBottom: 32 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.bgCard, justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSize.title, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.xs },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.15)', padding: Spacing.md,
    borderRadius: BorderRadius.md, marginBottom: Spacing.lg,
  },
  errorText: { color: Colors.danger, fontSize: FontSize.sm, flex: 1 },
  form: { gap: Spacing.md },
  label: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.lg, height: 50,
  },
  input: { flex: 1, color: Colors.text, fontSize: FontSize.md },
  btn: {
    backgroundColor: Colors.primary, height: 50,
    borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center',
    marginTop: Spacing.lg,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '600' },
  registerLink: { alignItems: 'center', marginTop: Spacing.xxl },
  registerText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  registerHighlight: { color: Colors.primary, fontWeight: '600' },
});
