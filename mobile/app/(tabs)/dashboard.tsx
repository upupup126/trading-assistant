import { useEffect, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useAIStore } from '../../src/stores/aiStore';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const map: Record<string, { color: string; label: string }> = {
    BULLISH: { color: Colors.success, label: '看涨' },
    BEARISH: { color: Colors.danger, label: '看跌' },
    NEUTRAL: { color: Colors.warning, label: '中性' },
  };
  const s = map[sentiment] || map.NEUTRAL;
  return (
    <View style={[styles.badge, { backgroundColor: s.color + '22' }]}>
      <View style={[styles.dot, { backgroundColor: s.color }]} />
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const {
    marketOverview, marketAnalysis, loadingStates,
    getMarketOverview, analyzeMarketTrend,
  } = useAIStore();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    await Promise.all([getMarketOverview(), analyzeMarketTrend()]);
  }, []);

  useEffect(() => { loadData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const isLoading = loadingStates.marketOverview || loadingStates.marketTrend;

  const indices = marketOverview?.indices || [];
  const stats = marketOverview?.market_stats;
  const sectors = marketOverview?.sector_performance || [];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
      >
        {/* 欢迎栏 */}
        <View style={styles.welcome}>
          <View>
            <Text style={styles.welcomeTitle}>交易仪表板</Text>
            <Text style={styles.welcomeSub}>欢迎回来，{user?.username}</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} disabled={isLoading}>
            <Ionicons
              name="refresh"
              size={22}
              color={isLoading ? Colors.textMuted : Colors.primary}
            />
          </TouchableOpacity>
        </View>

        {/* AI 市场分析 */}
        {marketAnalysis && (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="sparkles" size={18} color={Colors.purple} />
              <Text style={styles.cardTitle}>AI 市场分析</Text>
              <SentimentBadge sentiment={marketAnalysis.market_sentiment} />
            </View>
            {marketAnalysis.confidence_score != null && (
              <View style={styles.progressWrap}>
                <Text style={styles.progressLabel}>
                  置信度 {Math.round(marketAnalysis.confidence_score * 100)}%
                </Text>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressBar,
                      { width: `${marketAnalysis.confidence_score * 100}%` },
                    ]}
                  />
                </View>
              </View>
            )}
            {marketAnalysis.market_summary ? (
              <Text style={styles.summary}>{marketAnalysis.market_summary}</Text>
            ) : null}
            {marketAnalysis.hot_sectors?.length > 0 && (
              <View style={styles.tagRow}>
                {marketAnalysis.hot_sectors.map((s, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
            {marketAnalysis.key_insights?.length > 0 && (
              <View style={styles.insightList}>
                {marketAnalysis.key_insights.slice(0, 3).map((t, i) => (
                  <View key={i} style={styles.insightRow}>
                    <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
                    <Text style={styles.insightText}>{t}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

        {/* 主要指数 */}
        {indices.length > 0 && (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="bar-chart-outline" size={18} color={Colors.primary} />
              <Text style={styles.cardTitle}>主要指数</Text>
            </View>
            {indices.map((idx: any, i: number) => (
              <View key={i} style={styles.indexRow}>
                <Text style={styles.indexName} numberOfLines={1}>{idx.name}</Text>
                <Text style={styles.indexPrice}>
                  {typeof idx.price === 'number' ? idx.price.toFixed(2) : idx.price}
                </Text>
                <Text
                  style={[
                    styles.indexChange,
                    { color: (idx.change_percent ?? 0) >= 0 ? Colors.success : Colors.danger },
                  ]}
                >
                  {(idx.change_percent ?? 0) >= 0 ? '+' : ''}{(idx.change_percent ?? 0).toFixed(2)}%
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* 市场统计 */}
        {stats && (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="stats-chart-outline" size={18} color={Colors.cyan} />
              <Text style={styles.cardTitle}>市场统计</Text>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.success }]}>{stats.advance_count ?? '-'}</Text>
                <Text style={styles.statLabel}>上涨家数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: Colors.danger }]}>{stats.decline_count ?? '-'}</Text>
                <Text style={styles.statLabel}>下跌家数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.flat_count ?? '-'}</Text>
                <Text style={styles.statLabel}>平盘</Text>
              </View>
            </View>
          </Card>
        )}

        {/* 板块表现 */}
        {sectors.length > 0 && (
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="pie-chart-outline" size={18} color={Colors.orange} />
              <Text style={styles.cardTitle}>板块表现</Text>
            </View>
            {sectors.slice(0, 6).map((sec: any, i: number) => (
              <View key={i} style={styles.sectorRow}>
                <Text style={styles.sectorName} numberOfLines={1}>{sec.name}</Text>
                <Text
                  style={[
                    styles.sectorChange,
                    { color: (sec.change_percent ?? 0) >= 0 ? Colors.success : Colors.danger },
                  ]}
                >
                  {(sec.change_percent ?? 0) >= 0 ? '+' : ''}{(sec.change_percent ?? 0).toFixed(2)}%
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* 快速操作 */}
        <Card>
          <View style={styles.cardHeader}>
            <Ionicons name="flash-outline" size={18} color={Colors.warning} />
            <Text style={styles.cardTitle}>快速操作</Text>
          </View>
          <View style={styles.quickGrid}>
            {[
              { icon: 'analytics', color: Colors.primary, label: 'AI 分析', route: '/(tabs)/ai-analysis' },
              { icon: 'document-text', color: Colors.success, label: '交易计划', route: '/(tabs)/trading-plans' },
              { icon: 'shield', color: Colors.warning, label: '风险评估', route: '/(tabs)/risk-management' },
              { icon: 'notifications', color: Colors.purple, label: '智能提醒', route: '/(tabs)/alerts' },
            ].map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.quickItem}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.quickIcon, { backgroundColor: item.color + '22' }]}>
                  <Ionicons name={item.icon as any} size={24} color={item.color} />
                </View>
                <Text style={styles.quickLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {isLoading && !refreshing && (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: Spacing.lg }} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 40 },
  welcome: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  welcomeTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  welcomeSub: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, flex: 1 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '600' },
  progressWrap: { marginBottom: Spacing.sm },
  progressLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  progressBg: {
    height: 6, backgroundColor: Colors.border, borderRadius: 3, overflow: 'hidden',
  },
  progressBar: { height: 6, backgroundColor: Colors.primary, borderRadius: 3 },
  summary: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  tag: {
    backgroundColor: Colors.primary + '22', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '500' },
  insightList: { gap: Spacing.xs },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  insightText: { fontSize: FontSize.sm, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  indexRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  indexName: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  indexPrice: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '600', marginRight: Spacing.md },
  indexChange: { fontSize: FontSize.sm, fontWeight: '600', minWidth: 60, textAlign: 'right' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2 },
  sectorRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sectorName: { fontSize: FontSize.sm, color: Colors.text, flex: 1 },
  sectorChange: { fontSize: FontSize.sm, fontWeight: '600' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  quickItem: { width: '46%', alignItems: 'center', paddingVertical: Spacing.md },
  quickIcon: {
    width: 52, height: 52, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm,
  },
  quickLabel: { fontSize: FontSize.sm, color: Colors.text, fontWeight: '500' },
});
