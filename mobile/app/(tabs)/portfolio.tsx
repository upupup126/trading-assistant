import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, RefreshControl, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePortfolioStore } from '../../src/stores/portfolioStore';
import StockSearch from '../../src/components/StockSearch';
import {
  ACCOUNTS, StockSearchResult, AddPositionRequest, RecordTradeRequest, UpdateFundRequest,
} from '../../src/lib/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';

type SubTab = 'positions' | 'trade' | 'history' | 'fund';

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export default function PortfolioScreen() {
  const {
    currentAccount, positions, positionQuotes, quotesLoading,
    tradeHistory, tradeHistoryTotal, fund, isLoading, error,
    setCurrentAccount, fetchPositions, fetchPositionQuotes, addPosition,
    deletePosition, fetchTradeHistory, recordTrade, fetchFund, updateFund, clearError,
  } = usePortfolioStore();

  const [subTab, setSubTab] = useState<SubTab>('positions');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [showRecordTrade, setShowRecordTrade] = useState(false);
  const [showEditFund, setShowEditFund] = useState(false);

  // Add position form
  const [addStock, setAddStock] = useState<StockSearchResult | null>(null);
  const [addQty, setAddQty] = useState('');
  const [addCost, setAddCost] = useState('');

  // Record trade form
  const [tradeStock, setTradeStock] = useState<StockSearchResult | null>(null);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [tradeQty, setTradeQty] = useState('');
  const [tradePrice, setTradePrice] = useState('');
  const [tradeNotes, setTradeNotes] = useState('');

  // Edit fund form
  const [fundCapital, setFundCapital] = useState('');
  const [fundCash, setFundCash] = useState('');

  useEffect(() => {
    loadData();
  }, [currentAccount]);

  useEffect(() => {
    if (positions.length > 0) fetchPositionQuotes();
  }, [positions]);

  const loadData = async () => {
    await Promise.all([fetchPositions(), fetchFund(), fetchTradeHistory()]);
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    if (positions.length > 0) await fetchPositionQuotes();
    setRefreshing(false);
  }, [currentAccount, positions.length]);

  const handleDeletePosition = (id: string, name: string) => {
    Alert.alert('删除持仓', `确认删除 ${name}？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => deletePosition(id) },
    ]);
  };

  const handleAddPosition = async () => {
    if (!addStock) { Alert.alert('提示', '请搜索并选择股票'); return; }
    if (!addQty || !addCost) { Alert.alert('提示', '请填写数量和成本'); return; }
    try {
      await addPosition({
        symbol: addStock.symbol,
        name: addStock.name,
        exchange: addStock.exchange,
        account: currentAccount,
        quantity: Number(addQty),
        avg_cost: Number(addCost),
      });
      setShowAddPosition(false);
      resetAddForm();
    } catch {}
  };

  const handleRecordTrade = async () => {
    if (!tradeStock) { Alert.alert('提示', '请搜索并选择股票'); return; }
    if (!tradeQty || !tradePrice) { Alert.alert('提示', '请填写数量和价格'); return; }
    try {
      await recordTrade({
        symbol: tradeStock.symbol,
        name: tradeStock.name,
        exchange: tradeStock.exchange,
        account: currentAccount,
        trade_type: tradeType,
        quantity: Number(tradeQty),
        price: Number(tradePrice),
        notes: tradeNotes || undefined,
      });
      setShowRecordTrade(false);
      resetTradeForm();
    } catch {}
  };

  const handleUpdateFund = async () => {
    if (!fundCapital || !fundCash) { Alert.alert('提示', '请填写完整'); return; }
    try {
      await updateFund({ account: currentAccount, total_capital: Number(fundCapital), available_cash: Number(fundCash) });
      setShowEditFund(false);
    } catch {}
  };

  const resetAddForm = () => { setAddStock(null); setAddQty(''); setAddCost(''); };
  const resetTradeForm = () => { setTradeStock(null); setTradeType('BUY'); setTradeQty(''); setTradePrice(''); setTradeNotes(''); };

  const currentLabel = ACCOUNTS.find((a) => a.key === currentAccount)?.label || currentAccount;
  const totalCost = positions.reduce((s, p) => s + p.total_cost, 0);
  const totalPnl = positions.reduce((s, p) => {
    const quote = positionQuotes[p.symbol];
    const price = quote?.price ?? p.current_price;
    return price ? s + (price - p.avg_cost) * p.quantity : s + (p.unrealized_pnl ?? 0);
  }, 0);

  const subTabs: { key: SubTab; label: string; icon: string }[] = [
    { key: 'positions', label: '持仓', icon: 'pie-chart-outline' },
    { key: 'trade', label: '记录', icon: 'swap-horizontal-outline' },
    { key: 'history', label: '历史', icon: 'time-outline' },
    { key: 'fund', label: '资金', icon: 'wallet-outline' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Account switcher */}
      <View style={styles.accountRow}>
        {ACCOUNTS.map((acc) => (
          <TouchableOpacity
            key={acc.key}
            style={[styles.accountBtn, currentAccount === acc.key && styles.accountBtnActive]}
            onPress={() => setCurrentAccount(acc.key)}
          >
            <Ionicons
              name="business-outline"
              size={14}
              color={currentAccount === acc.key ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.accountText, currentAccount === acc.key && styles.accountTextActive]}>
              {acc.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fund overview */}
      {fund && (
        <View style={styles.fundOverview}>
          <View style={styles.fundItem}>
            <Text style={styles.fundLabel}>总资产</Text>
            <Text style={styles.fundValue}>¥{(fund.total_assets ?? 0).toLocaleString()}</Text>
          </View>
          <View style={styles.fundDivider} />
          <View style={styles.fundItem}>
            <Text style={styles.fundLabel}>持仓市值</Text>
            <Text style={styles.fundValue}>¥{(fund.position_value ?? 0).toLocaleString()}</Text>
          </View>
          <View style={styles.fundDivider} />
          <View style={styles.fundItem}>
            <Text style={styles.fundLabel}>浮动盈亏</Text>
            <Text style={[styles.fundValue, { color: totalPnl >= 0 ? Colors.success : Colors.danger }]}>
              {totalPnl >= 0 ? '+' : ''}¥{totalPnl.toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {/* Sub tabs */}
      <View style={styles.subTabBar}>
        {subTabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.subTab, subTab === t.key && styles.subTabActive]}
            onPress={() => setSubTab(t.key)}
          >
            <Ionicons
              name={t.icon as any}
              size={15}
              color={subTab === t.key ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.subTabText, subTab === t.key && styles.subTabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* ===== 持仓列表 ===== */}
        {subTab === 'positions' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>持仓列表 ({positions.length})</Text>
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddPosition(true)}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addBtnText}>添加</Text>
              </TouchableOpacity>
            </View>

            {positions.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="pie-chart-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>暂无持仓</Text>
              </View>
            ) : positions.map((pos) => {
              const quote = positionQuotes[pos.symbol];
              const price = quote?.price ?? pos.current_price;
              const pnl = price ? (price - pos.avg_cost) * pos.quantity : (pos.unrealized_pnl ?? 0);
              const pnlPct = pos.avg_cost > 0 && price ? ((price - pos.avg_cost) / pos.avg_cost * 100) : 0;

              return (
                <Card key={pos.id}>
                  <View style={styles.posHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.posName}>{pos.stock_name}</Text>
                      <Text style={styles.posSymbol}>{pos.symbol}</Text>
                    </View>
                    <View style={styles.posPrice}>
                      <Text style={styles.posPriceValue}>
                        {price ? `¥${price.toFixed(2)}` : '-'}
                      </Text>
                      {quotesLoading && <ActivityIndicator size="small" color={Colors.primary} />}
                    </View>
                  </View>
                  <View style={styles.posStats}>
                    <View style={styles.posStatItem}>
                      <Text style={styles.posStatLabel}>数量</Text>
                      <Text style={styles.posStatValue}>{pos.quantity}</Text>
                    </View>
                    <View style={styles.posStatItem}>
                      <Text style={styles.posStatLabel}>成本</Text>
                      <Text style={styles.posStatValue}>¥{pos.avg_cost.toFixed(2)}</Text>
                    </View>
                    <View style={styles.posStatItem}>
                      <Text style={styles.posStatLabel}>盈亏</Text>
                      <Text style={[styles.posStatValue, { color: pnl >= 0 ? Colors.success : Colors.danger }]}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.posStatItem}>
                      <Text style={styles.posStatLabel}>涨跌</Text>
                      <Text style={[styles.posStatValue, { color: pnlPct >= 0 ? Colors.success : Colors.danger }]}>
                        {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteRow}
                    onPress={() => handleDeletePosition(pos.id, pos.stock_name)}
                  >
                    <Ionicons name="trash-outline" size={14} color={Colors.danger} />
                    <Text style={styles.deleteText}>删除</Text>
                  </TouchableOpacity>
                </Card>
              );
            })}
          </>
        )}

        {/* ===== 记录交易 ===== */}
        {subTab === 'trade' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>记录交易</Text>
            </View>
            <Card>
              <StockSearch onSelect={(s) => setTradeStock(s)} placeholder="搜索股票" />
              {tradeStock && (
                <Text style={styles.selectedStock}>已选: {tradeStock.symbol} {tradeStock.name}</Text>
              )}

              <View style={styles.tradeTypeRow}>
                <TouchableOpacity
                  style={[styles.tradeTypeBtn, tradeType === 'BUY' && { backgroundColor: Colors.success + '22', borderColor: Colors.success }]}
                  onPress={() => setTradeType('BUY')}
                >
                  <Ionicons name="trending-up" size={16} color={tradeType === 'BUY' ? Colors.success : Colors.textMuted} />
                  <Text style={[styles.tradeTypeText, tradeType === 'BUY' && { color: Colors.success }]}>买入</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tradeTypeBtn, tradeType === 'SELL' && { backgroundColor: Colors.danger + '22', borderColor: Colors.danger }]}
                  onPress={() => setTradeType('SELL')}
                >
                  <Ionicons name="trending-down" size={16} color={tradeType === 'SELL' ? Colors.danger : Colors.textMuted} />
                  <Text style={[styles.tradeTypeText, tradeType === 'SELL' && { color: Colors.danger }]}>卖出</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>数量</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="股数"
                    placeholderTextColor={Colors.textMuted}
                    value={tradeQty}
                    onChangeText={setTradeQty}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>价格</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="成交价"
                    placeholderTextColor={Colors.textMuted}
                    value={tradePrice}
                    onChangeText={setTradePrice}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <TextInput
                style={[styles.formInput, { marginTop: Spacing.sm }]}
                placeholder="备注（可选）"
                placeholderTextColor={Colors.textMuted}
                value={tradeNotes}
                onChangeText={setTradeNotes}
              />

              <TouchableOpacity
                style={[styles.submitBtn, isLoading && { opacity: 0.6 }]}
                onPress={handleRecordTrade}
                disabled={isLoading}
              >
                {isLoading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.submitBtnText}>提交交易记录</Text>
                )}
              </TouchableOpacity>
            </Card>
          </>
        )}

        {/* ===== 交易历史 ===== */}
        {subTab === 'history' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>交易记录 ({tradeHistoryTotal})</Text>
            </View>
            {tradeHistory.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="time-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>暂无记录</Text>
              </View>
            ) : tradeHistory.map((trade) => (
              <Card key={trade.id}>
                <View style={styles.tradeRow}>
                  <View style={[styles.tradeBadge, { backgroundColor: trade.trade_type === 'BUY' ? Colors.success + '22' : Colors.danger + '22' }]}>
                    <Text style={{ color: trade.trade_type === 'BUY' ? Colors.success : Colors.danger, fontSize: FontSize.xs, fontWeight: '700' }}>
                      {trade.trade_type === 'BUY' ? '买入' : '卖出'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tradeName}>{trade.stock_name}</Text>
                    <Text style={styles.tradeSymbol}>{trade.symbol}</Text>
                  </View>
                  <View style={styles.tradeRight}>
                    <Text style={styles.tradeAmount}>¥{trade.total_amount.toFixed(2)}</Text>
                    <Text style={styles.tradeDetail}>{trade.quantity}股 × ¥{trade.price.toFixed(2)}</Text>
                  </View>
                </View>
                <View style={styles.tradeFooter}>
                  <Text style={styles.tradeTime}>{new Date(trade.executed_at).toLocaleString('zh-CN')}</Text>
                  {trade.notes && <Text style={styles.tradeNotes}>{trade.notes}</Text>}
                </View>
              </Card>
            ))}
          </>
        )}

        {/* ===== 资金管理 ===== */}
        {subTab === 'fund' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>资金管理 - {currentLabel}</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => {
                  setFundCapital(fund?.total_capital?.toString() || '');
                  setFundCash(fund?.available_cash?.toString() || '');
                  setShowEditFund(true);
                }}
              >
                <Ionicons name="create-outline" size={16} color="#fff" />
                <Text style={styles.addBtnText}>编辑</Text>
              </TouchableOpacity>
            </View>

            {fund ? (
              <Card>
                <View style={styles.fundGrid}>
                  <View style={styles.fundGridItem}>
                    <Ionicons name="wallet" size={20} color={Colors.primary} />
                    <Text style={styles.fundGridLabel}>总资本</Text>
                    <Text style={styles.fundGridValue}>¥{(fund.total_capital ?? 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.fundGridItem}>
                    <Ionicons name="cash" size={20} color={Colors.success} />
                    <Text style={styles.fundGridLabel}>可用资金</Text>
                    <Text style={[styles.fundGridValue, { color: Colors.success }]}>¥{(fund.available_cash ?? 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.fundGridItem}>
                    <Ionicons name="pie-chart" size={20} color={Colors.warning} />
                    <Text style={styles.fundGridLabel}>持仓市值</Text>
                    <Text style={[styles.fundGridValue, { color: Colors.warning }]}>¥{(fund.position_value ?? 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.fundGridItem}>
                    <Ionicons name="briefcase" size={20} color={Colors.cyan} />
                    <Text style={styles.fundGridLabel}>总资产</Text>
                    <Text style={[styles.fundGridValue, { color: Colors.cyan }]}>¥{(fund.total_assets ?? 0).toLocaleString()}</Text>
                  </View>
                </View>
              </Card>
            ) : (
              <View style={styles.empty}>
                <Ionicons name="wallet-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>未配置资金</Text>
                <Text style={styles.emptyHint}>点击编辑按钮设置资金</Text>
              </View>
            )}
          </>
        )}

        {error && (
          <TouchableOpacity style={styles.errorBar} onPress={clearError}>
            <Ionicons name="alert-circle" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Ionicons name="close" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ===== Add Position Modal ===== */}
      <Modal visible={showAddPosition} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>添加持仓</Text>
              <TouchableOpacity onPress={() => { setShowAddPosition(false); resetAddForm(); }}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <StockSearch onSelect={(s) => setAddStock(s)} placeholder="搜索要添加的股票" />
            {addStock && (
              <Text style={styles.selectedStock}>已选: {addStock.symbol} {addStock.name}</Text>
            )}
            <View style={styles.formRow}>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>数量</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="持仓股数"
                  placeholderTextColor={Colors.textMuted}
                  value={addQty}
                  onChangeText={setAddQty}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.formField}>
                <Text style={styles.formLabel}>成本价</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="平均成本"
                  placeholderTextColor={Colors.textMuted}
                  value={addCost}
                  onChangeText={setAddCost}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, isLoading && { opacity: 0.6 }]}
              onPress={handleAddPosition}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.submitBtnText}>确认添加</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===== Edit Fund Modal ===== */}
      <Modal visible={showEditFund} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>编辑资金 - {currentLabel}</Text>
              <TouchableOpacity onPress={() => setShowEditFund(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.formField}>
              <Text style={styles.formLabel}>总资本</Text>
              <TextInput
                style={styles.formInput}
                placeholder="总投入资本"
                placeholderTextColor={Colors.textMuted}
                value={fundCapital}
                onChangeText={setFundCapital}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={[styles.formField, { marginTop: Spacing.sm }]}>
              <Text style={styles.formLabel}>可用资金</Text>
              <TextInput
                style={styles.formInput}
                placeholder="当前可用现金"
                placeholderTextColor={Colors.textMuted}
                value={fundCash}
                onChangeText={setFundCash}
                keyboardType="decimal-pad"
              />
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, isLoading && { opacity: 0.6 }]}
              onPress={handleUpdateFund}
              disabled={isLoading}
            >
              {isLoading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.submitBtnText}>保存</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  accountRow: {
    flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm, backgroundColor: Colors.bgCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  accountBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border,
  },
  accountBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  accountText: { fontSize: FontSize.xs, color: Colors.textMuted },
  accountTextActive: { color: Colors.primary, fontWeight: '600' },
  fundOverview: {
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.bgCard, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  fundItem: { alignItems: 'center' },
  fundLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  fundValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginTop: 2 },
  fundDivider: { width: 1, height: 30, backgroundColor: Colors.border },
  subTabBar: {
    flexDirection: 'row', backgroundColor: Colors.bgCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: Spacing.sm,
  },
  subTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: Spacing.md,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  subTabActive: { borderBottomColor: Colors.primary },
  subTabText: { fontSize: FontSize.sm, color: Colors.textMuted },
  subTabTextActive: { color: Colors.primary, fontWeight: '600' },
  content: { padding: Spacing.lg, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.bgCard, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  addBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: FontSize.lg, color: Colors.textMuted, marginTop: Spacing.md },
  emptyHint: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.xs },
  posHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  posName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  posSymbol: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  posPrice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  posPriceValue: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  posStats: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  posStatItem: { alignItems: 'center' },
  posStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  posStatValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginTop: 2 },
  deleteRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    gap: 4, marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  deleteText: { fontSize: FontSize.xs, color: Colors.danger },
  selectedStock: {
    fontSize: FontSize.sm, color: Colors.primary, fontWeight: '500',
    marginTop: Spacing.sm, marginBottom: Spacing.xs,
  },
  tradeTypeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  tradeTypeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 40, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  tradeTypeText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  formRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  formField: { flex: 1 },
  formLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginBottom: 4 },
  formInput: {
    backgroundColor: Colors.bg, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 42,
    color: Colors.text, fontSize: FontSize.sm,
  },
  submitBtn: {
    backgroundColor: Colors.primary, height: 44, borderRadius: BorderRadius.md,
    justifyContent: 'center', alignItems: 'center', marginTop: Spacing.lg,
  },
  submitBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
  tradeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  tradeBadge: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.sm,
  },
  tradeName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  tradeSymbol: { fontSize: FontSize.xs, color: Colors.textMuted },
  tradeRight: { alignItems: 'flex-end' },
  tradeAmount: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  tradeDetail: { fontSize: FontSize.xs, color: Colors.textMuted },
  tradeFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  tradeTime: { fontSize: FontSize.xs, color: Colors.textMuted },
  tradeNotes: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, textAlign: 'right' },
  fundGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  fundGridItem: {
    width: '46%', alignItems: 'center', paddingVertical: Spacing.lg,
    backgroundColor: Colors.bg, borderRadius: BorderRadius.md,
    gap: 4,
  },
  fundGridLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  fundGridValue: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.danger + '15', padding: Spacing.md,
    borderRadius: BorderRadius.md, marginTop: Spacing.md,
  },
  errorText: { flex: 1, fontSize: FontSize.xs, color: Colors.danger },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.xxl, paddingBottom: 40,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
});
