import { useState } from 'react';
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

function RiskGauge({ level, score }: { level: string; score: number }) {
  const colorMap: Record<string, string> = {
    LOW: Colors.success,
    MEDIUM: Colors.warning,
    HIGH: Colors.danger,
  };
  const color = colorMap[level] || Colors.warning;
  const pct = Math.min(score * 10, 100);

  return (
    <View style={styles.gauge}>
      <View style={styles.gaugeHeader}>
        <Text style={styles.gaugeLabel}>风险等级</Text>
        <Text style={[styles.gaugeLevel, { color }]}>{level}</Text>
      </View>
      <View style={styles.gaugeBg}>
        <View style={[styles.gaugeBar, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.gaugeScore, { color }]}>风险评分: {score}/10</Text>
    </View>
  );
}

export default function RiskManagementScreen() {
  const [portfolioText, setPortfolioText] = useState('');
  const { riskAssessment, loadingStates, assessPortfolioRisk } = useAIStore();
  const isLoading = loadingStates.riskAssessment;

  const handleAssess = () => {
    if (!portfolioText.trim()) {
      Alert.alert('提示', '请输入持仓信息\n格式：代码:金额,代码:金额');
      return;
    }
    const portfolio: Record<string, number> = {};
    portfolioText.split(',').forEach((p) => {
      const [sym, amt] = p.split(':');
      if (sym?.trim() && amt?.trim()) portfolio[sym.trim()] = Number(amt.trim());
    });
    if (Object.keys(portfolio).length === 0) {
      Alert.alert('提示', '格式错误，请使用: 代码:金额,代码:金额');
      return;
    }
    assessPortfolioRisk(portfolio);
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageTitle}>风险控制</Text>
        <Text style={styles.pageDesc}>输入您的持仓信息，AI 将为您进行全面风险评估</Text>

        <Card>
          <Text style={styles.inputLabel}>持仓信息</Text>
          <TextInput
            style={styles.textInput}
            placeholder="000001.SZ:50000,600519.SH:80000,300750.SZ:60000"
            placeholderTextColor={Colors.textMuted}
            value={portfolioText}
            onChangeText={setPortfolioText}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.hint}>格式：股票代码:持仓金额，多个用逗号分隔</Text>
          <TouchableOpacity
            style={[styles.btn, isLoading && { opacity: 0.6 }]}
            onPress={handleAssess}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            {isLoading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="shield-checkmark" size={18} color="#fff" />
                <Text style={styles.btnText}>开始评估</Text>
              </>
            )}
          </TouchableOpacity>
        </Card>

        {riskAssessment && (
          <>
            <Card>
              <RiskGauge
                level={riskAssessment.portfolio_risk_level}
                score={riskAssessment.risk_score}
              />
              <View style={styles.metricRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>{riskAssessment.diversification_score ?? '-'}</Text>
                  <Text style={styles.metricLabel}>分散度评分</Text>
                </View>
              </View>
            </Card>

            {riskAssessment.risk_summary && (
              <Card>
                <View style={styles.sectionHeader}>
                  <Ionicons name="document-text" size={16} color={Colors.primary} />
                  <Text style={styles.sectionTitle}>风险摘要</Text>
                </View>
                <Text style={styles.bodyText}>{riskAssessment.risk_summary}</Text>
              </Card>
            )}

            {riskAssessment.risk_factors?.length > 0 && (
              <Card>
                <View style={styles.sectionHeader}>
                  <Ionicons name="warning" size={16} color={Colors.warning} />
                  <Text style={styles.sectionTitle}>风险因素</Text>
                </View>
                {riskAssessment.risk_factors.map((f, i) => (
                  <View key={i} style={styles.factorRow}>
                    <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                    <Text style={styles.bodyText}>{f}</Text>
                  </View>
                ))}
              </Card>
            )}

            {riskAssessment.recommendations?.length > 0 && (
              <Card>
                <View style={styles.sectionHeader}>
                  <Ionicons name="bulb" size={16} color={Colors.success} />
                  <Text style={styles.sectionTitle}>优化建议</Text>
                </View>
                {riskAssessment.recommendations.map((r, i) => (
                  <View key={i} style={styles.factorRow}>
                    <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                    <Text style={styles.bodyText}>{r}</Text>
                  </View>
                ))}
              </Card>
            )}
          </>
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
  card: {
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  inputLabel: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: '500', marginBottom: Spacing.sm },
  textInput: {
    backgroundColor: Colors.bg, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    color: Colors.text, fontSize: FontSize.sm, minHeight: 70, textAlignVertical: 'top',
  },
  hint: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs },
  btn: {
    backgroundColor: Colors.warning, borderRadius: BorderRadius.md,
    height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: Spacing.md,
  },
  btnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
  gauge: { marginBottom: Spacing.md },
  gaugeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  gaugeLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  gaugeLevel: { fontSize: FontSize.md, fontWeight: '700' },
  gaugeBg: { height: 8, backgroundColor: Colors.border, borderRadius: 4, overflow: 'hidden' },
  gaugeBar: { height: 8, borderRadius: 4 },
  gaugeScore: { fontSize: FontSize.sm, fontWeight: '600', marginTop: Spacing.xs, textAlign: 'right' },
  metricRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.md },
  metricBox: { alignItems: 'center' },
  metricValue: { fontSize: FontSize.xxl, fontWeight: '700', color: Colors.primary },
  metricLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  bodyText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, flex: 1 },
  factorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.sm },
});
