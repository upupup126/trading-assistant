import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { usePortfolioStore } from '@/stores/portfolioStore'
import { useToast } from '@/hooks/use-toast'
import { api, StockSearchResult, StockQuote, PositionItem, TradeExecutionItem, FundInfo, ACCOUNTS } from '@/lib/api'
import { formatNumber, formatCurrency } from '@/lib/utils'
import {
  Wallet,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  DollarSign,
  PieChart,
  History,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Settings2,
  Building2,
} from 'lucide-react'

export default function Portfolio() {
  const { toast } = useToast()
  const {
    currentAccount,
    setCurrentAccount,
    positions,
    positionQuotes,
    quotesLoading,
    tradeHistory,
    tradeHistoryTotal,
    fund,
    isLoading,
    fetchPositions,
    fetchPositionQuotes,
    addPosition,
    deletePosition,
    fetchTradeHistory,
    recordTrade,
    fetchFund,
    updateFund,
  } = usePortfolioStore()

  const [refreshing, setRefreshing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 判断当前是否为A股交易时段（周一至周五 9:15-15:05）
  const isTradeTime = useCallback(() => {
    const now = new Date()
    const day = now.getDay()
    if (day === 0 || day === 6) return false
    const hhmm = now.getHours() * 100 + now.getMinutes()
    return hhmm >= 915 && hhmm <= 1505
  }, [])

  useEffect(() => {
    loadData()
  }, [currentAccount])

  // 持仓变化后获取行情
  useEffect(() => {
    if (positions.length > 0) {
      fetchPositionQuotes()
    }
  }, [positions])

  // 交易时段定时刷新行情（30秒）
  useEffect(() => {
    const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (positions.length === 0) return

      // 立即检查一次是否在交易时段
      if (isTradeTime()) {
        timerRef.current = setInterval(() => {
          if (isTradeTime()) {
            fetchPositionQuotes()
          } else {
            // 已过交易时段，停止刷新
            if (timerRef.current) {
              clearInterval(timerRef.current)
              timerRef.current = null
            }
          }
        }, 30000)
      } else {
        // 非交易时段：每5分钟检查一次是否进入交易时段
        timerRef.current = setInterval(() => {
          if (isTradeTime()) {
            // 进入交易时段，重新开始
            if (timerRef.current) clearInterval(timerRef.current)
            fetchPositionQuotes()
            startTimer()
          }
        }, 300000)
      }
    }

    startTimer()
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [positions.length, isTradeTime])

  const loadData = async () => {
    await Promise.all([fetchPositions(), fetchFund(), fetchTradeHistory()])
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadData()
      await fetchPositionQuotes()
    } finally {
      setRefreshing(false)
    }
  }

  const handleAccountChange = (account: string) => {
    setCurrentAccount(account)
  }

  const currentAccountLabel = ACCOUNTS.find(a => a.key === currentAccount)?.label || currentAccount
  const totalPositionCost = positions.reduce((sum, p) => sum + p.total_cost, 0)
  // 使用实时行情计算浮动盈亏
  const totalUnrealizedPnL = positions.reduce((sum, p) => {
    const quote = positionQuotes[p.symbol]
    const price = quote?.price ?? p.current_price
    if (price) {
      return sum + (price - p.avg_cost) * p.quantity
    }
    return sum
  }, 0)

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <header className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">我的持仓</h1>
            <p className="text-slate-400">管理持仓、记录交易、设置资金</p>
          </div>
          <div className="flex items-center gap-3">
            {/* 账户切换 */}
            <div className="flex items-center bg-slate-700 rounded-lg p-1">
              {ACCOUNTS.map((acc) => (
                <button
                  key={acc.key}
                  onClick={() => handleAccountChange(acc.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    currentAccount === acc.key
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-600'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  {acc.label}
                </button>
              ))}
            </div>
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-6">
        {/* 当前账户提示 */}
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Building2 className="w-3 h-3 mr-1" />
            {currentAccountLabel}
          </Badge>
        </div>

        {/* 资金概览卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="trading-card">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-slate-400">总资产</span>
              </div>
              <p className="text-xl font-bold text-white">
                {formatCurrency(fund?.total_assets ?? 0)}
              </p>
            </CardContent>
          </Card>

          <Card className="trading-card">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 mb-2">
                <Wallet className="w-4 h-4 text-green-400" />
                <span className="text-sm text-slate-400">可用现金</span>
              </div>
              <p className="text-xl font-bold text-white">
                {formatCurrency(fund?.available_cash ?? 0)}
              </p>
            </CardContent>
          </Card>

          <Card className="trading-card">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 mb-2">
                <PieChart className="w-4 h-4 text-purple-400" />
                <span className="text-sm text-slate-400">持仓市值</span>
              </div>
              <p className="text-xl font-bold text-white">
                {formatCurrency(fund?.position_value ?? totalPositionCost)}
              </p>
            </CardContent>
          </Card>

          <Card className="trading-card">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 mb-2">
                {totalUnrealizedPnL >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-red-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-green-400" />
                )}
                <span className="text-sm text-slate-400">浮动盈亏</span>
              </div>
              <p className={`text-xl font-bold ${totalUnrealizedPnL >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                {totalUnrealizedPnL >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnL)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 主内容区 */}
        <Tabs defaultValue="positions" className="space-y-4">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="positions" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              持仓列表
            </TabsTrigger>
            <TabsTrigger value="trade" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              记录交易
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              交易记录
            </TabsTrigger>
            <TabsTrigger value="fund" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              资金设置
            </TabsTrigger>
          </TabsList>

          {/* 持仓列表 */}
          <TabsContent value="positions">
            <PositionsTab
              positions={positions}
              positionQuotes={positionQuotes}
              quotesLoading={quotesLoading}
              isLoading={isLoading}
              currentAccount={currentAccount}
              isTradeTime={isTradeTime()}
              onAddPosition={async (data) => {
                await addPosition({ ...data, account: currentAccount })
                toast({ title: '添加成功', description: `已添加 ${data.symbol} 持仓到${currentAccountLabel}` })
              }}
              onDeletePosition={async (id, symbol) => {
                await deletePosition(id)
                toast({ title: '删除成功', description: `已从${currentAccountLabel}删除 ${symbol} 持仓` })
              }}
            />
          </TabsContent>

          {/* 记录交易 */}
          <TabsContent value="trade">
            <RecordTradeTab
              currentAccount={currentAccount}
              currentAccountLabel={currentAccountLabel}
              onRecordTrade={async (data) => {
                await recordTrade({ ...data, account: currentAccount })
                toast({
                  title: '交易记录成功',
                  description: `[${currentAccountLabel}] ${data.trade_type === 'BUY' ? '买入' : '卖出'} ${data.symbol} ${data.quantity}股 @ ${data.price}`,
                })
              }}
              isLoading={isLoading}
            />
          </TabsContent>

          {/* 交易记录 */}
          <TabsContent value="history">
            <TradeHistoryTab
              history={tradeHistory}
              total={tradeHistoryTotal}
              isLoading={isLoading}
              onLoadMore={(offset) => fetchTradeHistory(20, offset)}
            />
          </TabsContent>

          {/* 资金设置 */}
          <TabsContent value="fund">
            <FundSettingsTab
              fund={fund}
              currentAccount={currentAccount}
              currentAccountLabel={currentAccountLabel}
              onUpdateFund={async (data) => {
                await updateFund({ ...data, account: currentAccount })
                toast({ title: '更新成功', description: `${currentAccountLabel}资金设置已更新` })
              }}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ============ 持仓列表 Tab ============

function PositionsTab({
  positions,
  positionQuotes,
  quotesLoading,
  isLoading,
  currentAccount,
  isTradeTime,
  onAddPosition,
  onDeletePosition,
}: {
  positions: PositionItem[]
  positionQuotes: Record<string, StockQuote>
  quotesLoading: boolean
  isLoading: boolean
  currentAccount: string
  isTradeTime: boolean
  onAddPosition: (data: any) => Promise<void>
  onDeletePosition: (id: string, symbol: string) => Promise<void>
}) {
  const [addOpen, setAddOpen] = useState(false)

  // 计算带实时行情的持仓汇总
  const totalMarketValue = positions.reduce((sum, p) => {
    const quote = positionQuotes[p.symbol]
    const price = quote?.price ?? p.current_price
    return sum + (price ? price * p.quantity : p.total_cost)
  }, 0)
  const totalCost = positions.reduce((sum, p) => sum + p.total_cost, 0)
  const totalUnrealizedPnL = totalMarketValue - totalCost

  return (
    <Card className="trading-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white">当前持仓</CardTitle>
            <CardDescription className="text-slate-400">
              共 {positions.length} 只股票
              {quotesLoading && <span className="ml-2 text-blue-400 text-xs animate-pulse">行情更新中...</span>}
              {!quotesLoading && positions.length > 0 && (
                <span className="ml-2 text-xs text-slate-500">
                  {isTradeTime ? '交易中 · 30秒自动刷新' : '已收盘'}
                </span>
              )}
            </CardDescription>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                添加持仓
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700 text-white">
              <AddPositionForm
                onSubmit={async (data) => {
                  await onAddPosition(data)
                  setAddOpen(false)
                }}
                isLoading={isLoading}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {positions.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <PieChart className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">暂无持仓</p>
            <p className="text-sm">点击"添加持仓"录入您的现有持仓</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left py-3 px-2">股票</th>
                    <th className="text-right py-3 px-2">持仓数量</th>
                    <th className="text-right py-3 px-2">成本价</th>
                    <th className="text-right py-3 px-2">现价</th>
                    <th className="text-right py-3 px-2">当前市值</th>
                    <th className="text-right py-3 px-2">浮动盈亏</th>
                    <th className="text-right py-3 px-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => {
                    const quote = positionQuotes[p.symbol]
                    const currentPrice = quote?.price ?? p.current_price ?? null
                    const changePercent = quote?.change_percent ?? null
                    const hasCurrentPrice = currentPrice !== null
                    const unrealizedPnL = hasCurrentPrice ? (currentPrice - p.avg_cost) * p.quantity : null
                    const pnlPercent = hasCurrentPrice && p.avg_cost > 0 ? ((currentPrice - p.avg_cost) / p.avg_cost) * 100 : null
                    const marketValue = hasCurrentPrice ? currentPrice * p.quantity : null
                    return (
                    <tr key={p.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium text-white">{p.stock_name}</p>
                          <p className="text-xs text-slate-400">{p.symbol} · {p.exchange}</p>
                        </div>
                      </td>
                      <td className="text-right py-3 px-2 text-white font-mono">{p.quantity}</td>
                      <td className="text-right py-3 px-2 text-white font-mono">{formatNumber(p.avg_cost, 4)}</td>
                      <td className="text-right py-3 px-2 font-mono">
                        {hasCurrentPrice ? (
                          <div>
                            <span className={currentPrice >= p.avg_cost ? 'text-red-400' : 'text-green-400'}>
                              {formatNumber(currentPrice, 2)}
                            </span>
                            {changePercent !== null && (
                              <p className={`text-xs ${changePercent >= 0 ? 'text-red-400/70' : 'text-green-400/70'}`}>
                                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
                              </p>
                            )}
                          </div>
                        ) : quotesLoading ? (
                          <span className="text-slate-500 animate-pulse">...</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="text-right py-3 px-2 font-mono">
                        {marketValue !== null ? (
                          <span className="text-white">{formatCurrency(marketValue)}</span>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="text-right py-3 px-2 font-mono">
                        {unrealizedPnL !== null ? (
                          <div>
                            <span className={unrealizedPnL >= 0 ? 'text-red-400' : 'text-green-400'}>
                              {unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(unrealizedPnL)}
                            </span>
                            {pnlPercent !== null && (
                              <p className={`text-xs ${pnlPercent >= 0 ? 'text-red-400/70' : 'text-green-400/70'}`}>
                                {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>
                      <td className="text-right py-3 px-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeletePosition(p.id, p.symbol)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-600 font-medium">
                    <td colSpan={4} className="py-3 px-2 text-slate-300">合计</td>
                    <td className="text-right py-3 px-2 text-white font-mono">{formatCurrency(totalMarketValue)}</td>
                    <td className="text-right py-3 px-2 font-mono">
                      <span className={totalUnrealizedPnL >= 0 ? 'text-red-400' : 'text-green-400'}>
                        {totalUnrealizedPnL >= 0 ? '+' : ''}{formatCurrency(totalUnrealizedPnL)}
                        {totalCost > 0 && (
                          <span className="text-xs ml-1">
                            ({(totalUnrealizedPnL / totalCost * 100) >= 0 ? '+' : ''}{(totalUnrealizedPnL / totalCost * 100).toFixed(2)}%)
                          </span>
                        )}
                      </span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ============ 添加持仓表单 ============

function AddPositionForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (data: any) => Promise<void>
  isLoading: boolean
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedStock, setSelectedStock] = useState<StockSearchResult | null>(null)
  const [currentQuote, setCurrentQuote] = useState<StockQuote | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [avgCost, setAvgCost] = useState('')

  const handleSearch = async (q: string) => {
    setSearchQuery(q)
    if (q.length < 1) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const results = await api.searchStocks(q)
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSelectStock = async (stock: StockSearchResult) => {
    // 如果搜索结果没有 exchange，从 symbol 后缀提取
    const exchange = stock.exchange || (stock.symbol.endsWith('.SH') ? 'SH' : stock.symbol.endsWith('.SZ') ? 'SZ' : '')
    const enrichedStock = { ...stock, exchange }
    setSelectedStock(enrichedStock)
    setSearchQuery(`${stock.symbol} ${stock.name}`)
    setSearchResults([])

    // 自动获取实时行情
    setLoadingQuote(true)
    setCurrentQuote(null)
    try {
      const quote = await api.getStockQuote(stock.symbol)
      setCurrentQuote(quote)
    } catch {
      setCurrentQuote(null)
    } finally {
      setLoadingQuote(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedStock || !quantity || !avgCost) return
    await onSubmit({
      symbol: selectedStock.symbol,
      name: selectedStock.name,
      exchange: selectedStock.exchange,
      quantity: parseInt(quantity),
      avg_cost: parseFloat(avgCost),
    })
  }

  const qty = quantity ? parseInt(quantity) : 0
  const cost = avgCost ? parseFloat(avgCost) : 0
  const totalCost = qty * cost
  const currentPrice = currentQuote?.price ?? null
  const unrealizedPnL = currentPrice && qty && cost ? (currentPrice - cost) * qty : null
  const pnlPercent = unrealizedPnL && totalCost ? (unrealizedPnL / totalCost) * 100 : null

  return (
    <>
      <DialogHeader>
        <DialogTitle>添加持仓</DialogTitle>
        <DialogDescription className="text-slate-400">
          搜索选择股票，填写持仓信息
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>搜索股票</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="输入股票代码或名称（实时搜索）"
              className="pl-10 bg-slate-700 border-slate-600 text-white"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="bg-slate-700 border border-slate-600 rounded-md max-h-48 overflow-y-auto">
              {searchResults.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelectStock(stock)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-600 transition-colors"
                >
                  <span className="font-medium text-white">{stock.symbol}</span>
                  <span className="text-slate-400 ml-2">{stock.name}</span>
                </button>
              ))}
            </div>
          )}
          {searching && <p className="text-sm text-slate-400">搜索中...</p>}
          {selectedStock && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-blue-600 text-white">
                已选: {selectedStock.symbol} {selectedStock.name}
              </Badge>
              {loadingQuote && <span className="text-xs text-slate-400">获取行情中...</span>}
              {currentQuote && (
                <Badge className={`${currentQuote.change >= 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  现价: {currentQuote.price.toFixed(2)} ({currentQuote.change >= 0 ? '+' : ''}{currentQuote.change_percent.toFixed(2)}%)
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>持仓数量（股）</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="如 100"
              min="1"
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label>成本价</Label>
            <Input
              type="number"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              placeholder="如 15.50"
              step="0.01"
              min="0.01"
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
        </div>

        {selectedStock && qty > 0 && cost > 0 && (
          <div className="p-3 bg-slate-700/50 rounded-lg text-sm space-y-1">
            <div className="flex justify-between text-slate-300">
              <span>总成本</span>
              <span className="text-white font-mono">{formatCurrency(totalCost)}</span>
            </div>
            {currentPrice !== null && (
              <>
                <div className="flex justify-between text-slate-300">
                  <span>当前市值</span>
                  <span className="text-white font-mono">{formatCurrency(currentPrice * qty)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">浮动盈亏</span>
                  <span className={`font-mono font-bold ${unrealizedPnL! >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {unrealizedPnL! >= 0 ? '+' : ''}{formatCurrency(unrealizedPnL!)}
                    {pnlPercent !== null && <span className="ml-1 text-xs">({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)</span>}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          onClick={handleSubmit}
          disabled={!selectedStock || !quantity || !avgCost || isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isLoading ? '添加中...' : '添加持仓'}
        </Button>
      </DialogFooter>
    </>
  )
}

// ============ 记录交易 Tab ============

function RecordTradeTab({
  currentAccount,
  currentAccountLabel,
  onRecordTrade,
  isLoading,
}: {
  currentAccount: string
  currentAccountLabel: string
  onRecordTrade: (data: any) => Promise<void>
  isLoading: boolean
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedStock, setSelectedStock] = useState<StockSearchResult | null>(null)
  const [currentQuote, setCurrentQuote] = useState<StockQuote | null>(null)
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [commission, setCommission] = useState('')
  const [notes, setNotes] = useState('')

  const handleSearch = async (q: string) => {
    setSearchQuery(q)
    if (q.length < 1) {
      setSearchResults([])
      return
    }
    setSearching(true)
    try {
      const results = await api.searchStocks(q)
      setSearchResults(results)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleSelectStock = async (stock: StockSearchResult) => {
    const exchange = stock.exchange || (stock.symbol.endsWith('.SH') ? 'SH' : stock.symbol.endsWith('.SZ') ? 'SZ' : '')
    const enrichedStock = { ...stock, exchange }
    setSelectedStock(enrichedStock)
    setSearchQuery(`${stock.symbol} ${stock.name}`)
    setSearchResults([])

    // 自动获取实时行情并填入价格
    setLoadingQuote(true)
    setCurrentQuote(null)
    try {
      const quote = await api.getStockQuote(stock.symbol)
      setCurrentQuote(quote)
      setPrice(quote.price.toFixed(2))
    } catch {
      setCurrentQuote(null)
    } finally {
      setLoadingQuote(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedStock || !quantity || !price) return
    await onRecordTrade({
      symbol: selectedStock.symbol,
      name: selectedStock.name,
      exchange: selectedStock.exchange,
      trade_type: tradeType,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      commission: commission ? parseFloat(commission) : 0,
      notes: notes || undefined,
    })

    setSelectedStock(null)
    setCurrentQuote(null)
    setSearchQuery('')
    setQuantity('')
    setPrice('')
    setCommission('')
    setNotes('')
  }

  const totalAmount = quantity && price ? parseInt(quantity) * parseFloat(price) : 0

  return (
    <Card className="trading-card">
      <CardHeader>
        <CardTitle className="text-white">记录交易</CardTitle>
        <CardDescription className="text-slate-400">
          记录买入/卖出交易到 <span className="text-blue-400 font-medium">{currentAccountLabel}</span>，系统自动更新持仓和资金
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 买卖方向 */}
        <div className="flex gap-4">
          <Button
            onClick={() => setTradeType('BUY')}
            className={`flex-1 h-14 text-lg ${
              tradeType === 'BUY'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            <ArrowUpRight className="w-5 h-5 mr-2" />
            买入
          </Button>
          <Button
            onClick={() => setTradeType('SELL')}
            className={`flex-1 h-14 text-lg ${
              tradeType === 'SELL'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}
          >
            <ArrowDownRight className="w-5 h-5 mr-2" />
            卖出
          </Button>
        </div>

        {/* 搜索股票 */}
        <div className="space-y-2">
          <Label>搜索股票</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="输入股票代码或名称（实时搜索）"
              className="pl-10 bg-slate-700 border-slate-600 text-white"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="bg-slate-700 border border-slate-600 rounded-md max-h-48 overflow-y-auto">
              {searchResults.map((stock) => (
                <button
                  key={stock.symbol}
                  onClick={() => handleSelectStock(stock)}
                  className="w-full text-left px-4 py-2 hover:bg-slate-600 transition-colors"
                >
                  <span className="font-medium text-white">{stock.symbol}</span>
                  <span className="text-slate-400 ml-2">{stock.name}</span>
                </button>
              ))}
            </div>
          )}
          {searching && <p className="text-sm text-slate-400">搜索中...</p>}
          {selectedStock && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-blue-600 text-white">
                已选: {selectedStock.symbol} {selectedStock.name}
              </Badge>
              {loadingQuote && <span className="text-xs text-slate-400">获取行情中...</span>}
              {currentQuote && (
                <Badge className={`${currentQuote.change >= 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  现价: {currentQuote.price.toFixed(2)} ({currentQuote.change >= 0 ? '+' : ''}{currentQuote.change_percent.toFixed(2)}%)
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* 交易详情 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>数量（股）</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="如 100"
              min="1"
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label>价格 {currentQuote ? '（已自动填入现价）' : ''}</Label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="如 15.50"
              step="0.01"
              min="0.01"
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>佣金（可选）</Label>
            <Input
              type="number"
              value={commission}
              onChange={(e) => setCommission(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label>备注（可选）</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="交易备注"
              className="bg-slate-700 border-slate-600 text-white"
            />
          </div>
        </div>

        {/* 交易汇总 */}
        {totalAmount > 0 && (
          <div className={`p-4 rounded-lg border ${tradeType === 'BUY' ? 'border-red-500/30 bg-red-500/5' : 'border-green-500/30 bg-green-500/5'}`}>
            <div className="flex justify-between items-center">
              <span className="text-slate-300">交易金额</span>
              <span className="text-xl font-bold text-white font-mono">{formatCurrency(totalAmount)}</span>
            </div>
            {commission && (
              <div className="flex justify-between items-center mt-1">
                <span className="text-slate-400 text-sm">佣金</span>
                <span className="text-sm text-slate-300 font-mono">{formatCurrency(parseFloat(commission))}</span>
              </div>
            )}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!selectedStock || !quantity || !price || isLoading}
          className={`w-full h-12 text-lg ${
            tradeType === 'BUY' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {isLoading ? '提交中...' : `确认${tradeType === 'BUY' ? '买入' : '卖出'}`}
        </Button>
      </CardContent>
    </Card>
  )
}

// ============ 交易记录 Tab ============

function TradeHistoryTab({
  history,
  total,
  isLoading,
  onLoadMore,
}: {
  history: TradeExecutionItem[]
  total: number
  isLoading: boolean
  onLoadMore: (offset: number) => void
}) {
  return (
    <Card className="trading-card">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <History className="w-5 h-5 mr-2 text-blue-400" />
          交易记录
        </CardTitle>
        <CardDescription className="text-slate-400">共 {total} 条交易记录</CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">暂无交易记录</p>
            <p className="text-sm">在"记录交易"中添加您的第一笔交易</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400">
                    <th className="text-left py-3 px-2">时间</th>
                    <th className="text-left py-3 px-2">股票</th>
                    <th className="text-center py-3 px-2">方向</th>
                    <th className="text-right py-3 px-2">数量</th>
                    <th className="text-right py-3 px-2">价格</th>
                    <th className="text-right py-3 px-2">金额</th>
                    <th className="text-right py-3 px-2">佣金</th>
                    <th className="text-left py-3 px-2">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((t) => (
                    <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                      <td className="py-3 px-2 text-slate-400 text-xs whitespace-nowrap">
                        {new Date(t.executed_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-2">
                        <div>
                          <p className="text-white">{t.stock_name}</p>
                          <p className="text-xs text-slate-400">{t.symbol}</p>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">
                        <Badge className={t.trade_type === 'BUY' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}>
                          {t.trade_type === 'BUY' ? '买入' : '卖出'}
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-2 text-white font-mono">{t.quantity}</td>
                      <td className="text-right py-3 px-2 text-white font-mono">{formatNumber(t.price, 4)}</td>
                      <td className="text-right py-3 px-2 text-white font-mono">{formatCurrency(t.total_amount)}</td>
                      <td className="text-right py-3 px-2 text-slate-400 font-mono">{formatNumber(t.commission, 2)}</td>
                      <td className="py-3 px-2 text-slate-400 text-xs max-w-[120px] truncate">
                        {t.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {history.length < total && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => onLoadMore(history.length)}
                  disabled={isLoading}
                  className="border-slate-600 text-slate-300 hover:bg-slate-700"
                >
                  加载更多
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ============ 资金设置 Tab ============

function FundSettingsTab({
  fund,
  currentAccount,
  currentAccountLabel,
  onUpdateFund,
  isLoading,
}: {
  fund: FundInfo | null
  currentAccount: string
  currentAccountLabel: string
  onUpdateFund: (data: any) => Promise<void>
  isLoading: boolean
}) {
  const [totalCapital, setTotalCapital] = useState('')
  const [availableCash, setAvailableCash] = useState('')
  const [initialized, setInitialized] = useState(false)
  const [lastAccount, setLastAccount] = useState('')

  useEffect(() => {
    if (fund && (fund.account === currentAccount) && (!initialized || lastAccount !== currentAccount)) {
      setTotalCapital(fund.total_capital > 0 ? fund.total_capital.toString() : '')
      setAvailableCash(fund.available_cash > 0 ? fund.available_cash.toString() : '')
      setInitialized(true)
      setLastAccount(currentAccount)
    }
  }, [fund, currentAccount, initialized, lastAccount])

  const handleSubmit = async () => {
    await onUpdateFund({
      total_capital: totalCapital ? parseFloat(totalCapital) : 0,
      available_cash: availableCash ? parseFloat(availableCash) : 0,
    })
  }

  return (
    <Card className="trading-card">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Settings2 className="w-5 h-5 mr-2 text-purple-400" />
          资金设置 - {currentAccountLabel}
        </CardTitle>
        <CardDescription className="text-slate-400">
          设置 <span className="text-blue-400 font-medium">{currentAccountLabel}</span> 的初始总资金和可用现金。记录交易时系统会自动更新可用现金。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>总资金（元）</Label>
            <Input
              type="number"
              value={totalCapital}
              onChange={(e) => setTotalCapital(e.target.value)}
              placeholder="如 100000"
              step="100"
              min="0"
              className="bg-slate-700 border-slate-600 text-white text-lg h-12"
            />
            <p className="text-xs text-slate-500">您在该账户的投资总资金（包含现金+持仓）</p>
          </div>
          <div className="space-y-2">
            <Label>可用现金（元）</Label>
            <Input
              type="number"
              value={availableCash}
              onChange={(e) => setAvailableCash(e.target.value)}
              placeholder="如 50000"
              step="100"
              min="0"
              className="bg-slate-700 border-slate-600 text-white text-lg h-12"
            />
            <p className="text-xs text-slate-500">当前账户可用现金余额</p>
          </div>
        </div>

        {fund && (
          <div className="p-4 bg-slate-800/50 rounded-lg space-y-2">
            <p className="text-sm text-slate-400">当前资金状态</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-slate-400">总资金</p>
                <p className="text-white font-mono">{formatCurrency(fund.total_capital)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">可用现金</p>
                <p className="text-white font-mono">{formatCurrency(fund.available_cash)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">持仓市值</p>
                <p className="text-white font-mono">{formatCurrency(fund.position_value)}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">总资产</p>
                <p className="text-white font-mono font-bold">{formatCurrency(fund.total_assets)}</p>
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isLoading ? '保存中...' : '保存资金设置'}
        </Button>
      </CardContent>
    </Card>
  )
}
