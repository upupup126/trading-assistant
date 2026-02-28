import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAIStore } from '../../src/stores/aiStore';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

interface LocalAlert {
  id: string;
  symbol: string;
  type: 'price_above' | 'price_below' | 'ai_signal';
  threshold?: string;
  enabled: boolean;
  createdAt: string;
}

export default function AlertsScreen() {
  const [alerts, setAlerts] = useState<LocalAlert[]>([]);
  const [symbol, setSymbol] = useState('');
  const [threshold, setThreshold] = useState('');
  const [alertType, setAlertType] = useState<'price_above' | 'price_below' | 'ai_signal'>('price_above');
  const [showForm, setShowForm] = useState(false);

  const { stockAnalyses, loadingStates, analyzeStockOpportunity } = useAIStore();

  const handleAddAlert = () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) { Alert.alert('提示', '请输入股票代码'); return; }
    if (alertType !== 'ai_signal' && !threshold.trim()) {
      Alert.alert('提示', '请输入价格阈值');
      return;
    }
    const newAlert: LocalAlert = {
      id: Date.now().toString(),
      symbol: sym,
      type: alertType,
      threshold: threshold.trim(),
      enabled: true,
      createdAt: new Date().toLocaleString('zh-CN'),
    };
    setAlerts((prev) => [newAlert, ...prev]);
    setSymbol('');
    setThreshold('');
    setShowForm(false);

    if (alertType === 'ai_signal') {
      analyzeStockOpportunity(sym);
    }
  };

  const toggleAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
  };

  const removeAlert = (id: string) => {
    Alert.alert('确认', '确定删除这条提醒？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => setAlerts((prev) => prev.filter((a) => a.id !== id)) },
    ]);
  };

  const typeLabel: Record<string, string> = {
    price_above: '价格上穿',
    price_below: '价格下穿',
    ai_signal: 'AI 信号',
  };

  const typeColor: Record<string, string> = {
    price_above: Colors.success,
    price_below: Colors.danger,
    ai_signal: Colors.purple,
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.pageTitle}>智能提醒</Text>
            <Text style={styles.pageDesc}>设置价格预警和 AI 信号提醒</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowForm(!showForm)}
            activeOpacity={0.7}
          >
            <Ionicons name={showForm ? 'close' : 'add'} size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {showForm && (
          <Card style={{ borderColor: Colors.primary }}>
            <Text style={styles.formTitle}>新建提醒</Text>
            <TextInput
              style={styles.textInput}
              placeholder="股票代码，如 000001.SZ"
              placeholderTextColor={Colors.textMuted}
              value={symbol}
              onChangeText={setSymbol}
              autoCapitalize="characters"
            />
            <View style={styles.typeRow}>
              {(['price_above', 'price_below', 'ai_signal'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, alertType === t && { backgroundColor: typeColor[t] + '33', borderColor: typeColor[t] }]}
                  onPress={() => setAlertType(t)}
                >
                  <Text style={[styles.typeBtnText, alertType === t && { color: typeColor[t] }]}>
                    {typeLabel[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {alertType !== 'ai_signal' && (
              <TextInput
                style={styles.textInput}
                placeholder="价格阈值"
                placeholderTextColor={Colors.textMuted}
                value={threshold}
                onChangeText={setThreshold}
                keyboardType="numeric"
              />
            )}
            <TouchableOpacity style={styles.submitBtn} onPress={handleAddAlert} activeOpacity={0.7}>
              <Text style={styles.submitBtnText}>添加提醒</Text>
            </TouchableOpacity>
          </Card>
        )}

        {alerts.length === 0 && !showForm && (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>暂无提醒</Text>
            <Text style={styles.emptyHint}>点击右上角 + 创建新提醒</Text>
          </View>
        )}

        {alerts.map((alert) => {
          const stockData = stockAnalyses[alert.symbol];
          const isAnalyzing = loadingStates[`stockAnalysis_${alert.symbol}`];

          return (
            <Card key={alert.id}>
              <View style={styles.alertHeader}>
                <View style={[styles.typeDot, { backgroundColor: typeColor[alert.type] }]} />
                <Text style={styles.alertSymbol}>{alert.symbol}</Text>
                <Text style={[styles.alertType, { color: typeColor[alert.type] }]}>
                  {typeLabel[alert.type]}
                </Text>
                <TouchableOpacity onPress={() => toggleAlert(alert.id)}>
                  <Ionicons
                    name={alert.enabled ? 'toggle' : 'toggle-outline'}
                    size={28}
                    color={alert.enabled ? Colors.success : Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {alert.threshold && (
                <Text style={styles.alertThreshold}>阈值: {alert.threshold}</Text>
              )}
              <View style={styles.alertFooter}>
                <Text style={styles.alertTime}>{alert.createdAt}</Text>
                <TouchableOpacity onPress={() => removeAlert(alert.id)}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>

              {alert.type === 'ai_signal' && isAnalyzing && (
                <View style={styles.analyzing}>
                  <ActivityIndicator size="small" color={Colors.purple} />
                  <Text style={styles.analyzingText}>AI 正在分析...</Text>
                </View>
              )}
              {alert.type === 'ai_signal' && stockData && (
                <View style={styles.aiResult}>
                  <Text style={styles.aiResultTitle}>
                    AI 建议: {stockData.recommendation}（风险 {stockData.risk_level}）
                  </Text>
                  {stockData.analysis_summary && (
                    <Text style={styles.aiResultText}>{stockData.analysis_summary}</Text>
                  )}
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  pageTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  pageDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  formTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginBottom: Spacing.md },
  textInput: {
    backgroundColor: Colors.bg, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.lg, height: 46,
    color: Colors.text, fontSize: FontSize.md, marginBottom: Spacing.sm,
  },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  typeBtn: {
    flex: 1, height: 36, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  typeBtnText: { fontSize: FontSize.xs, color: Colors.textMuted, fontWeight: '500' },
  submitBtn: {
    backgroundColor: Colors.primary, height: 44, borderRadius: BorderRadius.md,
    justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xs,
  },
  submitBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: FontSize.lg, color: Colors.textMuted, marginTop: Spacing.md },
  emptyHint: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.xs },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  alertSymbol: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, flex: 1 },
  alertType: { fontSize: FontSize.xs, fontWeight: '600' },
  alertThreshold: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs, marginLeft: 20 },
  alertFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  alertTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  analyzing: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  analyzingText: { fontSize: FontSize.xs, color: Colors.purple },
  aiResult: {
    marginTop: Spacing.sm, padding: Spacing.sm,
    backgroundColor: Colors.purple + '11', borderRadius: BorderRadius.sm,
  },
  aiResultTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.purple },
  aiResultText: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
});
