import { useEffect, useState, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, CheckCheck, ChevronLeft, TrendingUp, TrendingDown, X, BarChart3, Info, ArrowUpCircle, ArrowDownCircle, Filter, BellOff } from 'lucide-react'
import { useStrategyStore } from '@/stores/strategyStore'
import { StrategyAlert } from '@/lib/api'

interface AlertDetails {
  strategy_name?: string
  strategy_id?: string
  signal_type?: string
  price?: number
  date?: string
  stock_name?: string
  recommendation?: string
  reason?: string
  quote?: {
    current_price?: number
    change_percent?: number
    high?: number
    low?: number
    prev_close?: number
    volume?: number
  }
}

function parseDetails(details: string | null): AlertDetails | null {
  if (!details) return null
  try {
    return JSON.parse(details)
  } catch {
    return null
  }
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHour < 24) return `${diffHour} 小时前`
  if (diffDay < 7) return `${diffDay} 天前`
  return d.toLocaleDateString('zh-CN')
}

function formatVolume(vol: number): string {
  if (vol >= 1e8) return (vol / 1e8).toFixed(2) + '亿'
  if (vol >= 1e4) return (vol / 1e4).toFixed(0) + '万'
  return vol.toString()
}

export default function Alerts() {
  const { alerts, alertsTotal, fetchAlerts, markAlertRead, markAllAlertsRead, fetchUnreadAlertCount, unreadAlertCount, mutedAlerts, muteAlert, unmuteAlert, fetchMutedAlerts } = useStrategyStore()
  const [selectedAlert, setSelectedAlert] = useState<StrategyAlert | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'BUY_SIGNAL' | 'SELL_SIGNAL'>('all')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      await Promise.all([
        fetchAlerts(false, 50, 0),
        fetchUnreadAlertCount(),
        fetchMutedAlerts(),
      ])
      setIsLoading(false)
    }
    load()
  }, [fetchAlerts, fetchUnreadAlertCount, fetchMutedAlerts])

  const filteredAlerts = useMemo(() => {
    return alerts.filter(a => {
      if (filterType === 'unread') return !a.is_read
      if (filterType === 'BUY_SIGNAL') return a.alert_type === 'BUY_SIGNAL'
      if (filterType === 'SELL_SIGNAL') return a.alert_type === 'SELL_SIGNAL'
      return true
    })
  }, [alerts, filterType])

  const handleOpenAlert = async (alert: StrategyAlert) => {
    setSelectedAlert(alert)
    if (!alert.is_read) {
      await markAlertRead(alert.id)
    }
    // 滚动到顶部确保详情面板可见
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleMarkAllRead = async () => {
    await markAllAlertsRead()
  }

  const details = selectedAlert ? parseDetails(selectedAlert.details) : null

  const isSelectedMuted = useMemo(() => {
    if (!selectedAlert) return false
    return mutedAlerts.some(
      m => m.stock_symbol === selectedAlert.stock_symbol && m.alert_type === selectedAlert.alert_type
    )
  }, [selectedAlert, mutedAlerts])

  const handleToggleMute = useCallback(async () => {
    if (!selectedAlert) return
    if (isSelectedMuted) {
      await unmuteAlert(selectedAlert.stock_symbol, selectedAlert.alert_type)
    } else {
      await muteAlert(selectedAlert.stock_symbol, selectedAlert.alert_type)
    }
  }, [selectedAlert, isSelectedMuted, muteAlert, unmuteAlert])

  // 判断列表中某条消息对应的 stock+type 是否已静音
  const isMutedFn = useCallback((alert: StrategyAlert) => {
    return mutedAlerts.some(
      m => m.stock_symbol === alert.stock_symbol && m.alert_type === alert.alert_type
    )
  }, [mutedAlerts])

  // 渲染消息列表
  const renderAlertsList = () => (
    <div className="space-y-3">
      {isLoading ? (
        <div className="text-center py-16 text-slate-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3" />
          加载中...
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无通知消息</p>
          <p className="text-sm mt-1">策略触发的买卖信号将显示在这里</p>
        </div>
      ) : (
        filteredAlerts.map(alert => {
          const d = parseDetails(alert.details)
          const isBuy = alert.alert_type === 'BUY_SIGNAL'
          const isSelected = selectedAlert?.id === alert.id
          const displayName = alert.stock_name || d?.stock_name || alert.stock_symbol

          return (
            <Card
              key={alert.id}
              className={`cursor-pointer transition-all duration-200 border ${
                isSelected
                  ? 'bg-slate-700 border-blue-500'
                  : alert.is_read
                    ? 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-800'
                    : 'bg-slate-800 border-slate-600 hover:bg-slate-750'
              }`}
              onClick={() => handleOpenAlert(alert)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 p-1.5 rounded-lg ${isBuy ? 'bg-red-500/15' : 'bg-green-500/15'}`}>
                    {isBuy
                      ? <TrendingUp className="w-4 h-4 text-red-400" />
                      : <TrendingDown className="w-4 h-4 text-green-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white truncate">
                        {displayName}
                      </span>
                      <Badge className={`text-xs shrink-0 ${isBuy
                        ? 'bg-red-500/20 text-red-300 border-red-500/30'
                        : 'bg-green-500/20 text-green-300 border-green-500/30'
                      }`}>
                        {isBuy ? '买入' : '卖出'}
                      </Badge>
                      {!alert.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                      {isMutedFn(alert) && (
                        <BellOff className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-slate-300 truncate">
                      {d?.strategy_name && `${d.strategy_name} · `}
                      {d?.price ? `¥${d.price.toFixed(2)}` : ''}
                    </p>
                    {alert.message && (
                      <p className="text-sm text-slate-400 mt-1 line-clamp-2">{alert.message}</p>
                    )}
                    <p className="text-xs text-slate-500 mt-1">{formatTime(alert.created_at)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )

  // 渲染详情面板
  const renderDetailPanel = () => {
    if (!selectedAlert) return null
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 hover:text-white"
              onClick={() => setSelectedAlert(null)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> 返回列表
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 hover:text-white"
              onClick={() => setSelectedAlert(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Stock info header */}
          <div className="mt-2">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${
                selectedAlert.alert_type === 'BUY_SIGNAL'
                  ? 'bg-red-500/15'
                  : 'bg-green-500/15'
              }`}>
                {selectedAlert.alert_type === 'BUY_SIGNAL'
                  ? <TrendingUp className="w-6 h-6 text-red-400" />
                  : <TrendingDown className="w-6 h-6 text-green-400" />}
              </div>
              <div>
                <CardTitle className="text-xl text-white">
                  {selectedAlert.stock_name || details?.stock_name || selectedAlert.stock_symbol}
                </CardTitle>
                <p className="text-sm text-slate-400">{selectedAlert.stock_symbol}</p>
              </div>
              <Badge className={`ml-auto text-sm px-3 py-1 ${
                selectedAlert.alert_type === 'BUY_SIGNAL'
                  ? 'bg-red-500/20 text-red-300 border-red-500/40'
                  : 'bg-green-500/20 text-green-300 border-green-500/40'
              }`}>
                {selectedAlert.alert_type === 'BUY_SIGNAL' ? '建议买入' : '建议卖出'}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Message */}
          {selectedAlert.message && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {selectedAlert.message}
              </p>
            </div>
          )}

          {/* Quote info */}
          {details?.quote && (
            <div className="bg-slate-900/50 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4" /> 行情数据
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-500">当前价格</p>
                  <p className="text-lg font-bold text-white">
                    ¥{details.quote.current_price?.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">涨跌幅</p>
                  <p className={`text-lg font-bold ${
                    (details.quote.change_percent || 0) >= 0 ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {(details.quote.change_percent || 0) >= 0 ? '+' : ''}
                    {details.quote.change_percent?.toFixed(2)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">成交量</p>
                  <p className="text-lg font-bold text-white">
                    {details.quote.volume ? formatVolume(details.quote.volume) : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">最高</p>
                  <p className="text-sm text-white">¥{details.quote.high?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">最低</p>
                  <p className="text-sm text-white">¥{details.quote.low?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">昨收</p>
                  <p className="text-sm text-white">¥{details.quote.prev_close?.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Strategy info */}
          <div className="bg-slate-900/50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-1.5">
              <Info className="w-4 h-4" /> 策略信息
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">触发策略</span>
                <span className="text-sm text-white font-medium">
                  {details?.strategy_name || selectedAlert.triggered_strategy || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">触发价格</span>
                <span className="text-sm text-white font-medium">
                  ¥{details?.price?.toFixed(2) || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">触发日期</span>
                <span className="text-sm text-white font-medium">
                  {details?.date || '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">操作建议</span>
                <Badge className={`${
                  details?.recommendation === '买入'
                    ? 'bg-red-500/20 text-red-300 border-red-500/30'
                    : 'bg-green-500/20 text-green-300 border-green-500/30'
                }`}>
                  {details?.recommendation || (selectedAlert.alert_type === 'BUY_SIGNAL' ? '买入' : '卖出')}
                </Badge>
              </div>
            </div>
          </div>

          {/* Reason */}
          {details?.reason && (
            <div className="bg-slate-900/50 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-3">分析原因</h3>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                {details.reason}
              </p>
            </div>
          )}

          {/* Mute toggle */}
          <div className="bg-slate-900/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellOff className={`w-4 h-4 ${isSelectedMuted ? 'text-amber-400' : 'text-slate-400'}`} />
                <div>
                  <p className="text-sm text-white font-medium">关闭今日重复提醒</p>
                  <p className="text-xs text-slate-500">
                    {isSelectedMuted
                      ? `已关闭 ${selectedAlert.stock_name || selectedAlert.stock_symbol} 的${selectedAlert.alert_type === 'BUY_SIGNAL' ? '买入' : '卖出'}信号通知（今日）`
                      : `开启后，${selectedAlert.stock_name || selectedAlert.stock_symbol} 的同类型信号今日不再重复通知`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleToggleMute}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isSelectedMuted ? 'bg-amber-500' : 'bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isSelectedMuted ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Timestamp */}
          <p className="text-xs text-slate-500 text-right">
            通知时间：{new Date(selectedAlert.created_at).toLocaleString('zh-CN')}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="bg-slate-900 text-white p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header - 选中消息时在小屏幕下隐藏 */}
        <div className={selectedAlert ? 'hidden lg:block' : ''}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">策略通知</p>
              <h1 className="text-2xl sm:text-3xl font-bold">消息通知中心</h1>
              <p className="text-slate-400 mt-1">
                共 {alertsTotal} 条通知{unreadAlertCount > 0 && <span className="text-amber-400">，{unreadAlertCount} 条未读</span>}
              </p>
            </div>
            {unreadAlertCount > 0 && (
              <Button onClick={handleMarkAllRead} variant="outline" className="border-slate-600 text-slate-200 hover:bg-slate-700">
                <CheckCheck className="w-4 h-4 mr-2" /> 全部标记已读
              </Button>
            )}
          </div>

          {/* Filter */}
          <div className="flex gap-2 flex-wrap mt-6">
            {([
              { key: 'all', label: '全部' },
              { key: 'unread', label: '未读' },
              { key: 'BUY_SIGNAL', label: '买入信号' },
              { key: 'SELL_SIGNAL', label: '卖出信号' },
            ] as const).map(f => (
              <Button
                key={f.key}
                size="sm"
                variant={filterType === f.key ? 'default' : 'outline'}
                className={filterType === f.key
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'border-slate-600 text-slate-300 hover:bg-slate-700'}
                onClick={() => setFilterType(f.key)}
              >
                {f.key === 'BUY_SIGNAL' && <ArrowUpCircle className="w-3.5 h-3.5 mr-1 text-red-400" />}
                {f.key === 'SELL_SIGNAL' && <ArrowDownCircle className="w-3.5 h-3.5 mr-1 text-green-400" />}
                {f.key === 'unread' && <Filter className="w-3.5 h-3.5 mr-1" />}
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Content area - 小屏幕下：列表和详情互斥显示；大屏幕下：并排显示 */}

        {/* 小屏幕布局 (< lg): 选中时只显示详情，未选中时只显示列表 */}
        <div className="lg:hidden">
          {selectedAlert ? renderDetailPanel() : renderAlertsList()}
        </div>

        {/* 大屏幕布局 (>= lg): 始终并排显示 */}
        <div className="hidden lg:grid lg:grid-cols-5 gap-6">
          <div className={selectedAlert ? 'col-span-2' : 'col-span-5'}>
            {renderAlertsList()}
          </div>
          {selectedAlert && (
            <div className="col-span-3">
              {renderDetailPanel()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
