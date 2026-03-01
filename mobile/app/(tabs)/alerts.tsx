import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStrategyStore } from '../../src/stores/strategyStore';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export default function AlertsScreen() {
  const {
    alerts, alertsTotal, unreadAlertCount, loadingStates,
    fetchAlerts, markAlertRead, markAllAlertsRead, fetchUnreadAlertCount,
  } = useStrategyStore();

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAlerts(false);
    fetchUnreadAlertCount();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => fetchUnreadAlertCount(), 30000);
    return () => clearInterval(timer);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAlerts(unreadOnly);
    await fetchUnreadAlertCount();
    setRefreshing(false);
  }, [unreadOnly]);

  const toggleFilter = () => {
    const next = !unreadOnly;
    setUnreadOnly(next);
    fetchAlerts(next);
  };

  const isLoading = loadingStates.alerts;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.pageTitle}>策略信号</Text>
          <Text style={styles.pageDesc}>
            {unreadAlertCount > 0 ? `${unreadAlertCount} 条未读信号` : '所有信号已读'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.filterBtn, unreadOnly && styles.filterBtnActive]}
            onPress={toggleFilter}
          >
            <Ionicons
              name={unreadOnly ? 'eye' : 'eye-off-outline'}
              size={16}
              color={unreadOnly ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.filterText, unreadOnly && { color: Colors.primary }]}>
              {unreadOnly ? '仅未读' : '全部'}
            </Text>
          </TouchableOpacity>
          {unreadAlertCount > 0 && (
            <TouchableOpacity style={styles.markAllBtn} onPress={markAllAlertsRead}>
              <Ionicons name="checkmark-done" size={18} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {isLoading && alerts.length === 0 ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
        ) : alerts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={52} color={Colors.textMuted} />
            <Text style={styles.emptyText}>暂无信号提醒</Text>
            <Text style={styles.emptyHint}>
              在策略管理中开启提醒后，系统会自动推送买卖信号
            </Text>
          </View>
        ) : alerts.map((alert) => {
          const isBuy = alert.alert_type === 'BUY_SIGNAL';
          const signalColor = isBuy ? Colors.success : Colors.danger;

          return (
            <TouchableOpacity
              key={alert.id}
              activeOpacity={0.7}
              onPress={() => !alert.is_read && markAlertRead(alert.id)}
            >
              <Card style={!alert.is_read ? { borderColor: signalColor + '55' } : undefined}>
                <View style={styles.alertRow}>
                  <View style={[styles.signalIcon, { backgroundColor: signalColor + '18' }]}>
                    <Ionicons
                      name={isBuy ? 'trending-up' : 'trending-down'}
                      size={22}
                      color={signalColor}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.alertTitleRow}>
                      <Text style={styles.alertSymbol}>{alert.stock_symbol}</Text>
                      <View style={[styles.signalBadge, { backgroundColor: signalColor + '22' }]}>
                        <Text style={[styles.signalBadgeText, { color: signalColor }]}>
                          {isBuy ? '买入信号' : '卖出信号'}
                        </Text>
                      </View>
                      {!alert.is_read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.alertMessage} numberOfLines={3}>{alert.message}</Text>
                    {alert.triggered_strategy && (
                      <View style={styles.triggerRow}>
                        <Ionicons name="flash" size={12} color={Colors.warning} />
                        <Text style={styles.triggerText}>触发策略: {alert.triggered_strategy}</Text>
                      </View>
                    )}
                    {alert.details && (
                      <Text style={styles.alertDetails} numberOfLines={2}>{alert.details}</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.alertTime}>
                  {new Date(alert.created_at).toLocaleString('zh-CN')}
                </Text>
              </Card>
            </TouchableOpacity>
          );
        })}

        {alerts.length > 0 && alerts.length < alertsTotal && (
          <TouchableOpacity
            style={styles.loadMoreBtn}
            onPress={() => fetchAlerts(unreadOnly, 20, alerts.length)}
          >
            <Text style={styles.loadMoreText}>加载更多</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  pageTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  pageDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border,
  },
  filterBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  filterText: { fontSize: FontSize.xs, color: Colors.textMuted },
  markAllBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary + '15',
    justifyContent: 'center', alignItems: 'center',
  },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyText: { fontSize: FontSize.lg, color: Colors.textMuted, marginTop: Spacing.md },
  emptyHint: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: 40 },
  alertRow: { flexDirection: 'row', gap: Spacing.md },
  signalIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  alertTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  alertSymbol: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  signalBadge: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  signalBadgeText: { fontSize: FontSize.xs, fontWeight: '600' },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary,
  },
  alertMessage: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginTop: 4 },
  triggerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  triggerText: { fontSize: FontSize.xs, color: Colors.warning },
  alertDetails: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 4, lineHeight: 16 },
  alertTime: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'right' },
  loadMoreBtn: {
    alignItems: 'center', paddingVertical: Spacing.lg,
    marginTop: Spacing.sm,
  },
  loadMoreText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
});
