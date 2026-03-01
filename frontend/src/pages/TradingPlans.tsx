import React, { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStrategyStore } from '@/stores/strategyStore'
import { api, type BuiltinStrategy, type TradingStrategy, type StockSearchResult } from '@/lib/api'
import { formatRelativeTime, formatNumber, formatPercent, debounce } from '@/lib/utils'
import BacktestChart from '@/components/charts/BacktestChart'
import {
  Plus,
  Bell,
  BellOff,
  Trash2,
  Play,
  Pause,
  TrendingUp,
  TrendingDown,
  BarChart3,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  LineChart,
  Settings,
  ChevronRight,
  Eye,
  X,
  Loader2,
  Calendar,
} from 'lucide-react'

// ============ 策略类型标签 ============
const STRATEGY_TYPE_MAP: Record<string, { label: string; color: string }> = {
  SHORT: { label: '短线', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  MID: { label: '中线', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  LONG: { label: '长线', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  POSITION: { label: '仓位', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
}

function StrategyTypeBadge({ type }: { type: string }) {
  const info = STRATEGY_TYPE_MAP[type] || { label: type, color: 'bg-slate-600 text-slate-300' }
  return <Badge variant="outline" className={info.color}>{info.label}</Badge>
}

// ============ 主页面 ============
export default function TradingPlans() {
  const store = useStrategyStore()
  const [activeTab, setActiveTab] = useState('strategies')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingStrategy, setEditingStrategy] = useState<TradingStrategy | null>(null)
  const [backtestTarget, setBacktestTarget] = useState<TradingStrategy | null>(null)
  const [alertUnreadOnly, setAlertUnreadOnly] = useState(false)

  useEffect(() => {
    store.fetchBuiltinStrategies()
    store.fetchStrategies()
    store.fetchAlerts()
    store.fetchUnreadAlertCount()
  }, [])

  // 轮询未读数
  useEffect(() => {
    const timer = setInterval(() => store.fetchUnreadAlertCount(), 30000)
    return () => clearInterval(timer)
  }, [])

  const handleDeleteStrategy = async (id: string) => {
    if (!confirm('确认删除此策略？')) return
    try {
      await store.deleteStrategy(id)
    } catch {}
  }

  const handleToggleStatus = async (strategy: TradingStrategy) => {
    const newStatus = strategy.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    await store.updateStrategy(strategy.id, { status: newStatus })
  }

  const handleToggleAlert = async (strategy: TradingStrategy) => {
    await store.updateStrategy(strategy.id, { alert_enabled: !strategy.alert_enabled })
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">交易策略</p>
            <h1 className="text-2xl sm:text-3xl font-bold">策略管理与回测</h1>
            <p className="text-slate-400 mt-1">
              配置交易策略、接收信号提醒、K线回测分析
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => { setEditingStrategy(null); setShowCreateDialog(true) }}
            >
              <Plus className="w-4 h-4 mr-2" /> 新建策略
            </Button>
            <div className="relative">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-200"
                onClick={() => setActiveTab('alerts')}
              >
                <Bell className="w-4 h-4 mr-2" /> 提醒
              </Button>
              {store.unreadAlertCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {store.unreadAlertCount > 99 ? '99+' : store.unreadAlertCount}
                </span>
              )}
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="strategies" className="data-[state=active]:bg-slate-700">
              <Settings className="w-4 h-4 mr-1.5" /> 我的策略
            </TabsTrigger>
            <TabsTrigger value="builtin" className="data-[state=active]:bg-slate-700">
              <LineChart className="w-4 h-4 mr-1.5" /> 内置策略
            </TabsTrigger>
            <TabsTrigger value="alerts" className="data-[state=active]:bg-slate-700 relative">
              <Bell className="w-4 h-4 mr-1.5" /> 信号提醒
              {store.unreadAlertCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px]">
                  {store.unreadAlertCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="backtest" className="data-[state=active]:bg-slate-700">
              <BarChart3 className="w-4 h-4 mr-1.5" /> 回测分析
            </TabsTrigger>
          </TabsList>

          {/* === 我的策略 === */}
          <TabsContent value="strategies" className="mt-4">
            <StrategiesList
              strategies={store.strategies}
              builtinStrategies={store.builtinStrategies}
              isLoading={store.loadingStates['strategies']}
              onEdit={(s) => { setEditingStrategy(s); setShowCreateDialog(true) }}
              onDelete={handleDeleteStrategy}
              onToggleStatus={handleToggleStatus}
              onToggleAlert={handleToggleAlert}
              onBacktest={(s) => { setBacktestTarget(s); setActiveTab('backtest') }}
            />
          </TabsContent>

          {/* === 内置策略 === */}
          <TabsContent value="builtin" className="mt-4">
            <BuiltinStrategiesPanel strategies={store.builtinStrategies} />
          </TabsContent>

          {/* === 信号提醒 === */}
          <TabsContent value="alerts" className="mt-4">
            <AlertsPanel
              alerts={store.alerts}
              total={store.alertsTotal}
              unreadOnly={alertUnreadOnly}
              isLoading={store.loadingStates['alerts']}
              onToggleUnread={() => {
                const next = !alertUnreadOnly
                setAlertUnreadOnly(next)
                store.fetchAlerts(next)
              }}
              onMarkRead={(id) => store.markAlertRead(id)}
              onMarkAllRead={() => store.markAllAlertsRead()}
              onRefresh={() => store.fetchAlerts(alertUnreadOnly)}
            />
          </TabsContent>

          {/* === 回测分析 === */}
          <TabsContent value="backtest" className="mt-4">
            <BacktestPanel
              initialTarget={backtestTarget}
              builtinStrategies={store.builtinStrategies}
            />
          </TabsContent>
        </Tabs>

        {/* 创建/编辑策略对话框 */}
        <CreateStrategyDialog
          open={showCreateDialog}
          onClose={() => { setShowCreateDialog(false); setEditingStrategy(null) }}
          editingStrategy={editingStrategy}
          builtinStrategies={store.builtinStrategies}
        />
      </div>
    </div>
  )
}

// ============ 策略列表 ============
function StrategiesList({
  strategies,
  builtinStrategies,
  isLoading,
  onEdit,
  onDelete,
  onToggleStatus,
  onToggleAlert,
  onBacktest,
}: {
  strategies: TradingStrategy[]
  builtinStrategies: BuiltinStrategy[]
  isLoading?: boolean
  onEdit: (s: TradingStrategy) => void
  onDelete: (id: string) => void
  onToggleStatus: (s: TradingStrategy) => void
  onToggleAlert: (s: TradingStrategy) => void
  onBacktest: (s: TradingStrategy) => void
}) {
  const builtinMap = Object.fromEntries(builtinStrategies.map(b => [b.id, b]))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (strategies.length === 0) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="flex flex-col items-center justify-center py-16 text-slate-400">
          <LineChart className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium mb-1">暂无交易策略</p>
          <p className="text-sm">点击「新建策略」为关注的股票配置交易策略</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      {strategies.map(s => (
        <Card key={s.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-colors">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* 左侧信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="font-bold text-lg truncate">{s.name}</span>
                  <StrategyTypeBadge type={s.strategy_type} />
                  <Badge
                    variant="outline"
                    className={s.status === 'ACTIVE'
                      ? 'bg-green-500/10 text-green-400 border-green-500/30'
                      : 'bg-slate-600/30 text-slate-400 border-slate-500/30'}
                  >
                    {s.status === 'ACTIVE' ? '运行中' : '已暂停'}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <span className="font-mono text-slate-300">{s.stock_symbol}</span>
                  <span>{s.stock_name}</span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">
                    引用 {s.builtin_strategy_ids.length} 个内置策略
                  </span>
                </div>
                {s.builtin_strategy_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {s.builtin_strategy_ids.map(id => (
                      <span key={id} className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-0.5">
                        {builtinMap[id]?.name || id}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 右侧操作 */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-white"
                  onClick={() => onToggleAlert(s)}
                  title={s.alert_enabled ? '关闭提醒' : '开启提醒'}
                >
                  {s.alert_enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-white"
                  onClick={() => onToggleStatus(s)}
                  title={s.status === 'ACTIVE' ? '暂停策略' : '启动策略'}
                >
                  {s.status === 'ACTIVE' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-blue-400 hover:text-blue-300"
                  onClick={() => onBacktest(s)}
                  title="回测"
                >
                  <BarChart3 className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-white"
                  onClick={() => onEdit(s)}
                  title="编辑"
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => onDelete(s.id)}
                  title="删除"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============ 内置策略展示 ============
function BuiltinStrategiesPanel({ strategies }: { strategies: BuiltinStrategy[] }) {
  const grouped = {
    SHORT: strategies.filter(s => s.type === 'SHORT'),
    MID: strategies.filter(s => s.type === 'MID'),
    LONG: strategies.filter(s => s.type === 'LONG'),
    POSITION: strategies.filter(s => s.type === 'POSITION'),
  }

  const typeLabels: Record<string, string> = {
    SHORT: '短线策略',
    MID: '中线策略',
    LONG: '长线策略',
    POSITION: '仓位管理策略',
  }

  return (
    <div className="space-y-6">
      {(['SHORT', 'MID', 'LONG', 'POSITION'] as const).map(type => (
        grouped[type].length > 0 && (
        <div key={type}>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <StrategyTypeBadge type={type} />
            <span>{typeLabels[type]}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {grouped[type].map(s => (
              <Card key={s.id} className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <CardDescription className="text-slate-400 text-sm">
                    {s.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-slate-400">买入逻辑：</span>
                      <span className="text-slate-200">{s.buy_logic}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <TrendingDown className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-slate-400">卖出逻辑：</span>
                      <span className="text-slate-200">{s.sell_logic}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        )
      ))}
    </div>
  )
}

// ============ 信号提醒面板 ============
function AlertsPanel({
  alerts,
  total,
  unreadOnly,
  isLoading,
  onToggleUnread,
  onMarkRead,
  onMarkAllRead,
  onRefresh,
}: {
  alerts: any[]
  total: number
  unreadOnly: boolean
  isLoading?: boolean
  onToggleUnread: () => void
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onRefresh: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">共 {total} 条提醒</span>
          <Button
            size="sm"
            variant={unreadOnly ? 'default' : 'outline'}
            className={unreadOnly ? 'bg-blue-600' : 'border-slate-600 text-slate-300'}
            onClick={onToggleUnread}
          >
            仅未读
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-300"
            onClick={onMarkAllRead}
          >
            <CheckCircle className="w-4 h-4 mr-1" /> 全部已读
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-slate-600 text-slate-300"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {alerts.length === 0 ? (
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Bell className="w-10 h-10 mb-3 opacity-50" />
            <p>暂无提醒</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert: any) => (
            <Card
              key={alert.id}
              className={`border transition-colors cursor-pointer ${
                alert.is_read
                  ? 'bg-slate-800/50 border-slate-700/50'
                  : 'bg-slate-800 border-slate-600'
              }`}
              onClick={() => !alert.is_read && onMarkRead(alert.id)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  alert.alert_type === 'BUY_SIGNAL'
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-green-500/10 text-green-400'
                }`}>
                  {alert.alert_type === 'BUY_SIGNAL'
                    ? <TrendingUp className="w-5 h-5" />
                    : <TrendingDown className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${alert.is_read ? 'text-slate-400' : 'text-slate-200'}`}>
                    {alert.message}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatRelativeTime(alert.created_at)}
                  </p>
                </div>
                {!alert.is_read && (
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ============ 回测分析面板 ============
function BacktestPanel({
  initialTarget,
  builtinStrategies,
}: {
  initialTarget: TradingStrategy | null
  builtinStrategies: BuiltinStrategy[]
}) {
  const store = useStrategyStore()
  const [symbol, setSymbol] = useState(initialTarget?.stock_symbol || '')
  const [stockName, setStockName] = useState(initialTarget?.stock_name || '')
  const [selectedStrategyIds, setSelectedStrategyIds] = useState<string[]>(
    initialTarget?.builtin_strategy_ids || []
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [customRulesText, setCustomRulesText] = useState(initialTarget?.custom_rules || '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [initialCapital, setInitialCapital] = useState('100000')

  // 当 initialTarget 变化时更新
  useEffect(() => {
    if (initialTarget) {
      setSymbol(initialTarget.stock_symbol)
      setStockName(initialTarget.stock_name || '')
      setSelectedStrategyIds(initialTarget.builtin_strategy_ids)
      setCustomRulesText(initialTarget.custom_rules || '')
    }
  }, [initialTarget])

  const doStockSearch = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) { setSearchResults([]); return }
      setIsSearching(true)
      try {
        const results = await api.searchStocks(q, 8)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300),
    []
  )

  const handleStockSearchChange = (q: string) => {
    setSearchQuery(q)
    doStockSearch(q)
  }

  const handleSelectStock = (result: StockSearchResult) => {
    setSymbol(result.symbol)
    setStockName(result.name)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleClearStock = () => {
    setSymbol('')
    setStockName('')
  }

  const handleRunBacktest = async () => {
    if (!symbol.trim() || (selectedStrategyIds.length === 0 && !customRulesText.trim())) return
    try {
      await store.runBacktest({
        stock_symbol: symbol.trim(),
        builtin_strategy_ids: selectedStrategyIds,
        custom_rules: customRulesText.trim() || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        initial_capital: initialCapital ? parseFloat(initialCapital) : undefined,
      })
    } catch {}
  }

  const toggleStrategy = (id: string) => {
    setSelectedStrategyIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const result = store.backtestResult
  const isRunning = store.loadingStates['backtest']

  return (
    <div className="space-y-6">
      {/* 配置区 */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">回测配置</CardTitle>
          <CardDescription className="text-slate-400">选择股票和策略组合进行历史回测</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Label className="text-slate-300 mb-1.5 block">股票代码</Label>
            {symbol ? (
              <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-2.5 border border-slate-600 max-w-xs">
                <span className="font-mono text-blue-400">{symbol}</span>
                {stockName && <span className="text-slate-300">{stockName}</span>}
                <button
                  onClick={handleClearStock}
                  className="ml-auto text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="搜索股票代码或名称..."
                    value={searchQuery}
                    onChange={e => handleStockSearchChange(e.target.value)}
                    className="bg-slate-900 border-slate-600 text-white pl-9"
                  />
                  {isSearching && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                  )}
                </div>
                {searchResults.length > 0 && (
                  <div className="absolute z-10 max-w-xs w-full mt-1 bg-slate-900 border border-slate-600 rounded-lg max-h-48 overflow-y-auto">
                    {searchResults.map(r => (
                      <button
                        key={r.symbol}
                        onClick={() => handleSelectStock(r)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2"
                      >
                        <span className="font-mono text-blue-400 text-sm">{r.symbol}</span>
                        <span className="text-slate-300 text-sm">{r.name}</span>
                        <span className="text-slate-500 text-xs ml-auto">{r.exchange}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <Label className="text-slate-300 mb-2 block">选择策略（可多选）</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {builtinStrategies.map(s => {
                const selected = selectedStrategyIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleStrategy(s.id)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      selected
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-200'
                        : 'bg-slate-900/50 border-slate-600 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        selected ? 'bg-blue-500 border-blue-500' : 'border-slate-500'
                      }`}>
                        {selected && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm font-medium">{s.name}</span>
                      <StrategyTypeBadge type={s.type} />
                    </div>
                    <p className="text-xs text-slate-400 mt-1 ml-6">{s.description}</p>
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <Label className="text-slate-300 mb-1.5 block">自定义规则（可选）</Label>
            <textarea
              placeholder={"输入自定义交易规则，例如：\n止损-5%\n止盈10%\n最多持有30天"}
              value={customRulesText}
              onChange={e => setCustomRulesText(e.target.value)}
              rows={3}
              className="w-full rounded-lg bg-slate-900 border border-slate-600 text-white text-sm px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
            />
            <p className="text-xs text-slate-500 mt-1">
              支持：止损(-X%)、止盈(+X%)、最大持有天数，可与内置策略配合使用
            </p>
          </div>
          <div>
            <Label className="text-slate-300 mb-1.5 block flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> 回测时间段（可选）
            </Label>
            <div className="flex items-center gap-3 max-w-md">
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder="开始日期"
              />
              <span className="text-slate-500 flex-shrink-0">至</span>
              <DatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder="结束日期"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              不设置则使用全部历史数据回测
            </p>
          </div>
          <div>
            <Label className="text-slate-300 mb-1.5 block flex items-center gap-1.5">
              <Settings className="w-4 h-4" /> 计划投入资金
            </Label>
            <div className="flex items-center gap-2 max-w-xs">
              <span className="text-slate-400 text-sm">¥</span>
              <Input
                type="number"
                value={initialCapital}
                onChange={e => setInitialCapital(e.target.value)}
                className="bg-slate-900 border-slate-600 text-white font-mono"
                placeholder="100000"
                min={1000}
                step={10000}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              仓位管理将按此资金分配，默认10万元
            </p>
          </div>
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleRunBacktest}
            disabled={isRunning || !symbol.trim() || (selectedStrategyIds.length === 0 && !customRulesText.trim())}
          >
            {isRunning ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 回测中...</>
            ) : (
              <><Play className="w-4 h-4 mr-2" /> 开始回测</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 回测结果 */}
      {result && (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard label="总交易次数" value={String(result.summary.total_trades)} />
            <StatCard
              label="胜率"
              value={formatPercent(result.summary.win_rate)}
              color={result.summary.win_rate >= 50 ? 'text-red-400' : 'text-green-400'}
            />
            <StatCard
              label="总收益率"
              value={`${result.summary.total_return >= 0 ? '+' : ''}${formatPercent(result.summary.total_return)}`}
              color={result.summary.total_return >= 0 ? 'text-red-400' : 'text-green-400'}
            />
            <StatCard
              label="最大回撤"
              value={formatPercent(result.summary.max_drawdown)}
              color="text-orange-400"
            />
            <StatCard label="盈亏比" value={formatNumber(result.summary.profit_factor)} />
            <StatCard
              label="最终资金"
              value={`¥${formatNumber(result.summary.final_capital, 0)}`}
              color={result.summary.final_capital >= result.summary.initial_capital ? 'text-red-400' : 'text-green-400'}
            />
          </div>

          {/* 胜负细分 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="盈利次数" value={String(result.summary.total_wins)} color="text-red-400" />
            <StatCard label="亏损次数" value={String(result.summary.total_losses)} color="text-green-400" />
            <StatCard label="平均盈利" value={`${formatPercent(result.summary.avg_win)}`} color="text-red-400" />
            <StatCard label="平均亏损" value={`${formatPercent(result.summary.avg_loss)}`} color="text-green-400" />
          </div>

          {/* K线图 */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <LineChart className="w-5 h-5" />
                K线回测图
                <span className="text-sm font-normal text-slate-400">
                  （红▲买入 绿▼卖出）
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BacktestChart klineData={result.kline_data} height={520} />
            </CardContent>
          </Card>

          {/* 交易明细 */}
          {result.trades.length > 0 && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">交易明细</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700">
                        <th className="text-left py-2 px-3">#</th>
                        <th className="text-left py-2 px-3">操作</th>
                        <th className="text-left py-2 px-3">日期</th>
                        <th className="text-left py-2 px-3">触发规则</th>
                        <th className="text-right py-2 px-3">价格</th>
                        <th className="text-right py-2 px-3">数量(股)</th>
                        <th className="text-right py-2 px-3">收益率</th>
                        <th className="text-right py-2 px-3">持有天数</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trades.map((t, i) => {
                        const isBuy = t.trade_direction === 'BUY'
                        const isHold = t.trade_direction === 'HOLD'
                        const actionColors: Record<string, string> = {
                          '建仓': 'bg-red-500/15 text-red-400 border-red-500/30',
                          '加仓': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
                          '减仓': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
                          '清仓': 'bg-green-500/15 text-green-400 border-green-500/30',
                          '持有中': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30 animate-pulse',
                        }
                        const actionStyle = actionColors[t.action_type || ''] || 'bg-slate-600/20 text-slate-300'
                        return (
                          <tr key={i} className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${isHold ? 'bg-yellow-500/5' : ''}`}>
                            <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                            <td className="py-2 px-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${actionStyle}`}>
                                {t.action_type || (isBuy ? '买入' : isHold ? '持有中' : '卖出')}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              {isHold ? (
                                <span className="text-yellow-400">{t.entry_date} 至今</span>
                              ) : (
                                isBuy ? t.entry_date : t.exit_date
                              )}
                            </td>
                            <td className="py-2 px-3 text-xs">
                              {isHold ? (
                                <span className="text-yellow-400">{t.entry_strategy || '持仓中'}</span>
                              ) : isBuy ? (
                                <span className="text-blue-400">{t.entry_strategy || '-'}</span>
                              ) : (
                                <span className="text-amber-400">{t.strategy || '-'}</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {isHold ? (
                                <span className="text-yellow-300">{t.exit_price}<span className="text-slate-500 text-xs ml-1">(现价)</span></span>
                              ) : (
                                isBuy ? t.entry_price : t.exit_price
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-300">
                              {t.quantity || '-'}
                            </td>
                            <td className={`py-2 px-3 text-right font-mono ${
                              isHold
                                ? t.pnl_pct >= 0 ? 'text-red-400' : 'text-green-400'
                                : !isBuy && t.pnl_pct !== 0
                                  ? t.pnl_pct >= 0 ? 'text-red-400' : 'text-green-400'
                                  : 'text-slate-500'
                            }`}>
                              {isHold
                                ? `${t.pnl_pct >= 0 ? '+' : ''}${t.pnl_pct}%`
                                : !isBuy && t.pnl_pct !== 0
                                  ? `${t.pnl_pct >= 0 ? '+' : ''}${t.pnl_pct}%`
                                  : '-'}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-400">
                              {isHold ? `${t.hold_days}天` : !isBuy && t.hold_days ? `${t.hold_days}天` : '-'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ============ 统计卡片组件 ============
function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardContent className="p-3">
        <p className="text-xs text-slate-400 mb-1">{label}</p>
        <p className={`text-lg font-bold ${color || 'text-white'}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

// ============ 创建/编辑策略对话框 ============
function CreateStrategyDialog({
  open,
  onClose,
  editingStrategy,
  builtinStrategies,
}: {
  open: boolean
  onClose: () => void
  editingStrategy: TradingStrategy | null
  builtinStrategies: BuiltinStrategy[]
}) {
  const store = useStrategyStore()
  const [name, setName] = useState('')
  const [stockSymbol, setStockSymbol] = useState('')
  const [stockName, setStockName] = useState('')
  const [strategyType, setStrategyType] = useState<'SHORT' | 'MID' | 'LONG'>('SHORT')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [customRules, setCustomRules] = useState('')
  const [notes, setNotes] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    if (editingStrategy) {
      setName(editingStrategy.name)
      setStockSymbol(editingStrategy.stock_symbol)
      setStockName(editingStrategy.stock_name)
      setStrategyType(editingStrategy.strategy_type)
      setSelectedIds(editingStrategy.builtin_strategy_ids)
      setCustomRules(editingStrategy.custom_rules || '')
      setNotes(editingStrategy.notes || '')
    } else {
      setName('')
      setStockSymbol('')
      setStockName('')
      setStrategyType('SHORT')
      setSelectedIds([])
      setCustomRules('')
      setNotes('')
    }
    setSearchQuery('')
    setSearchResults([])
    setSubmitError('')
  }, [editingStrategy, open])

  const doSearch = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) { setSearchResults([]); return }
      setIsSearching(true)
      try {
        const results = await api.searchStocks(q, 8)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300),
    []
  )

  const handleSearchChange = (q: string) => {
    setSearchQuery(q)
    doSearch(q)
  }

  const handleSelectStock = (result: StockSearchResult) => {
    setStockSymbol(result.symbol)
    setStockName(result.name)
    setSearchQuery('')
    setSearchResults([])
  }

  const toggleBuiltin = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = async () => {
    setSubmitError('')
    try {
      if (editingStrategy) {
        await store.updateStrategy(editingStrategy.id, {
          name,
          strategy_type: strategyType,
          builtin_strategy_ids: selectedIds,
          custom_rules: customRules || undefined,
          notes: notes || undefined,
        })
      } else {
        await store.createStrategy({
          stock_symbol: stockSymbol,
          stock_name: stockName,
          name,
          strategy_type: strategyType,
          builtin_strategy_ids: selectedIds,
          custom_rules: customRules || undefined,
          notes: notes || undefined,
        })
      }
      onClose()
    } catch (err: any) {
      setSubmitError(err?.message || '操作失败，请重试')
    }
  }

  const isSubmitting = store.loadingStates['createStrategy'] || store.loadingStates['updateStrategy']
  const canSubmit = name.trim() && stockSymbol.trim() && stockName.trim() && (selectedIds.length > 0 || customRules.trim())

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingStrategy ? '编辑策略' : '新建策略'}</DialogTitle>
          <DialogDescription className="text-slate-400">
            为股票配置交易策略，引用内置策略并可添加自定义规则
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* 股票搜索 */}
          {!editingStrategy && (
            <div className="relative">
              <Label className="text-slate-300 mb-1.5 block">选择股票</Label>
              {stockSymbol ? (
                <div className="flex items-center gap-2 bg-slate-900 rounded-lg p-2.5 border border-slate-600">
                  <span className="font-mono text-blue-400">{stockSymbol}</span>
                  <span className="text-slate-300">{stockName}</span>
                  <button
                    onClick={() => { setStockSymbol(''); setStockName('') }}
                    className="ml-auto text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="搜索股票代码或名称..."
                      value={searchQuery}
                      onChange={e => handleSearchChange(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-white pl-9"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                    )}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-600 rounded-lg max-h-48 overflow-y-auto">
                      {searchResults.map(r => (
                        <button
                          key={r.symbol}
                          onClick={() => handleSelectStock(r)}
                          className="w-full text-left px-3 py-2 hover:bg-slate-700 flex items-center gap-2"
                        >
                          <span className="font-mono text-blue-400 text-sm">{r.symbol}</span>
                          <span className="text-slate-300 text-sm">{r.name}</span>
                          <span className="text-slate-500 text-xs ml-auto">{r.exchange}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 策略名称 */}
          <div>
            <Label className="text-slate-300 mb-1.5 block">策略名称</Label>
            <Input
              placeholder="为你的策略起个名称"
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-slate-900 border-slate-600 text-white"
            />
          </div>

          {/* 策略类型 */}
          <div>
            <Label className="text-slate-300 mb-1.5 block">策略周期</Label>
            <div className="flex gap-2">
              {(['SHORT', 'MID', 'LONG'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setStrategyType(t)}
                  className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                    strategyType === t
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-slate-900 border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  {STRATEGY_TYPE_MAP[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* 内置策略选择 */}
          <div>
            <Label className="text-slate-300 mb-1.5 block">引用内置策略（可选）</Label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
              {builtinStrategies.map(s => {
                const checked = selectedIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleBuiltin(s.id)}
                    className={`text-left p-2.5 rounded-lg border transition-all ${
                      checked
                        ? 'bg-blue-600/15 border-blue-500/40'
                        : 'bg-slate-900/50 border-slate-600 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        checked ? 'bg-blue-500 border-blue-500' : 'border-slate-500'
                      }`}>
                        {checked && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <span className="text-sm font-medium text-slate-200">{s.name}</span>
                      <StrategyTypeBadge type={s.type} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 自定义规则 */}
          <div>
            <Label className="text-slate-300 mb-1.5 block">自定义规则（可选）</Label>
            <textarea
              placeholder="输入自定义买卖规则，例如：&#10;买入：MACD金叉且RSI<30&#10;卖出：收益率达到10%或跌破5日均线"
              value={customRules}
              onChange={e => setCustomRules(e.target.value)}
              rows={4}
              className="w-full rounded-lg bg-slate-900 border border-slate-600 text-white text-sm px-3 py-2 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 resize-y"
            />
            <p className="text-xs text-slate-500 mt-1">
              可与内置策略配合使用，也可单独使用自定义规则
            </p>
          </div>

          {/* 备注 */}
          <div>
            <Label className="text-slate-300 mb-1.5 block">备注（可选）</Label>
            <Input
              placeholder="策略备注说明"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="bg-slate-900 border-slate-600 text-white"
            />
          </div>

          {submitError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="border-slate-600 text-slate-300" onClick={onClose}>
              取消
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 保存中...</>
              ) : (
                editingStrategy ? '保存修改' : '创建策略'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
