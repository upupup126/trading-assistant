import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAIStore } from '@/stores/aiStore'
import { useAuthStore } from '@/stores/authStore'
import { formatNumber, formatPercent, getPriceChangeColor, getPriceChangeIcon } from '@/lib/utils'
import KlineChart from '@/components/charts/KlineChart'
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Brain, 
  Shield, 
  RefreshCw,
  AlertTriangle,
  Flame
} from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuthStore()
  const { 
    marketOverview, 
    marketAnalysis, 
    sectorHotspot,
    getMarketOverview, 
    analyzeMarketTrend,
    getSectorHotspot,
    loadingStates 
  } = useAIStore()
  
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null)
  
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    // 初始化数据
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      await Promise.all([
        getMarketOverview(),
        analyzeMarketTrend(),
        getSectorHotspot(5)
      ])
    } catch (error) {
      console.error('Failed to load initial data:', error)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadInitialData()
    } finally {
      setRefreshing(false)
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'BULLISH': return 'text-red-500'
      case 'BEARISH': return 'text-green-500'
      default: return 'text-yellow-500'
    }
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'BULLISH': return <TrendingUp className="w-4 h-4" />
      case 'BEARISH': return <TrendingDown className="w-4 h-4" />
      default: return <BarChart3 className="w-4 h-4" />
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* 顶部导航 */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">交易仪表板</h1>
            <p className="text-slate-400">欢迎回来，{user?.username}</p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700 w-full sm:w-auto"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
        </div>
      </header>

      <div className="px-4 sm:px-6 py-6 space-y-6">
        {/* AI市场分析摘要 */}
        {marketAnalysis && (
          <Card className="trading-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Brain className="w-5 h-5 text-blue-400" />
                  <CardTitle className="text-white">AI市场分析</CardTitle>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={getSentimentColor(marketAnalysis.market_sentiment)}>
                    {getSentimentIcon(marketAnalysis.market_sentiment)}
                  </div>
                  <Badge 
                    variant="secondary" 
                    className={`${getSentimentColor(marketAnalysis.market_sentiment)} bg-slate-800`}
                  >
                    {marketAnalysis.market_sentiment}
                  </Badge>
                </div>
              </div>
              <CardDescription className="text-slate-400">
                基于AI分析的市场趋势和投资机会
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold text-white mb-2">市场摘要</h4>
                  <p className="text-slate-300 text-sm">{marketAnalysis.market_summary}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">置信度</h4>
                  <div className="space-y-2">
                    <Progress 
                      value={marketAnalysis.confidence_score * 100} 
                      className="bg-slate-700"
                    />
                    <p className="text-sm text-slate-400">
                      {formatPercent(marketAnalysis.confidence_score * 100)}
                    </p>
                  </div>
                </div>
              </div>

              {/* 热点板块 */}
              <div>
                <h4 className="font-semibold text-white mb-2">热点板块</h4>
                <div className="flex flex-wrap gap-2">
                  {marketAnalysis.hot_sectors.map((sector, index) => (
                    <Badge key={index} variant="outline" className="border-blue-500 text-blue-400">
                      {sector}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* 关键洞察 */}
              <div>
                <h4 className="font-semibold text-white mb-2">关键洞察</h4>
                <ul className="space-y-1">
                  {marketAnalysis.key_insights.slice(0, 3).map((insight, index) => (
                    <li key={index} className="text-sm text-slate-300 flex items-start">
                      <span className="text-blue-400 mr-2">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 市场概览 */}
        {marketOverview && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 主要指数 */}
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-green-400" />
                  主要指数
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">点击指数查看K线走势</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(marketOverview.indices).map(([name, data]) => {
                    // 指数名到代码映射
                    const indexSymbolMap: Record<string, string> = {
                      '上证指数': '000001.SH',
                      '深证成指': '399001.SZ',
                      '创业板指': '399006.SZ',
                      '沪深300': '000300.SH',
                      '中证500': '000905.SH',
                      '科创50': '000688.SH',
                    }
                    const indexCode = indexSymbolMap[name] || ''
                    const isSelected = selectedIndex === indexCode
                    return (
                      <div
                        key={name}
                        className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-600/20 border border-blue-500/40' : 'bg-slate-800/50 hover:bg-slate-700/50'
                        }`}
                        onClick={() => indexCode && setSelectedIndex(isSelected ? null : indexCode)}
                      >
                        <div>
                          <p className="font-medium text-white">{name}</p>
                          <p className="text-2xl font-bold text-white">
                            {formatNumber(data.price, 2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${getPriceChangeColor(data.change)}`}>
                            {getPriceChangeIcon(data.change)} {formatNumber(data.change, 2)}
                          </p>
                          <p className={`text-sm ${getPriceChangeColor(data.change)}`}>
                            {formatPercent(data.change_percent, 2)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 市场统计 */}
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="text-white flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-purple-400" />
                  市场统计
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-red-400 text-2xl font-bold">
                      {marketOverview.market_stats.advancing_stocks}
                    </p>
                    <p className="text-sm text-slate-400">上涨股票</p>
                  </div>
                  <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-green-400 text-2xl font-bold">
                      {marketOverview.market_stats.declining_stocks}
                    </p>
                    <p className="text-sm text-slate-400">下跌股票</p>
                  </div>
                  <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-gray-400 text-2xl font-bold">
                      {marketOverview.market_stats.unchanged_stocks}
                    </p>
                    <p className="text-sm text-slate-400">平盘股票</p>
                  </div>
                  <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-blue-400 text-2xl font-bold">
                      {formatNumber(marketOverview.market_stats.total_volume / 1e8, 1)}亿
                    </p>
                    <p className="text-sm text-slate-400">总成交量</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 概念板块热点轮动 */}
        {sectorHotspot && sectorHotspot.data.length > 0 && (
          <Card className="trading-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Flame className="w-5 h-5 mr-2 text-orange-400" />
                概念板块热点轮动
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">最近{sectorHotspot.days}个交易日概念板块涨幅排名 Top 9</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-400 py-2 px-2 w-10">#</th>
                      {sectorHotspot.data.map((day) => (
                        <th key={day.date} className="text-center text-slate-400 py-2 px-2 min-w-[130px]">
                          {day.date.slice(5)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 9 }, (_, rank) => (
                      <tr key={rank} className="border-b border-slate-800 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-500 font-mono text-xs">{rank + 1}</td>
                        {sectorHotspot.data.map((day) => {
                          const item = day.rankings[rank]
                          if (!item) return <td key={day.date} className="py-2 px-2 text-center text-slate-600">-</td>
                          const isUp = item.change_pct >= 0
                          return (
                            <td key={day.date} className="py-1.5 px-2">
                              <div className={`rounded px-2 py-1 text-center ${
                                isUp ? 'bg-red-500/10' : 'bg-green-500/10'
                              }`}>
                                <div className="text-white text-xs font-medium truncate" title={item.name}>
                                  {item.name}
                                </div>
                                <div className={`text-xs font-mono ${isUp ? 'text-red-400' : 'text-green-400'}`}>
                                  {isUp ? '+' : ''}{item.change_pct.toFixed(2)}%
                                </div>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 指数K线图 */}
        {selectedIndex && (
          <KlineChart symbol={selectedIndex} title={`${selectedIndex} K线走势`} />
        )}

        {/* 快速操作 */}
        <Card className="trading-card">
          <CardHeader>
            <CardTitle className="text-white">快速操作</CardTitle>
            <CardDescription className="text-slate-400">
              常用功能快速入口
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button 
                variant="outline" 
                className="h-20 flex-col border-blue-500 text-blue-400 hover:bg-blue-500/10"
              >
                <Brain className="w-6 h-6 mb-2" />
                AI分析
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex-col border-green-500 text-green-400 hover:bg-green-500/10"
              >
                <TrendingUp className="w-6 h-6 mb-2" />
                交易计划
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex-col border-purple-500 text-purple-400 hover:bg-purple-500/10"
              >
                <Shield className="w-6 h-6 mb-2" />
                风险评估
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex-col border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
              >
                <AlertTriangle className="w-6 h-6 mb-2" />
                智能提醒
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}