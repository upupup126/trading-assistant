import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BacktestSummary } from '../lib/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

interface BacktestStatsProps {
  summary: BacktestSummary;
}

function StatItem({ label, value, color, icon }: { label: string; value: string; color?: string; icon?: string }) {
  return (
    <View style={styles.statItem}>
      {icon && <Ionicons name={icon as any} size={14} color={color || Colors.textSecondary} />}
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function BacktestStats({ summary }: BacktestStatsProps) {
  const totalReturn = summary.total_return ?? 0;
  const returnColor = totalReturn >= 0 ? Colors.success : Colors.danger;
  const finalCapital = summary.final_capital ?? summary.initial_capital;
  const capitalChange = finalCapital - summary.initial_capital;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="stats-chart" size={18} color={Colors.primary} />
        <Text style={styles.title}>回测统计</Text>
      </View>

      <View style={styles.mainRow}>
        <View style={styles.mainItem}>
          <Text style={[styles.mainValue, { color: returnColor }]}>
            {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
          </Text>
          <Text style={styles.mainLabel}>总收益率</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.mainItem}>
          <Text style={[styles.mainValue, { color: Colors.warning }]}>
            {(summary.win_rate ?? 0).toFixed(1)}%
          </Text>
          <Text style={styles.mainLabel}>胜率</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.mainItem}>
          <Text style={[styles.mainValue, { color: Colors.danger }]}>
            {(summary.max_drawdown ?? 0).toFixed(2)}%
          </Text>
          <Text style={styles.mainLabel}>最大回撤</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <StatItem label="总交易数" value={String(summary.total_trades ?? 0)} icon="swap-horizontal" />
        <StatItem label="盈利次数" value={String(summary.total_wins ?? 0)} color={Colors.success} icon="trending-up" />
        <StatItem label="亏损次数" value={String(summary.total_losses ?? 0)} color={Colors.danger} icon="trending-down" />
        <StatItem label="盈亏比" value={(summary.profit_factor ?? 0).toFixed(2)} icon="analytics" />
        <StatItem label="平均盈利" value={`${(summary.avg_win ?? 0).toFixed(2)}%`} color={Colors.success} />
        <StatItem label="平均亏损" value={`${(summary.avg_loss ?? 0).toFixed(2)}%`} color={Colors.danger} />
      </View>

      <View style={styles.capitalRow}>
        <View style={styles.capitalItem}>
          <Text style={styles.capitalLabel}>初始资金</Text>
          <Text style={styles.capitalValue}>¥{summary.initial_capital.toLocaleString()}</Text>
        </View>
        <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
        <View style={styles.capitalItem}>
          <Text style={styles.capitalLabel}>最终资金</Text>
          <Text style={[styles.capitalValue, { color: returnColor }]}>¥{finalCapital.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  title: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  mainRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  mainItem: { alignItems: 'center', flex: 1 },
  mainValue: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  mainLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4 },
  divider: { width: 1, height: 40, backgroundColor: Colors.border },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statItem: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.bg,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  statValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  capitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  capitalItem: { alignItems: 'center' },
  capitalLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 2 },
  capitalValue: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
});
