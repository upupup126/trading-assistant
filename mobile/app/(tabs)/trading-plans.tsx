import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAIStore } from '../../src/stores/aiStore';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const templatePlans = [
  {
    name: '趋势跟随',
    icon: 'trending-up',
    color: Colors.success,
    desc: '顺势而为，在确认趋势后入场，设置移动止损保护利润',
    params: '入场条件: MA20上穿MA60\n止损: 跌破MA20\n仓位: 30%',
  },
  {
    name: '超跌反弹',
    icon: 'arrow-undo',
    color: Colors.warning,
    desc: '寻找超卖后的反弹机会，快进快出',
    params: '入场条件: RSI<30且放量\n止损: -3%\n目标: +5~8%',
  },
  {
    name: '价值均衡',
    icon: 'scale',
    color: Colors.primary,
    desc: '基于估值分析的长线持有策略',
    params: '入场条件: PE<行业均值70%\n持有期: 6-12个月\n仓位: 20%',
  },
];

export default function TradingPlansScreen() {
  const [symbol, setSymbol] = useState('');
  const { tradingAdvices, loadingStates, generateTradingAdvice } = useAIStore();

  const handleGenerate = (planName: string) => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      Alert.alert('提示', '请先输入股票代码');
      return;
    }
    generateTradingAdvice(sym, { strategy: planName });
  };

  const currentAdvice = tradingAdvices[symbol.trim().toUpperCase()];
  const isLoading = loadingStates[`tradingAdvice_${symbol.trim().toUpperCase()}`];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>交易计划</Text>
        <Text style={styles.pageDesc}>选择策略模板，输入股票代码获取 AI 交易建议</Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="输入股票代码，如 600519.SH"
            placeholderTextColor={Colors.textMuted}
            value={symbol}
            onChangeText={setSymbol}
            autoCapitalize="characters"
          />
        </View>

        {templatePlans.map((plan, i) => (
          <Card key={i}>
            <View style={styles.planHeader}>
              <View style={[styles.planIcon, { backgroundColor: plan.color + '22' }]}>
                <Ionicons name={plan.icon as any} size={22} color={plan.color} />
              </View>
              <View style={styles.planInfo}>
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planDesc}>{plan.desc}</Text>
              </View>
            </View>
            <Text style={styles.planParams}>{plan.params}</Text>
            <TouchableOpacity
              style={[styles.planBtn, { backgroundColor: plan.color }]}
              onPress={() => handleGenerate(plan.name)}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              {isLoading ? <ActivityIndicator color="#fff" size="small" /> : (
                <Text style={styles.planBtnText}>应用此策略</Text>
              )}
            </TouchableOpacity>
          </Card>
        ))}

        {currentAdvice && (
          <Card style={{ borderColor: Colors.primary }}>
            <View style={styles.resultHeader}>
              <Ionicons name="sparkles" size={18} color={Colors.primary} />
              <Text style={styles.resultTitle}>AI 交易建议</Text>
            </View>
            <Text style={styles.resultAction}>建议操作：{currentAdvice.action}</Text>
            {currentAdvice.advice_summary && (
              <Text style={styles.bodyText}>{currentAdvice.advice_summary}</Text>
            )}
            <View style={styles.statsRow}>
              {currentAdvice.stop_loss != null && (
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: Colors.danger }]}>{currentAdvice.stop_loss}</Text>
                  <Text style={styles.statLabel}>止损</Text>
                </View>
              )}
              {currentAdvice.take_profit != null && (
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: Colors.success }]}>{currentAdvice.take_profit}</Text>
                  <Text style={styles.statLabel}>止盈</Text>
                </View>
              )}
              {currentAdvice.risk_reward_ratio != null && (
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{currentAdvice.risk_reward_ratio}</Text>
                  <Text style={styles.statLabel}>风险回报比</Text>
                </View>
              )}
            </View>
            {currentAdvice.reasoning?.length > 0 && (
              <>
                <Text style={styles.subTitle}>分析理由</Text>
                {currentAdvice.reasoning.map((r, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bodyText}>{r}</Text>
                  </View>
                ))}
              </>
            )}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  pageTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  pageDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.lg },
  inputRow: { marginBottom: Spacing.md },
  textInput: {
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.lg, height: 46,
    color: Colors.text, fontSize: FontSize.md,
  },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  planHeader: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
  planIcon: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  planInfo: { flex: 1 },
  planName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  planDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  planParams: {
    fontSize: FontSize.xs, color: Colors.textMuted,
    backgroundColor: Colors.bg, borderRadius: BorderRadius.sm,
    padding: Spacing.sm, marginBottom: Spacing.md,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  planBtn: {
    height: 40, borderRadius: BorderRadius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  planBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: '600' },
  resultHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  resultTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary },
  resultAction: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  bodyText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, flex: 1 },
  subTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginTop: Spacing.md, marginBottom: Spacing.xs },
  bulletRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  bullet: { color: Colors.primary, fontSize: FontSize.sm },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});
