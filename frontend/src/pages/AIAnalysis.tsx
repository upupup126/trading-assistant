import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useAIStore } from '@/stores/aiStore'
import { useToast } from '@/hooks/use-toast'
import { formatNumber, formatPercent, getPriceChangeColor } from '@/lib/utils'
import KlineChart from '@/components/charts/KlineChart'
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Target,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'

export default function AIAnalysis() {
  const { toast } = useToast()
  const {
    marketAnalysis,
    stockAnalyses,
    riskAssessment,
    tradingAdvices,
    loadingStates,
    analyzeMarketTrend,
    analyzeStockOpportunity,
    assessPortfolioRisk,
    generateTradingAdvice
  } = useAIStore()

  const [stockSymbol, setStockSymbol] = useState('')
  const [portfolio, setPortfolio] = useState('')
  const [tradingContext, setTradingContext] = useState('')

  // 市场分析
  const handleMarketAnalysis = async () => {
    try {
      await analyzeMarketTrend()
      toast({
        title: '分析完成',
        description: '市场趋势分析已更新',
      })
    } catch (error) {
      toast({
        title: '分析失败',
        description: '无法获取市场分析，请稍后重试',
        variant: 'destructive',
      })
    }
  }

  // 个股分析
  const handleStockAnalysis = async () => {
    if (!stockSymbol.trim()) {
      toast({
        title: '输入错误',
        description: '请输入股票代码',
        variant: 'destructive',
      })
      return
    }

    try {
      await analyzeStockOpportunity(stockSymbol.toUpperCase())
      toast({
        title: '分析完成',
        description: `${stockSymbol} 的投资机会分析已完成`,
      })
    } catch (error) {
      toast({
        title: '分析失败',
        description: '无法分析该股票，请检查代码是否正确',
        variant: 'destructive',
      })
    }
  }

  // 风险评估
  const handleRiskAssessment = async () => {
    if (!portfolio.trim()) {
      toast({
        title: '输入错误',
        description: '请输入投资组合信息',
        variant: 'destructive',
      })
      return
    }

    try {
      // 解析投资组合输入 (格式: 股票代码:金额,股票代码:金额)
      const portfolioData: Record<string, number> = {}
      const entries = portfolio.split(',')
      
      for (const entry of entries) {
        const [symbol, amount] = entry.trim().split(':')
        if (symbol && amount) {
          portfolioData[symbol.toUpperCase()] = parseFloat(amount)
        }
      }

      if (Object.keys(portfolioData).length === 0) {
        throw new Error('投资组合格式错误')
      }

      await assessPortfolioRisk(portfolioData)
      toast({
        title: '评估完成',
        description: '投资组合风险评估已完成',
      })
    } catch (error) {
      toast({
        title: '评估失败',
        description: '投资组合格式错误，请使用格式：股票代码:金额,股票代码:金额',
        variant: 'destructive',
      })
    }
  }

  // 交易建议
  const handleTradingAdvice = async () => {
    if (!stockSymbol.trim() || !tradingContext.trim()) {
      toast({
        title: '输入错误',
        description: '请输入股票代码和交易背景',
        variant: 'destructive',
      })
      return
    }

    try {
      const context = { description: tradingContext }
      await generateTradingAdvice(stockSymbol.toUpperCase(), context)
      toast({
        title: '建议生成',
        description: `${stockSymbol} 的交易建议已生成`,
      })
    } catch (error) {
      toast({
        title: '生成失败',
        description: '无法生成交易建议，请稍后重试',
        variant: 'destructive',
      })
    }
  }

  const getRecommendationIcon = (recommendation: string) => {
    switch (recommendation) {
      case 'BUY': return <TrendingUp className="w-4 h-4 text-red-500" />
      case 'SELL': return <TrendingDown className="w-4 h-4 text-green-500" />
      default: return <Target className="w-4 h-4 text-yellow-500" />
    }
  }

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'BUY': return 'text-red-500 bg-red-500/10 border-red-500'
      case 'SELL': return 'text-green-500 bg-green-500/10 border-green-500'
      default: return 'text-yellow-500 bg-yellow-500/10 border-yellow-500'
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white px-4 sm:px-6 py-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">AI智能分析</h1>
          <p className="text-slate-400">基于人工智能的专业投资分析和建议</p>
        </div>

        <Tabs defaultValue="market" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-slate-800">
            <TabsTrigger value="market" className="data-[state=active]:bg-blue-600">
              市场分析
            </TabsTrigger>
            <TabsTrigger value="stock" className="data-[state=active]:bg-green-600">
              个股分析
            </TabsTrigger>
            <TabsTrigger value="risk" className="data-[state=active]:bg-purple-600">
              风险评估
            </TabsTrigger>
            <TabsTrigger value="advice" className="data-[state=active]:bg-orange-600">
              交易建议
            </TabsTrigger>
          </TabsList>

          {/* 市场分析 */}
          <TabsContent value="market" className="space-y-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Brain className="w-5 h-5 mr-2 text-blue-400" />
                  市场趋势分析
                </CardTitle>
                <CardDescription className="text-slate-400">
                  AI分析当前市场整体趋势和投资机会
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={handleMarketAnalysis}
                  disabled={loadingStates.marketTrend}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loadingStates.marketTrend ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      开始分析
                    </>
                  )}
                </Button>

                {marketAnalysis && (
                  <div className="space-y-4 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-800/50 p-4 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">市场情绪</h4>
                        <Badge className={getRecommendationColor(marketAnalysis.market_sentiment)}>
                          {marketAnalysis.market_sentiment}
                        </Badge>
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">置信度</h4>
                        <div className="space-y-2">
                          <Progress value={marketAnalysis.confidence_score * 100} />
                          <p className="text-sm text-slate-400">
                            {formatPercent(marketAnalysis.confidence_score * 100)}
                          </p>
                        </div>
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">热点板块</h4>
                        <div className="flex flex-wrap gap-1">
                          {marketAnalysis.hot_sectors.slice(0, 3).map((sector, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {sector}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <h4 className="font-semibold text-white mb-2">市场摘要</h4>
                      <p className="text-slate-300">{marketAnalysis.market_summary}</p>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <h4 className="font-semibold text-white mb-2">关键洞察</h4>
                      <ul className="space-y-2">
                        {marketAnalysis.key_insights.map((insight, index) => (
                          <li key={index} className="text-slate-300 flex items-start">
                            <CheckCircle className="w-4 h-4 text-blue-400 mr-2 mt-0.5 flex-shrink-0" />
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 个股分析 */}
          <TabsContent value="stock" className="space-y-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Search className="w-5 h-5 mr-2 text-green-400" />
                  个股投资机会分析
                </CardTitle>
                <CardDescription className="text-slate-400">
                  分析特定股票的投资价值和风险
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Label htmlFor="stock-symbol" className="text-white">股票代码</Label>
                    <Input
                      id="stock-symbol"
                      placeholder="例如：000001.SZ"
                      value={stockSymbol}
                      onChange={(e) => setStockSymbol(e.target.value)}
                      className="bg-slate-800/50 border-slate-600 text-white"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button 
                      onClick={handleStockAnalysis}
                      disabled={loadingStates[`stockAnalysis_${stockSymbol.toUpperCase()}`]}
                      className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                    >
                      {loadingStates[`stockAnalysis_${stockSymbol.toUpperCase()}`] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        '分析'
                      )}
                    </Button>
                  </div>
                </div>

                {stockSymbol && stockAnalyses[stockSymbol.toUpperCase()] && (
                  <div className="space-y-4 mt-6">
                    {(() => {
                      const analysis = stockAnalyses[stockSymbol.toUpperCase()]
                      return (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                              <h4 className="font-semibold text-white mb-2">投资建议</h4>
                              <div className="flex items-center justify-center">
                                {getRecommendationIcon(analysis.recommendation)}
                                <span className={`ml-2 font-bold ${getPriceChangeColor(
                                  analysis.recommendation === 'BUY' ? 1 : 
                                  analysis.recommendation === 'SELL' ? -1 : 0
                                )}`}>
                                  {analysis.recommendation}
                                </span>
                              </div>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                              <h4 className="font-semibold text-white mb-2">目标价格</h4>
                              <p className="text-2xl font-bold text-blue-400">
                                {analysis.target_price ? `¥${formatNumber(analysis.target_price)}` : 'N/A'}
                              </p>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                              <h4 className="font-semibold text-white mb-2">机会评分</h4>
                              <div className="space-y-2">
                                <Progress value={analysis.opportunity_score * 100} className="bg-slate-700" />
                                <p className="text-sm text-red-400">
                                  {formatPercent(analysis.opportunity_score * 100)}
                                </p>
                              </div>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                              <h4 className="font-semibold text-white mb-2">风险评分</h4>
                              <div className="space-y-2">
                                <Progress value={analysis.risk_score * 100} className="bg-slate-700" />
                                <p className="text-sm text-green-400">
                                  {formatPercent(analysis.risk_score * 100)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-800/50 p-4 rounded-lg">
                              <h4 className="font-semibold text-white mb-2 flex items-center">
                                <CheckCircle className="w-4 h-4 text-red-400 mr-2" />
                                利好因素
                              </h4>
                              <ul className="space-y-1">
                                {analysis.key_factors.map((factor, index) => (
                                  <li key={index} className="text-sm text-slate-300">
                                    • {factor}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg">
                              <h4 className="font-semibold text-white mb-2 flex items-center">
                                <XCircle className="w-4 h-4 text-green-400 mr-2" />
                                风险因素
                              </h4>
                              <ul className="space-y-1">
                                {analysis.risk_factors.map((factor, index) => (
                                  <li key={index} className="text-sm text-slate-300">
                                    • {factor}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {(analysis.support_levels.length > 0 || analysis.resistance_levels.length > 0) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-slate-800/50 p-4 rounded-lg">
                                <h4 className="font-semibold text-white mb-2">支撑位</h4>
                                <div className="flex flex-wrap gap-2">
                                  {analysis.support_levels.map((level, index) => (
                                    <Badge key={index} variant="outline" className="border-red-500 text-red-400">
                                      ¥{formatNumber(level)}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div className="bg-slate-800/50 p-4 rounded-lg">
                                <h4 className="font-semibold text-white mb-2">阻力位</h4>
                                <div className="flex flex-wrap gap-2">
                                  {analysis.resistance_levels.map((level, index) => (
                                    <Badge key={index} variant="outline" className="border-green-500 text-green-400">
                                      ¥{formatNumber(level)}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 个股K线图 */}
                          <KlineChart symbol={stockSymbol.toUpperCase()} title={`${stockSymbol.toUpperCase()} K线走势`} />
                        </>
                      )
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 风险评估 */}
          <TabsContent value="risk" className="space-y-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Shield className="w-5 h-5 mr-2 text-purple-400" />
                  投资组合风险评估
                </CardTitle>
                <CardDescription className="text-slate-400">
                  评估您的投资组合风险水平和多样化程度
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="portfolio" className="text-white">投资组合</Label>
                  <Input
                    id="portfolio"
                    placeholder="格式：000001.SZ:50000,600036.SH:30000"
                    value={portfolio}
                    onChange={(e) => setPortfolio(e.target.value)}
                    className="bg-slate-800/50 border-slate-600 text-white"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    请输入股票代码和金额，用逗号分隔
                  </p>
                </div>
                
                <Button 
                  onClick={handleRiskAssessment}
                  disabled={loadingStates.riskAssessment}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {loadingStates.riskAssessment ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      评估中...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      开始评估
                    </>
                  )}
                </Button>

                {riskAssessment && (
                  <div className="space-y-4 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                        <h4 className="font-semibold text-white mb-2">风险等级</h4>
                        <Badge className={
                          riskAssessment.portfolio_risk_level === 'LOW' ? 'bg-red-500/20 text-red-400' :
                          riskAssessment.portfolio_risk_level === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }>
                          {riskAssessment.portfolio_risk_level}
                        </Badge>
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                        <h4 className="font-semibold text-white mb-2">分散化评分</h4>
                        <div className="space-y-2">
                          <Progress value={riskAssessment.diversification_score * 100} />
                          <p className="text-sm text-blue-400">
                            {formatPercent(riskAssessment.diversification_score * 100)}
                          </p>
                        </div>
                      </div>
                      <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                        <h4 className="font-semibold text-white mb-2">波动性评分</h4>
                        <div className="space-y-2">
                          <Progress value={riskAssessment.volatility_score * 100} />
                          <p className="text-sm text-orange-400">
                            {formatPercent(riskAssessment.volatility_score * 100)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {Object.keys(riskAssessment.sector_concentration).length > 0 && (
                      <div className="bg-slate-800/50 p-4 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">行业集中度</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {Object.entries(riskAssessment.sector_concentration).map(([sector, concentration]) => (
                            <div key={sector} className="text-center">
                              <p className="text-sm text-slate-400">{sector}</p>
                              <p className="font-semibold text-white">
                                {formatPercent(concentration * 100)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="bg-slate-800/50 p-4 rounded-lg">
                      <h4 className="font-semibold text-white mb-2 flex items-center">
                        <AlertTriangle className="w-4 h-4 text-yellow-400 mr-2" />
                        风险管理建议
                      </h4>
                      <ul className="space-y-2">
                        {riskAssessment.recommendations.map((recommendation, index) => (
                          <li key={index} className="text-slate-300 flex items-start">
                            <span className="text-yellow-400 mr-2">•</span>
                            {recommendation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 交易建议 */}
          <TabsContent value="advice" className="space-y-6">
            <Card className="trading-card">
              <CardHeader>
                <CardTitle className="flex items-center text-white">
                  <Target className="w-5 h-5 mr-2 text-orange-400" />
                  AI交易建议
                </CardTitle>
                <CardDescription className="text-slate-400">
                  基于市场分析生成个性化交易策略建议
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="advice-symbol" className="text-white">股票代码</Label>
                    <Input
                      id="advice-symbol"
                      placeholder="例如：000001.SZ"
                      value={stockSymbol}
                      onChange={(e) => setStockSymbol(e.target.value)}
                      className="bg-slate-800/50 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="trading-context" className="text-white">交易背景</Label>
                    <Input
                      id="trading-context"
                      placeholder="例如：计划长期投资，风险偏好中等"
                      value={tradingContext}
                      onChange={(e) => setTradingContext(e.target.value)}
                      className="bg-slate-800/50 border-slate-600 text-white"
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleTradingAdvice}
                  disabled={loadingStates[`tradingAdvice_${stockSymbol.toUpperCase()}`]}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {loadingStates[`tradingAdvice_${stockSymbol.toUpperCase()}`] ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Target className="w-4 h-4 mr-2" />
                      生成建议
                    </>
                  )}
                </Button>

                {stockSymbol && tradingAdvices[stockSymbol.toUpperCase()] && (
                  <div className="space-y-4 mt-6">
                    {(() => {
                      const advice = tradingAdvices[stockSymbol.toUpperCase()]
                      return (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                              <h4 className="font-semibold text-white mb-2">建议操作</h4>
                              <div className="flex items-center justify-center">
                                {getRecommendationIcon(advice.action)}
                                <span className={`ml-2 font-bold ${getPriceChangeColor(
                                  advice.action === 'BUY' ? 1 : 
                                  advice.action === 'SELL' ? -1 : 0
                                )}`}>
                                  {advice.action}
                                </span>
                              </div>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                              <h4 className="font-semibold text-white mb-2">入场价格</h4>
                              <p className="text-xl font-bold text-blue-400">
                                {advice.entry_price ? `¥${formatNumber(advice.entry_price)}` : 'N/A'}
                              </p>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                              <h4 className="font-semibold text-white mb-2">止损价格</h4>
                              <p className="text-xl font-bold text-green-400">
                                {advice.stop_loss ? `¥${formatNumber(advice.stop_loss)}` : 'N/A'}
                              </p>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                              <h4 className="font-semibold text-white mb-2">止盈价格</h4>
                              <p className="text-xl font-bold text-red-400">
                                {advice.take_profit ? `¥${formatNumber(advice.take_profit)}` : 'N/A'}
                              </p>
                            </div>
                          </div>

                          <div className="bg-slate-800/50 p-4 rounded-lg">
                            <h4 className="font-semibold text-white mb-2">分析理由</h4>
                            <p className="text-slate-300">{advice.reasoning}</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                              <h4 className="font-semibold text-white mb-2">建议仓位</h4>
                              <p className="text-xl font-bold text-purple-400">
                                {advice.position_size ? formatPercent(advice.position_size * 100) : 'N/A'}
                              </p>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                              <h4 className="font-semibold text-white mb-2">投资期限</h4>
                              <Badge variant="outline" className="text-yellow-400 border-yellow-400">
                                {advice.time_horizon}
                              </Badge>
                            </div>
                            <div className="bg-slate-800/50 p-4 rounded-lg text-center">
                              <h4 className="font-semibold text-white mb-2">置信水平</h4>
                              <div className="space-y-2">
                                <Progress value={advice.confidence_level * 100} />
                                <p className="text-sm text-blue-400">
                                  {formatPercent(advice.confidence_level * 100)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}