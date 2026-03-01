import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStrategyStore } from '../../src/stores/strategyStore';
import StockSearch from '../../src/components/StockSearch';
import BacktestStats from '../../src/components/BacktestStats';
import {
  api, StockSearchResult, BuiltinStrategy, TradingStrategy,
  CreateStrategyRequest, BacktestTrade,
} from '../../src/lib/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';

type MainTab = 'strategies' | 'builtin' | 'alerts' | 'backtest';

const STRATEGY_TYPE_MAP: Record<string, { label: string; color: string }> = {
  SHORT: { label: '短线', color: Colors.orange },
  MID: { label: '中线', color: Colors.primary },
  LONG: { label: '长线', color: Colors.purple },
  POSITION: { label: '仓位', color: Colors.success },
};

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function TypeBadge({ type }: { type: string }) {
  const info = STRATEGY_TYPE_MAP[type] || { label: type, color: Colors.textMuted };
  return (
    <View style={[styles.typeBadge, { backgroundColor: info.color + '22', borderColor: info.color + '44' }]}>
      <Text style={[styles.typeBadgeText, { color: info.color }]}>{info.label}</Text>
    </View>
  );
}

export default function TradingPlansScreen() {
  const store = useStrategyStore();
  const [mainTab, setMainTab] = useState<MainTab>('strategies');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [alertUnreadOnly, setAlertUnreadOnly] = useState(false);

  // Create form
  const [formStock, setFormStock] = useState<StockSearchResult | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<'SHORT' | 'MID' | 'LONG'>('SHORT');
  const [formBuiltinIds, setFormBuiltinIds] = useState<string[]>([]);
  const [formCustomRules, setFormCustomRules] = useState('');

  // Backtest form
  const [btStock, setBtStock] = useState<StockSearchResult | null>(null);
  const [btStrategyIds, setBtStrategyIds] = useState<string[]>([]);
  const [btCustomRules, setBtCustomRules] = useState('');
  const [btStartDate, setBtStartDate] = useState('');
  const [btEndDate, setBtEndDate] = useState('');
  const [btCapital, setBtCapital] = useState('100000');

  useEffect(() => {
    store.fetchBuiltinStrategies();
    store.fetchStrategies();
    store.fetchAlerts();
    store.fetchUnreadAlertCount();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => store.fetchUnreadAlertCount(), 30000);
    return () => clearInterval(timer);
  }, []);

  const handleDeleteStrategy = (id: string) => {
    Alert.alert('确认', '删除此策略？', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => store.deleteStrategy(id) },
    ]);
  };

  const handleToggleStatus = async (s: TradingStrategy) => {
    await store.updateStrategy(s.id, { status: s.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' });
  };

  const handleToggleAlert = async (s: TradingStrategy) => {
    await store.updateStrategy(s.id, { alert_enabled: !s.alert_enabled });
  };

  const handleCreateStrategy = async () => {
    if (!formStock) { Alert.alert('提示', '请选择股票'); return; }
    if (!formName.trim()) { Alert.alert('提示', '请输入策略名称'); return; }
    if (formBuiltinIds.length === 0 && !formCustomRules.trim()) {
      Alert.alert('提示', '请至少选择一个内置策略或填写自定义规则');
      return;
    }
    try {
      await store.createStrategy({
        stock_symbol: formStock.symbol,
        stock_name: formStock.name,
        name: formName.trim(),
        strategy_type: formType,
        builtin_strategy_ids: formBuiltinIds,
        custom_rules: formCustomRules.trim() || undefined,
        alert_enabled: true,
      });
      setShowCreateModal(false);
      resetCreateForm();
    } catch {}
  };

  const resetCreateForm = () => {
    setFormStock(null);
    setFormName('');
    setFormType('SHORT');
    setFormBuiltinIds([]);
    setFormCustomRules('');
  };

  const toggleBuiltinId = (id: string, target: string[], setter: (v: string[]) => void) => {
    setter(target.includes(id) ? target.filter((x) => x !== id) : [...target, id]);
  };

  const handleRunBacktest = async () => {
    if (!btStock) { Alert.alert('提示', '请选择股票'); return; }
    if (btStrategyIds.length === 0 && !btCustomRules.trim()) {
      Alert.alert('提示', '请至少选择一个策略或填写自定义规则');
      return;
    }
    try {
      await store.runBacktest({
        stock_symbol: btStock.symbol,
        builtin_strategy_ids: btStrategyIds,
        custom_rules: btCustomRules.trim() || undefined,
        start_date: btStartDate || undefined,
        end_date: btEndDate || undefined,
        initial_capital: Number(btCapital) || 100000,
      });
    } catch {}
  };

  const mainTabs: { key: MainTab; label: string; icon: string }[] = [
    { key: 'strategies', label: '策略', icon: 'settings-outline' },
    { key: 'builtin', label: '内置', icon: 'flash-outline' },
    { key: 'alerts', label: '信号', icon: 'notifications-outline' },
    { key: 'backtest', label: '回测', icon: 'bar-chart-outline' },
  ];

  const isBacktestLoading = store.loadingStates.backtest;

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Main tabs */}
      <View style={styles.tabBar}>
        {mainTabs.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, mainTab === t.key && styles.tabActive]}
            onPress={() => setMainTab(t.key)}
          >
            <Ionicons
              name={t.icon as any}
              size={15}
              color={mainTab === t.key ? Colors.primary : Colors.textMuted}
            />
            <Text style={[styles.tabText, mainTab === t.key && styles.tabTextActive]}>
              {t.label}
            </Text>
            {t.key === 'alerts' && store.unreadAlertCount > 0 && (
              <View style={styles.unreadDot}>
                <Text style={styles.unreadText}>
                  {store.unreadAlertCount > 99 ? '99+' : store.unreadAlertCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* ===== 我的策略 ===== */}
        {mainTab === 'strategies' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>我的策略 ({store.strategies.length})</Text>
              <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.createBtnText}>新建</Text>
              </TouchableOpacity>
            </View>

            {store.loadingStates.strategies ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
            ) : store.strategies.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>暂无策略</Text>
                <Text style={styles.emptyHint}>点击新建创建你的第一个策略</Text>
              </View>
            ) : store.strategies.map((s) => (
              <Card key={s.id}>
                <View style={styles.strategyHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.strategyNameRow}>
                      <Text style={styles.strategyName}>{s.name}</Text>
                      <TypeBadge type={s.strategy_type} />
                    </View>
                    <Text style={styles.strategyStock}>{s.stock_name} ({s.stock_symbol})</Text>
                  </View>
                  <View style={[styles.statusDot, {
                    backgroundColor: s.status === 'ACTIVE' ? Colors.success : Colors.textMuted,
                  }]} />
                </View>

                {s.custom_rules ? (
                  <Text style={styles.customRules} numberOfLines={2}>{s.custom_rules}</Text>
                ) : null}

                <View style={styles.strategyActions}>
                  <TouchableOpacity style={styles.actionItem} onPress={() => handleToggleStatus(s)}>
                    <Ionicons
                      name={s.status === 'ACTIVE' ? 'pause-circle-outline' : 'play-circle-outline'}
                      size={20}
                      color={s.status === 'ACTIVE' ? Colors.warning : Colors.success}
                    />
                    <Text style={styles.actionLabel}>{s.status === 'ACTIVE' ? '暂停' : '启动'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionItem} onPress={() => handleToggleAlert(s)}>
                    <Ionicons
                      name={s.alert_enabled ? 'notifications' : 'notifications-off-outline'}
                      size={20}
                      color={s.alert_enabled ? Colors.primary : Colors.textMuted}
                    />
                    <Text style={styles.actionLabel}>{s.alert_enabled ? '提醒开' : '提醒关'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionItem} onPress={() => handleDeleteStrategy(s.id)}>
                    <Ionicons name="trash-outline" size={20} color={Colors.danger} />
                    <Text style={[styles.actionLabel, { color: Colors.danger }]}>删除</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </>
        )}

        {/* ===== 内置策略 ===== */}
        {mainTab === 'builtin' && (
          <>
            <Text style={styles.sectionTitle}>内置策略库</Text>
            {store.loadingStates.builtin ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
            ) : Object.entries(
              store.builtinStrategies.reduce<Record<string, BuiltinStrategy[]>>((acc, s) => {
                const key = s.type || 'OTHER';
                (acc[key] = acc[key] || []).push(s);
                return acc;
              }, {})
            ).map(([type, list]) => (
              <View key={type} style={{ marginTop: Spacing.md }}>
                <View style={styles.groupHeader}>
                  <TypeBadge type={type} />
                  <Text style={styles.groupCount}>{list.length} 个策略</Text>
                </View>
                {list.map((b) => (
                  <Card key={b.id}>
                    <Text style={styles.builtinName}>{b.name}</Text>
                    <Text style={styles.builtinDesc}>{b.description}</Text>
                    <View style={styles.logicRow}>
                      <View style={styles.logicBox}>
                        <Text style={[styles.logicLabel, { color: Colors.success }]}>买入逻辑</Text>
                        <Text style={styles.logicText}>{b.buy_logic}</Text>
                      </View>
                      <View style={styles.logicBox}>
                        <Text style={[styles.logicLabel, { color: Colors.danger }]}>卖出逻辑</Text>
                        <Text style={styles.logicText}>{b.sell_logic}</Text>
                      </View>
                    </View>
                  </Card>
                ))}
              </View>
            ))}
          </>
        )}

        {/* ===== 信号提醒 ===== */}
        {mainTab === 'alerts' && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>策略信号</Text>
              <View style={styles.alertControls}>
                <TouchableOpacity
                  style={[styles.filterBtn, alertUnreadOnly && styles.filterBtnActive]}
                  onPress={() => {
                    const next = !alertUnreadOnly;
                    setAlertUnreadOnly(next);
                    store.fetchAlerts(next);
                  }}
                >
                  <Text style={[styles.filterBtnText, alertUnreadOnly && { color: Colors.primary }]}>
                    仅未读
                  </Text>
                </TouchableOpacity>
                {store.unreadAlertCount > 0 && (
                  <TouchableOpacity style={styles.markAllBtn} onPress={() => store.markAllAlertsRead()}>
                    <Ionicons name="checkmark-done" size={16} color={Colors.primary} />
                    <Text style={styles.markAllText}>全部已读</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {store.loadingStates.alerts ? (
              <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
            ) : store.alerts.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="notifications-off-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>暂无信号</Text>
              </View>
            ) : store.alerts.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                activeOpacity={0.7}
                onPress={() => !alert.is_read && store.markAlertRead(alert.id)}
              >
                <Card style={!alert.is_read ? { borderColor: Colors.primary + '66' } : undefined}>
                  <View style={styles.alertRow}>
                    <Ionicons
                      name={alert.alert_type === 'BUY_SIGNAL' ? 'trending-up' : 'trending-down'}
                      size={20}
                      color={alert.alert_type === 'BUY_SIGNAL' ? Colors.success : Colors.danger}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={styles.alertTitleRow}>
                        <Text style={styles.alertSymbol}>{alert.stock_symbol}</Text>
                        <Text style={[styles.alertType, {
                          color: alert.alert_type === 'BUY_SIGNAL' ? Colors.success : Colors.danger,
                        }]}>
                          {alert.alert_type === 'BUY_SIGNAL' ? '买入信号' : '卖出信号'}
                        </Text>
                        {!alert.is_read && <View style={styles.unreadIndicator} />}
                      </View>
                      <Text style={styles.alertMessage} numberOfLines={2}>{alert.message}</Text>
                      {alert.triggered_strategy && (
                        <Text style={styles.alertStrategy}>触发: {alert.triggered_strategy}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.alertTime}>
                    {new Date(alert.created_at).toLocaleString('zh-CN')}
                  </Text>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* ===== 回测分析 ===== */}
        {mainTab === 'backtest' && (
          <>
            <Text style={styles.sectionTitle}>策略回测</Text>
            <Card>
              <StockSearch onSelect={(s) => setBtStock(s)} placeholder="选择回测股票" />
              {btStock && (
                <Text style={styles.selectedStock}>已选: {btStock.symbol} {btStock.name}</Text>
              )}

              <Text style={[styles.formLabel, { marginTop: Spacing.md }]}>选择内置策略</Text>
              <View style={styles.builtinCheckList}>
                {store.builtinStrategies.map((b) => {
                  const selected = btStrategyIds.includes(b.id);
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.builtinCheck, selected && styles.builtinCheckActive]}
                      onPress={() => toggleBuiltinId(b.id, btStrategyIds, setBtStrategyIds)}
                    >
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={selected ? Colors.primary : Colors.textMuted}
                      />
                      <Text style={[styles.builtinCheckText, selected && { color: Colors.text }]}>
                        {b.name}
                      </Text>
                      <TypeBadge type={b.type} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.formLabel}>自定义规则（可选）</Text>
              <TextInput
                style={[styles.formInput, { height: 70, textAlignVertical: 'top', paddingVertical: Spacing.sm }]}
                placeholder="例如: 当RSI<30时买入..."
                placeholderTextColor={Colors.textMuted}
                value={btCustomRules}
                onChangeText={setBtCustomRules}
                multiline
              />

              <View style={styles.formRow}>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>开始日期</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="2024-01-01"
                    placeholderTextColor={Colors.textMuted}
                    value={btStartDate}
                    onChangeText={setBtStartDate}
                  />
                </View>
                <View style={styles.formField}>
                  <Text style={styles.formLabel}>结束日期</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="2025-01-01"
                    placeholderTextColor={Colors.textMuted}
                    value={btEndDate}
                    onChangeText={setBtEndDate}
                  />
                </View>
              </View>

              <View style={[styles.formField, { marginTop: Spacing.sm }]}>
                <Text style={styles.formLabel}>初始资金</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="100000"
                  placeholderTextColor={Colors.textMuted}
                  value={btCapital}
                  onChangeText={setBtCapital}
                  keyboardType="numeric"
                />
              </View>

              <TouchableOpacity
                style={[styles.runBtn, isBacktestLoading && { opacity: 0.6 }]}
                onPress={handleRunBacktest}
                disabled={isBacktestLoading}
              >
                {isBacktestLoading ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.runBtnText}>回测中...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="play" size={18} color="#fff" />
                    <Text style={styles.runBtnText}>执行回测</Text>
                  </>
                )}
              </TouchableOpacity>
            </Card>

            {/* Backtest result */}
            {store.backtestResult && (
              <>
                <View style={{ marginTop: Spacing.md }}>
                  <BacktestStats summary={store.backtestResult.summary} />
                </View>

                <Card style={{ marginTop: Spacing.md }}>
                  <View style={styles.tradeListHeader}>
                    <Ionicons name="list" size={18} color={Colors.primary} />
                    <Text style={styles.tradeListTitle}>
                      交易明细 ({store.backtestResult.trades.length})
                    </Text>
                  </View>
                  {store.backtestResult.trades.map((t, i) => (
                    <View key={i} style={styles.tradeItem}>
                      <View style={styles.tradeItemHeader}>
                        <View style={[styles.dirBadge, {
                          backgroundColor: (t.trade_direction === '买入' || t.action_type === 'BUY')
                            ? Colors.success + '22' : Colors.danger + '22',
                        }]}>
                          <Text style={{
                            color: (t.trade_direction === '买入' || t.action_type === 'BUY')
                              ? Colors.success : Colors.danger,
                            fontSize: FontSize.xs, fontWeight: '700',
                          }}>
                            {t.trade_direction || (t.action_type === 'BUY' ? '买入' : '卖出')}
                          </Text>
                        </View>
                        <Text style={styles.tradeItemDate}>{t.entry_date}</Text>
                        {t.strategy && <Text style={styles.tradeItemStrategy}>{t.strategy}</Text>}
                      </View>
                      <View style={styles.tradeItemStats}>
                        <View style={styles.tradeStatCol}>
                          <Text style={styles.tradeStatLabel}>价格</Text>
                          <Text style={styles.tradeStatValue}>¥{t.entry_price?.toFixed(2)}</Text>
                        </View>
                        {t.quantity != null && (
                          <View style={styles.tradeStatCol}>
                            <Text style={styles.tradeStatLabel}>数量</Text>
                            <Text style={styles.tradeStatValue}>{t.quantity}</Text>
                          </View>
                        )}
                        {t.amount != null && (
                          <View style={styles.tradeStatCol}>
                            <Text style={styles.tradeStatLabel}>金额</Text>
                            <Text style={styles.tradeStatValue}>¥{t.amount.toLocaleString()}</Text>
                          </View>
                        )}
                        {t.position_ratio != null && (
                          <View style={styles.tradeStatCol}>
                            <Text style={styles.tradeStatLabel}>仓位</Text>
                            <Text style={styles.tradeStatValue}>{t.position_ratio}%</Text>
                          </View>
                        )}
                        <View style={styles.tradeStatCol}>
                          <Text style={styles.tradeStatLabel}>收益率</Text>
                          <Text style={[styles.tradeStatValue, {
                            color: (t.pnl_pct ?? 0) >= 0 ? Colors.success : Colors.danger,
                          }]}>
                            {(t.pnl_pct ?? 0) >= 0 ? '+' : ''}{(t.pnl_pct ?? 0).toFixed(2)}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </Card>
              </>
            )}
          </>
        )}

        {store.error && (
          <TouchableOpacity style={styles.errorBar} onPress={store.clearError}>
            <Ionicons name="alert-circle" size={16} color={Colors.danger} />
            <Text style={styles.errorText}>{store.error}</Text>
            <Ionicons name="close" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ===== Create Strategy Modal ===== */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>新建策略</Text>
                <TouchableOpacity onPress={() => { setShowCreateModal(false); resetCreateForm(); }}>
                  <Ionicons name="close" size={24} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <StockSearch onSelect={(s) => setFormStock(s)} placeholder="搜索目标股票" />
              {formStock && (
                <Text style={styles.selectedStock}>已选: {formStock.symbol} {formStock.name}</Text>
              )}

              <View style={[styles.formField, { marginTop: Spacing.md }]}>
                <Text style={styles.formLabel}>策略名称</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="输入策略名称"
                  placeholderTextColor={Colors.textMuted}
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <Text style={[styles.formLabel, { marginTop: Spacing.md }]}>策略类型</Text>
              <View style={styles.typeRow}>
                {(['SHORT', 'MID', 'LONG'] as const).map((t) => {
                  const info = STRATEGY_TYPE_MAP[t];
                  const selected = formType === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.typeOption, selected && { borderColor: info.color, backgroundColor: info.color + '15' }]}
                      onPress={() => setFormType(t)}
                    >
                      <Text style={[styles.typeOptionText, selected && { color: info.color }]}>{info.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.formLabel, { marginTop: Spacing.md }]}>选择内置策略</Text>
              <View style={styles.builtinCheckList}>
                {store.builtinStrategies.map((b) => {
                  const selected = formBuiltinIds.includes(b.id);
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.builtinCheck, selected && styles.builtinCheckActive]}
                      onPress={() => toggleBuiltinId(b.id, formBuiltinIds, setFormBuiltinIds)}
                    >
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={18}
                        color={selected ? Colors.primary : Colors.textMuted}
                      />
                      <Text style={[styles.builtinCheckText, selected && { color: Colors.text }]}>{b.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.formLabel}>自定义规则（可选）</Text>
              <TextInput
                style={[styles.formInput, { height: 70, textAlignVertical: 'top', paddingVertical: Spacing.sm }]}
                placeholder="补充自定义交易规则..."
                placeholderTextColor={Colors.textMuted}
                value={formCustomRules}
                onChangeText={setFormCustomRules}
                multiline
              />

              <TouchableOpacity
                style={[styles.submitBtn, store.loadingStates.createStrategy && { opacity: 0.6 }]}
                onPress={handleCreateStrategy}
                disabled={store.loadingStates.createStrategy}
              >
                {store.loadingStates.createStrategy ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.submitBtnText}>创建策略</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  unreadDot: {
    backgroundColor: Colors.danger, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, marginLeft: 2,
  },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '700' },
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
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  createBtnText: { color: '#fff', fontSize: FontSize.xs, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: FontSize.lg, color: Colors.textMuted, marginTop: Spacing.md },
  emptyHint: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: Spacing.xs },
  typeBadge: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: FontSize.xs, fontWeight: '600' },
  strategyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  strategyNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  strategyName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  strategyStock: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  customRules: {
    fontSize: FontSize.xs, color: Colors.textSecondary,
    backgroundColor: Colors.bg, borderRadius: BorderRadius.sm,
    padding: Spacing.sm, marginTop: Spacing.sm,
  },
  strategyActions: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  actionItem: { alignItems: 'center', gap: 2 },
  actionLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  groupCount: { fontSize: FontSize.xs, color: Colors.textMuted },
  builtinName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  builtinDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.sm },
  logicRow: { gap: Spacing.sm },
  logicBox: {
    backgroundColor: Colors.bg, borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
  },
  logicLabel: { fontSize: FontSize.xs, fontWeight: '600', marginBottom: 2 },
  logicText: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 16 },
  alertControls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  filterBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: 4,
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border,
  },
  filterBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  filterBtnText: { fontSize: FontSize.xs, color: Colors.textMuted },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  markAllText: { fontSize: FontSize.xs, color: Colors.primary },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  alertTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  alertSymbol: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  alertType: { fontSize: FontSize.xs, fontWeight: '600' },
  unreadIndicator: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary,
  },
  alertMessage: { fontSize: FontSize.xs, color: Colors.textSecondary, lineHeight: 18, marginTop: 4 },
  alertStrategy: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  alertTime: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.sm, textAlign: 'right' },
  selectedStock: {
    fontSize: FontSize.sm, color: Colors.primary, fontWeight: '500',
    marginTop: Spacing.sm, marginBottom: Spacing.xs,
  },
  formLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, fontWeight: '500', marginBottom: 4 },
  formInput: {
    backgroundColor: Colors.bg, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 42,
    color: Colors.text, fontSize: FontSize.sm,
  },
  formRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  formField: { flex: 1 },
  builtinCheckList: { gap: Spacing.xs, marginBottom: Spacing.md },
  builtinCheck: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border,
  },
  builtinCheckActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  builtinCheckText: { flex: 1, fontSize: FontSize.sm, color: Colors.textMuted },
  typeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  typeOption: {
    flex: 1, height: 36, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  typeOptionText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  runBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Colors.success,
    height: 46, borderRadius: BorderRadius.md, marginTop: Spacing.lg,
  },
  runBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
  submitBtn: {
    backgroundColor: Colors.primary, height: 44, borderRadius: BorderRadius.md,
    justifyContent: 'center', alignItems: 'center', marginTop: Spacing.lg,
  },
  submitBtnText: { color: '#fff', fontSize: FontSize.md, fontWeight: '600' },
  tradeListHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tradeListTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  tradeItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tradeItemHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  dirBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tradeItemDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  tradeItemStrategy: { fontSize: FontSize.xs, color: Colors.textSecondary, flex: 1, textAlign: 'right' },
  tradeItemStats: { flexDirection: 'row', justifyContent: 'space-between' },
  tradeStatCol: { alignItems: 'center' },
  tradeStatLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  tradeStatValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginTop: 2 },
  errorBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.danger + '15', padding: Spacing.md,
    borderRadius: BorderRadius.md, marginTop: Spacing.md,
  },
  errorText: { flex: 1, fontSize: FontSize.xs, color: Colors.danger },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
  },
  modalScroll: {
    flex: 1, marginTop: 60,
  },
  modalContent: {
    backgroundColor: Colors.bgCard, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.xxl, paddingBottom: 40,
    minHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
});
