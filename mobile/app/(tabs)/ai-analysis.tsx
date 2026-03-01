import { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAIStore } from '../../src/stores/aiStore';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import KlineChart from '../../src/components/KlineChart';

type TabKey = 'market' | 'stock' | 'risk' | 'advice';

const tabs: { key: TabKey; label: string; icon: string }[] = [
  { key: 'market', label: '市场', icon: 'trending-up-outline' },
  { key: 'stock', label: '个股', icon: 'search-outline' },
  { key: 'risk', label: '风险', icon: 'shield-outline' },
  { key: 'advice', label: '建议', icon: 'bulb-outline' },
];

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export default function AIAnalysisScreen() {
  const [activeTab, setActiveTab] = useState<TabKey>('market');
  const [stockSymbol, setStockSymbol] = useState('');
  const [portfolioText, setPortfolioText] = useState('');
  const [adviceSymbol, setAdviceSymbol] = useState('');
  const [adviceContext, setAdviceContext] = useState('');

  const {
    marketAnalysis, stockAnalyses, riskAssessment, tradingAdvices,
    loadingStates,
    analyzeMarketTrend, analyzeStockOpportunity, assessPortfolioRisk, generateTradingAdvice,
  } = useAIStore();

  const handleMarket = () => analyzeMarketTrend();

  const handleStock = () => {
    const sym = stockSymbol.trim().toUpperCase();
    if (!sym) { Alert.alert('提示', '请输入股票代码'); return; }
    analyzeStockOpportunity(sym);
  };

  const handleRisk = () => {
    if (!portfolioText.trim()) { Alert.alert('提示', '请输入持仓，格式：代码:金额,代码:金额'); return; }
    const portfolio: Record<string, number> = {};
    portfolioText.split(',').forEach((p) => {
      const [sym, amt] = p.split(':');
      if (sym?.trim() && amt?.trim()) portfolio[sym.trim()] = Number(amt.trim());
    });
    assessPortfolioRisk(portfolio);
  };

  const handleAdvice = () => {
    const sym = adviceSymbol.trim().toUpperCase();
    if (!sym) { Alert.alert('提示', '请输入股票代码'); return; }
    generateTradingAdvice(sym, adviceContext ? { notes: adviceContext } : undefined);
  };

  const isMarketLoading = loadingStates.marketTrend;
  const isStockLoading = loadingStates[`stockAnalysis_${stockSymbol.trim().toUpperCase()}`];
  const isRiskLoading = loadingStates.riskAssessment;
  const isAdviceLoading = loadingStates[`tradingAdvice_${adviceSymbol.trim().toUpperCase()}`];

  const currentStock = stockAnalyses[stockSymbol.trim().toUpperCase()];
  const currentAdvice = tradingAdvices[adviceSymbol.trim().toUpperCase()];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, activeTab === t.key && styles.tabActive]}
            onPress={() => setActiveTab(t.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={t.icon as any}
              size={16}
              color={activeTab === t.key ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.tabText, activeTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* ===== 市场分析 ===== */}
        {activeTab === 'market' && (
          <>
            <TouchableOpacity style={styles.actionBtn} onPress={handleMarket} disabled={isMarketLoading}>
              {isMarketLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="analytics" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>开始市场分析</Text>
                </>
              )}
            </TouchableOpacity>

            {marketAnalysis && (
              <Card>
                <Text style={styles.cardTitle}>市场情绪：{marketAnalysis.market_sentiment}</Text>
                {marketAnalysis.market_summary && (
                  <Text style={styles.bodyText}>{marketAnalysis.market_summary}</Text>
                )}
                {marketAnalysis.hot_sectors?.length > 0 && (
                  <>
                    <Text style={styles.subTitle}>热门板块</Text>
                    <View style={styles.tagRow}>
                      {marketAnalysis.hot_sectors.map((s, i) => (
                        <View key={i} style={styles.tag}>
                          <Text style={styles.tagText}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
                {marketAnalysis.key_insights?.length > 0 && (
                  <>
                    <Text style={styles.subTitle}>关键洞察</Text>
                    {marketAnalysis.key_insights.map((t, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.bodyText}>{t}</Text>
                      </View>
                    ))}
                  </>
                )}
              </Card>
            )}
          </>
        )}

        {/* ===== 个股分析 ===== */}
        {activeTab === 'stock' && (
          <>
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.textInput}
                placeholder="股票代码，如 000001.SZ"
                placeholderTextColor={Colors.textMuted}
                value={stockSymbol}
                onChangeText={setStockSymbol}
                autoCapitalize="characters"
              />
              <TouchableOpacity style={styles.actionBtn} onPress={handleStock} disabled={isStockLoading}>
                {isStockLoading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.actionBtnText}>分析</Text>
                )}
              </TouchableOpacity>
            </View>

            {currentStock && (
              <Card>
                <View style={styles.row}>
                  <Text style={styles.cardTitle}>推荐：{currentStock.recommendation}</Text>
                  <Text style={[styles.riskBadge, {
                    color: currentStock.risk_level === 'HIGH' ? Colors.danger :
                      currentStock.risk_level === 'LOW' ? Colors.success : Colors.warning
                  }]}>
                    风险{currentStock.risk_level}
                  </Text>
                </View>
                {currentStock.analysis_summary && (
                  <Text style={styles.bodyText}>{currentStock.analysis_summary}</Text>
                )}
                {currentStock.opportunity_score != null && (
                  <View style={styles.scoreRow}>
                    <Text style={styles.scoreLabel}>机会评分</Text>
                    <Text style={styles.scoreValue}>{currentStock.opportunity_score}/10</Text>
                  </View>
                )}
                {currentStock.key_factors?.length > 0 && (
                  <>
                    <Text style={styles.subTitle}>关键因素</Text>
                    {currentStock.key_factors.map((f, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.bodyText}>{f}</Text>
                      </View>
                    ))}
                  </>
                )}
              </Card>
            )}

            {/* 个股 K 线图 */}
            {currentStock && stockSymbol.trim() && (
              <KlineChart
                symbol={stockSymbol.trim().toUpperCase()}
                title={`${stockSymbol.trim().toUpperCase()} K线走势`}
              />
            )}
          </>
        )}

        {/* ===== 风险评估 ===== */}
        {activeTab === 'risk' && (
          <>
            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.textInput, { height: 60 }]}
                placeholder="持仓格式：000001.SZ:50000,600519.SH:80000"
                placeholderTextColor={Colors.textMuted}
                value={portfolioText}
                onChangeText={setPortfolioText}
                multiline
              />
              <TouchableOpacity style={styles.actionBtn} onPress={handleRisk} disabled={isRiskLoading}>
                {isRiskLoading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.actionBtnText}>评估</Text>
                )}
              </TouchableOpacity>
            </View>

            {riskAssessment && (
              <Card>
                <Text style={styles.cardTitle}>
                  风险等级：{riskAssessment.portfolio_risk_level}
                </Text>
                {riskAssessment.risk_summary && (
                  <Text style={styles.bodyText}>{riskAssessment.risk_summary}</Text>
                )}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{riskAssessment.risk_score ?? '-'}</Text>
                    <Text style={styles.statLabel}>风险分</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{riskAssessment.diversification_score ?? '-'}</Text>
                    <Text style={styles.statLabel}>分散度</Text>
                  </View>
                </View>
                {riskAssessment.recommendations?.length > 0 && (
                  <>
                    <Text style={styles.subTitle}>建议</Text>
                    {riskAssessment.recommendations.map((r, i) => (
                      <View key={i} style={styles.bulletRow}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.bodyText}>{r}</Text>
                      </View>
                    ))}
                  </>
                )}
              </Card>
            )}
          </>
        )}

        {/* ===== 交易建议 ===== */}
        {activeTab === 'advice' && (
          <>
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.textInput}
                placeholder="股票代码，如 600519.SH"
                placeholderTextColor={Colors.textMuted}
                value={adviceSymbol}
                onChangeText={setAdviceSymbol}
                autoCapitalize="characters"
              />
              <TextInput
                style={[styles.textInput, { height: 60 }]}
                placeholder="交易背景说明（可选）"
                placeholderTextColor={Colors.textMuted}
                value={adviceContext}
                onChangeText={setAdviceContext}
                multiline
              />
              <TouchableOpacity style={styles.actionBtn} onPress={handleAdvice} disabled={isAdviceLoading}>
                {isAdviceLoading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.actionBtnText}>获取建议</Text>
                )}
              </TouchableOpacity>
            </View>

            {currentAdvice && (
              <Card>
                <Text style={styles.cardTitle}>建议操作：{currentAdvice.action}</Text>
                {currentAdvice.advice_summary && (
                  <Text style={styles.bodyText}>{currentAdvice.advice_summary}</Text>
                )}
                <View style={styles.statsRow}>
                  {currentAdvice.stop_loss != null && (
                    <View style={styles.statBox}>
                      <Text style={[styles.statValue, { color: Colors.danger }]}>
                        {currentAdvice.stop_loss}
                      </Text>
                      <Text style={styles.statLabel}>止损</Text>
                    </View>
                  )}
                  {currentAdvice.take_profit != null && (
                    <View style={styles.statBox}>
                      <Text style={[styles.statValue, { color: Colors.success }]}>
                        {currentAdvice.take_profit}
                      </Text>
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
                {currentAdvice.reasoning && (
                  <>
                    <Text style={styles.subTitle}>推理过程</Text>
                    {(Array.isArray(currentAdvice.reasoning) ? currentAdvice.reasoning : [currentAdvice.reasoning]).map((r: string, i: number) => (
                      <View key={i} style={styles.bulletRow}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.bodyText}>{r}</Text>
                      </View>
                    ))}
                  </>
                )}
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
  tabBar: {
    flexDirection: 'row', backgroundColor: Colors.bgCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.sm,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: Spacing.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { fontSize: FontSize.sm, color: Colors.textMuted },
  tabTextActive: { color: Colors.primary, fontWeight: '600' },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginTop: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  subTitle: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginTop: Spacing.md, marginBottom: Spacing.xs },
  bodyText: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, flex: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tag: {
    backgroundColor: Colors.primary + '22', paddingHorizontal: 10,
    paddingVertical: 4, borderRadius: 12,
  },
  tagText: { fontSize: FontSize.xs, color: Colors.primary },
  bulletRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  bullet: { color: Colors.primary, fontSize: FontSize.sm },
  inputGroup: { gap: Spacing.sm },
  textInput: {
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.lg, height: 46,
    color: Colors.text, fontSize: FontSize.md,
  },
  actionBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  actionBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  riskBadge: { fontSize: FontSize.xs, fontWeight: '700' },
  scoreRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  scoreLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  scoreValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  statBox: { alignItems: 'center' },
  statValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
});
