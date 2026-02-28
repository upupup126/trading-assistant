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

export default function RegisterScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const { register, loading, error, clearError } = useAuthStore();
  const router = useRouter();

  const handleRegister = async () => {
    if (!username.trim() || !email.trim() || !password.trim()) {
      Alert.alert('提示', '请填写所有字段');
      return;
    }
    if (password !== confirmPwd) {
      Alert.alert('提示', '两次密码输入不一致');
      return;
    }
    clearError();
    const ok = await register(username.trim(), password, email.trim());
    if (ok) {
      Alert.alert('注册成功', '请使用新账户登录', [
        { text: '去登录', onPress: () => router.replace('/login') },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>创建账户</Text>
            <Text style={styles.subtitle}>注册以开始使用交易助手</Text>
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
              />
            </View>

            <Text style={styles.label}>邮箱</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="请输入邮箱"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
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
                secureTextEntry
              />
            </View>

            <Text style={styles.label}>确认密码</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder="请再次输入密码"
                placeholderTextColor={Colors.textMuted}
                value={confirmPwd}
                onChangeText={setConfirmPwd}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>注 册</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.replace('/login')}
          >
            <Text style={styles.linkText}>
              已有账户？<Text style={styles.linkHighlight}>立即登录</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flexGrow: 1, padding: Spacing.xxl, paddingTop: Spacing.lg },
  back: { marginBottom: Spacing.lg },
  header: { marginBottom: 24 },
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
  loginLink: { alignItems: 'center', marginTop: Spacing.xxl },
  linkText: { fontSize: FontSize.sm, color: Colors.textSecondary },
  linkHighlight: { color: Colors.primary, fontWeight: '600' },
});
