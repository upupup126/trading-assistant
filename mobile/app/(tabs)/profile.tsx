import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('退出登录', '确认退出当前账户？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={40} color={Colors.primary} />
        </View>
        <Text style={styles.name}>{user?.username ?? '未知用户'}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>

        <View style={styles.section}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="person-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.menuText}>个人资料</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.menuText}>设置</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="help-circle-outline" size={20} color={Colors.textSecondary} />
            <Text style={styles.menuText}>帮助与反馈</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { flex: 1, padding: Spacing.xxl, alignItems: 'center' },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.bgCard, justifyContent: 'center', alignItems: 'center',
    marginTop: 40, marginBottom: Spacing.lg,
    borderWidth: 2, borderColor: Colors.primary,
  },
  name: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  email: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  section: {
    width: '100%', marginTop: 40,
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  menuText: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: 40, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xxl,
    backgroundColor: Colors.danger + '15', borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.danger + '33',
  },
  logoutText: { fontSize: FontSize.md, color: Colors.danger, fontWeight: '600' },
});
