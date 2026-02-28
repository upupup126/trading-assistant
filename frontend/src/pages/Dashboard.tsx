import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAIStore } from '@/stores/aiStore'
import { useAuthStore } from '@/stores/authStore'
import { formatNumber, formatPercent, getPriceChangeColor, getPriceChangeIcon } from '@/lib/utils'
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Brain, 
  Shield, 
  Zap,
  RefreshCw,
  AlertTriangle
} from 'lucide-react'

export default function Dashboard() {
  const { user } = useAuthStore()
  const { 
    marketOverview, 
    marketAnalysis, 
    getMarketOverview, 
    analyzeMarketTrend,
    loadingStates 
  } = useAIStore()
  
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    // 初始化数据
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      await Promise.all([
        getMarketOverview(),
        analyzeMarketTrend()
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
      case 'BULLISH': return 'text-green-500'
      case 'BEARISH': return 'text-red-500'
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
      <header className="bg-slate-800 border-b border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">交易仪表板</h1>
            <p className="text-slate-400">欢迎回来，{user?.username}</p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            刷新数据
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-6">
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
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(marketOverview.indices).map(([name, data]) => (
                    <div key={name} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
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
                  ))}
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
                    <p className="text-green-400 text-2xl font-bold">
                      {marketOverview.market_stats.advancing_stocks}
                    </p>
                    <p className="text-sm text-slate-400">上涨股票</p>
                  </div>
                  <div className="text-center p-4 bg-slate-800/50 rounded-lg">
                    <p className="text-red-400 text-2xl font-bold">
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

        {/* 板块表现 */}
        {marketOverview?.sector_performance && (
          <Card className="trading-card">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Zap className="w-5 h-5 mr-2 text-yellow-400" />
                板块表现
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {Object.entries(marketOverview.sector_performance).map(([sector, performance]) => (
                  <div key={sector} className="text-center p-3 bg-slate-800/50 rounded-lg">
                    <p className="text-white font-medium mb-1">{sector}</p>
                    <p className={`text-lg font-bold ${getPriceChangeColor(performance)}`}>
                      {formatPercent(performance * 100, 2)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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