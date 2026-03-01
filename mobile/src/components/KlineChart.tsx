import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native';
import { useAIStore } from '../stores/aiStore';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

const PERIOD_OPTIONS = [
  { value: '5d', label: '5日' },
  { value: '1mo', label: '1月' },
  { value: '3mo', label: '3月' },
  { value: '6mo', label: '6月' },
  { value: '1y', label: '1年' },
];

interface KlineChartProps {
  symbol: string;
  title?: string;
}

interface CandleData {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export default function KlineChart({ symbol, title }: KlineChartProps) {
  const { stockHistories, loadingStates, getStockHistory } = useAIStore();
  const [period, setPeriod] = useState('1mo');
  const [selectedCandle, setSelectedCandle] = useState<CandleData | null>(null);

  const historyKey = `${symbol}_${period}`;
  const loadingKey = `stockHistory_${symbol}_${period}`;
  const isLoading = loadingStates[loadingKey];
  const historyData = stockHistories[historyKey];

  useEffect(() => {
    if (symbol) {
      getStockHistory(symbol, period);
    }
  }, [symbol, period]);

  const data: CandleData[] = historyData?.data || [];

  if (!symbol) return null;

  const chartWidth = SCREEN_WIDTH - Spacing.lg * 2 - Spacing.lg * 2;
  const chartHeight = 200;
  const volumeHeight = 50;

  // 计算价格范围
  const prices = data.flatMap((d) => [d.high, d.low]);
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 100;
  const priceRange = maxPrice - minPrice || 1;
  const paddedMin = minPrice - priceRange * 0.02;
  const paddedMax = maxPrice + priceRange * 0.02;
  const paddedRange = paddedMax - paddedMin;

  const volumes = data.map((d) => d.volume);
  const maxVolume = Math.max(...volumes, 1);

  const candleWidth = data.length > 0 ? Math.max(chartWidth / data.length - 1, 2) : 4;
  const bodyWidth = Math.max(candleWidth * 0.7, 1.5);

  const yScale = (val: number) => {
    return chartHeight - ((val - paddedMin) / paddedRange) * chartHeight;
  };

  const displayCandle = selectedCandle || (data.length > 0 ? data[data.length - 1] : null);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title || `${symbol} K线`}</Text>
      </View>

      {/* 周期选择器 */}
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.periodBtn, period === opt.value && styles.periodBtnActive]}
            onPress={() => setPeriod(opt.value)}
          >
            <Text style={[styles.periodText, period === opt.value && styles.periodTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 实时数据条 */}
      {displayCandle && (
        <View style={styles.infoBar}>
          <Text style={styles.infoDate}>{displayCandle.date}</Text>
          <Text style={styles.infoItem}>开 <Text style={styles.infoValue}>{displayCandle.open.toFixed(2)}</Text></Text>
          <Text style={styles.infoItem}>收 <Text style={[
            styles.infoValue,
            { color: displayCandle.close >= displayCandle.open ? Colors.success : Colors.danger },
          ]}>{displayCandle.close.toFixed(2)}</Text></Text>
          <Text style={styles.infoItem}>高 <Text style={styles.infoValue}>{displayCandle.high.toFixed(2)}</Text></Text>
          <Text style={styles.infoItem}>低 <Text style={styles.infoValue}>{displayCandle.low.toFixed(2)}</Text></Text>
        </View>
      )}

      {isLoading ? (
        <View style={[styles.chartArea, { height: chartHeight + volumeHeight }]}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>加载K线数据...</Text>
        </View>
      ) : data.length === 0 ? (
        <View style={[styles.chartArea, { height: chartHeight + volumeHeight }]}>
          <Text style={styles.emptyText}>暂无K线数据</Text>
        </View>
      ) : (
        <View>
          {/* SVG-like K线 using RN Views */}
          <View style={[styles.chartCanvas, { height: chartHeight, width: chartWidth }]}>
            {/* 水平网格线 */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <View key={pct} style={[styles.gridLine, { top: pct * chartHeight }]}>
                <Text style={styles.gridLabel}>
                  {(paddedMax - pct * paddedRange).toFixed(0)}
                </Text>
              </View>
            ))}

            {/* 蜡烛 */}
            {data.map((d, i) => {
              const isUp = d.close >= d.open;
              const color = isUp ? Colors.success : Colors.danger;
              const x = i * (chartWidth / data.length) + (chartWidth / data.length - bodyWidth) / 2;
              const wickX = i * (chartWidth / data.length) + chartWidth / data.length / 2;

              const highY = yScale(d.high);
              const lowY = yScale(d.low);
              const openY = yScale(d.open);
              const closeY = yScale(d.close);
              const bodyTop = Math.min(openY, closeY);
              const bodyH = Math.max(Math.abs(openY - closeY), 1);

              return (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.8}
                  onPress={() => setSelectedCandle(d)}
                  style={{ position: 'absolute', left: i * (chartWidth / data.length), width: chartWidth / data.length, top: 0, bottom: 0 }}
                >
                  {/* 影线 */}
                  <View style={{
                    position: 'absolute',
                    left: wickX - i * (chartWidth / data.length) - 0.5,
                    top: highY,
                    width: 1,
                    height: lowY - highY,
                    backgroundColor: color,
                  }} />
                  {/* 实体 */}
                  <View style={{
                    position: 'absolute',
                    left: x - i * (chartWidth / data.length),
                    top: bodyTop,
                    width: bodyWidth,
                    height: bodyH,
                    backgroundColor: isUp ? 'transparent' : color,
                    borderWidth: isUp ? 1 : 0,
                    borderColor: color,
                  }} />
                </TouchableOpacity>
              );
            })}
          </View>

          {/* 成交量 */}
          <View style={[styles.volumeCanvas, { height: volumeHeight, width: chartWidth }]}>
            {data.map((d, i) => {
              const isUp = d.close >= d.open;
              const h = (d.volume / maxVolume) * volumeHeight;
              return (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: i * (chartWidth / data.length) + (chartWidth / data.length - bodyWidth) / 2,
                    bottom: 0,
                    width: bodyWidth,
                    height: Math.max(h, 1),
                    backgroundColor: isUp ? Colors.success + '66' : Colors.danger + '66',
                  }}
                />
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.border,
  },
  periodBtnActive: {
    backgroundColor: Colors.primary,
  },
  periodText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  periodTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  infoBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.sm,
    paddingVertical: 4,
  },
  infoDate: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginRight: 4,
  },
  infoItem: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  infoValue: {
    color: Colors.text,
    fontWeight: '500',
  },
  chartArea: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  chartCanvas: {
    position: 'relative',
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  gridLabel: {
    fontSize: 8,
    color: Colors.textMuted,
    position: 'absolute',
    right: 0,
    top: -8,
  },
  volumeCanvas: {
    position: 'relative',
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
