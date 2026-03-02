import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

// API基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1'

// 创建axios实例
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 添加认证token
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // 添加请求ID
    config.headers['X-Request-ID'] = Math.random().toString(36).substr(2, 9)
    
    console.log('API Request:', config.method?.toUpperCase(), config.url)
    return config
  },
  (error) => {
    console.error('Request Error:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log('API Response:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.error('Response Error:', error.response?.status, error.response?.data)
    
    // 处理认证错误
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    
    return Promise.reject(error)
  }
)

// 通用API响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 用户相关类型
export interface User {
  id: number
  username: string
  email: string
  phone?: string
  avatar?: string
  created_at: string
  updated_at: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  phone?: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

export interface AuthResponse {
  user: User
  tokens: TokenPair
}

// AI分析相关类型
export interface MarketAnalysis {
  analysis_id: string
  market_sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
  hot_sectors: string[]
  key_insights: string[]
  market_summary: string
  confidence_score: number
  generated_at: string
}

export interface StockAnalysis {
  analysis_id: string
  symbol: string
  recommendation: 'BUY' | 'SELL' | 'HOLD'
  target_price?: number
  support_levels: number[]
  resistance_levels: number[]
  key_factors: string[]
  risk_factors: string[]
  opportunity_score: number
  risk_score: number
  confidence_score: number
  generated_at: string
}

export interface RiskAssessment {
  assessment_id: string
  portfolio_risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  diversification_score: number
  volatility_score: number
  sector_concentration: Record<string, number>
  risk_metrics: Record<string, number>
  recommendations: string[]
  generated_at: string
}

export interface TradingAdvice {
  advice_id: string
  symbol: string
  action: 'BUY' | 'SELL' | 'HOLD'
  reasoning: string
  entry_price?: number
  stop_loss?: number
  take_profit?: number
  position_size?: number
  time_horizon: 'SHORT' | 'MEDIUM' | 'LONG'
  confidence_level: number
  generated_at: string
}

export interface StockHistoryItem {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
}

export interface StockHistoryResponse {
  symbol: string
  period: string
  data: StockHistoryItem[]
}

export interface StockQuote {
  symbol: string
  name: string
  price: number
  open: number
  high: number
  low: number
  volume: number
  change: number
  change_percent: number
  market_cap: number
  pe_ratio: number
  timestamp: string
}

export interface MarketOverview {
  indices: Record<string, {
    price: number
    change: number
    change_percent: number
    volume: number
  }>
  market_stats: {
    total_volume: number
    advancing_stocks: number
    declining_stocks: number
    unchanged_stocks: number
  }
  sector_performance: Record<string, number>
  timestamp: string
}

// 分时数据类型
export interface MinuteDataItem {
  time: string
  price: number
  volume: number
}

export interface MinuteDataResponse {
  symbol: string
  trade_date: string
  prev_close: number
  is_trading: boolean
  minutes: MinuteDataItem[]
}

// 概念板块热点轮动类型
export interface SectorRankingItem {
  name: string
  change_pct: number
}

export interface SectorHotspotDay {
  date: string
  rankings: SectorRankingItem[]
}

export interface SectorHotspotResponse {
  days: number
  data: SectorHotspotDay[]
  timestamp: string
}

// ============ 持仓/交易/资金相关类型 ============

// 账户定义
export const ACCOUNTS = [
  { key: 'pingan', label: '平安证券' },
  { key: 'xingye', label: '兴业证券' },
] as const

export type AccountKey = typeof ACCOUNTS[number]['key']

export interface PositionItem {
  id: string
  symbol: string
  stock_name: string
  exchange: string
  account: string
  quantity: number
  avg_cost: number
  total_cost: number
  current_price: number | null
  unrealized_pnl: number | null
  realized_pnl: number
  created_at: string
  updated_at: string
}

export interface TradeExecutionItem {
  id: string
  symbol: string
  stock_name: string
  account: string
  trade_type: 'BUY' | 'SELL'
  quantity: number
  price: number
  total_amount: number
  commission: number
  execution_type: string
  notes: string | null
  executed_at: string
}

export interface FundInfo {
  account: string
  total_capital: number
  available_cash: number
  position_value: number
  total_assets: number
}

export interface PortfolioSummary {
  funds: FundInfo[]
  positions: PositionItem[]
}

export interface AddPositionRequest {
  symbol: string
  name: string
  exchange: string
  account: string
  quantity: number
  avg_cost: number
}

export interface RecordTradeRequest {
  symbol: string
  name: string
  exchange: string
  account: string
  trade_type: 'BUY' | 'SELL'
  quantity: number
  price: number
  commission?: number
  notes?: string
}

export interface UpdateFundRequest {
  account: string
  total_capital: number
  available_cash: number
}

export interface StockSearchResult {
  symbol: string
  name: string
  exchange: string
}

// ============ 策略模块类型 ============

export interface BuiltinStrategy {
  id: string
  name: string
  type: 'SHORT' | 'MID' | 'LONG' | 'POSITION'
  description: string
  buy_logic: string
  sell_logic: string
}

export interface TradingStrategy {
  id: string
  stock_symbol: string
  stock_name: string
  name: string
  strategy_type: 'SHORT' | 'MID' | 'LONG'
  builtin_strategy_ids: string[]
  custom_rules: string
  alert_enabled: boolean
  status: 'ACTIVE' | 'PAUSED'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CreateStrategyRequest {
  stock_symbol: string
  stock_name: string
  name: string
  strategy_type: 'SHORT' | 'MID' | 'LONG'
  builtin_strategy_ids: string[]
  custom_rules?: string
  alert_enabled?: boolean
  notes?: string
}

export interface UpdateStrategyRequest {
  name?: string
  strategy_type?: string
  builtin_strategy_ids?: string[]
  custom_rules?: string
  alert_enabled?: boolean
  status?: string
  notes?: string
}

export interface StrategyAlert {
  id: string
  strategy_id: string
  stock_symbol: string
  stock_name: string
  alert_type: 'BUY_SIGNAL' | 'SELL_SIGNAL'
  triggered_strategy: string | null
  message: string
  details: string | null
  is_read: boolean
  created_at: string
}

export interface BacktestRequest {
  stock_symbol: string
  builtin_strategy_ids: string[]
  custom_rules?: string
  start_date?: string
  end_date?: string
  initial_capital?: number
}

export interface BacktestTrade {
  entry_date: string
  exit_date: string
  entry_price: number
  exit_price: number
  pnl_pct: number
  hold_days: number
  strategy: string
  entry_strategy?: string
  quantity?: number
  action_type?: string
  trade_direction?: string
  amount?: number
  position_ratio?: number
}

export interface BacktestKlineItem {
  date: string
  open: number
  close: number
  high: number
  low: number
  volume: number
  signal: number  // 1=买入, -1=卖出, 0=无
  ma5?: number
  ma10?: number
  ma20?: number
  ma60?: number
}

export interface BacktestSummary {
  total_trades: number
  win_rate: number
  avg_return: number
  total_return: number
  max_drawdown: number
  profit_factor: number
  avg_win: number
  avg_loss: number
  total_wins: number
  total_losses: number
  final_capital: number
  initial_capital: number
}

export interface BacktestResult {
  summary: BacktestSummary
  trades: BacktestTrade[]
  kline_data: BacktestKlineItem[]
  strategy_ids: string[]
}

export interface AlertsResponse {
  alerts: StrategyAlert[]
  total: number
  limit: number
  offset: number
}

export interface AlertMute {
  id: string
  user_id: string
  stock_symbol: string
  alert_type: 'BUY_SIGNAL' | 'SELL_SIGNAL'
  mute_date: string
}

// ============ 交易计划类型 ============

export interface TradingPlan {
  id: string
  stock_symbol: string
  stock_name: string
  plan_type: 'BUY' | 'SELL'
  target_price: number
  stop_loss: number | null
  take_profit: number | null
  quantity: number
  reasoning: string | null
  ai_confidence: number | null
  status: 'ACTIVE' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  expected_return: number | null
  max_risk: number | null
  alert_id: string | null
  created_at: string
  updated_at: string
  executed_at: string | null
  expires_at: string | null
}

export interface CreatePlanRequest {
  symbol: string
  name: string
  exchange: string
  plan_type: 'BUY' | 'SELL'
  target_price: number
  stop_loss?: number
  take_profit?: number
  quantity: number
  reasoning?: string
  priority?: string
  alert_id?: string
}

export interface UpdatePlanStatusRequest {
  status: 'ACTIVE' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED'
}

// API方法类
class TradingAPI {
  // 认证相关
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/login', data)
    return response.data.data!
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await apiClient.post<ApiResponse<AuthResponse>>('/auth/register', data)
    return response.data.data!
  }

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout')
    localStorage.removeItem('auth_token')
  }

  async getProfile(): Promise<User> {
    const response = await apiClient.get<ApiResponse<User>>('/users/profile')
    return response.data.data!
  }

  // AI分析相关
  async analyzeMarketTrend(symbols?: string[]): Promise<MarketAnalysis> {
    const response = await apiClient.post<ApiResponse<MarketAnalysis>>('/ai/market-trend', {
      symbols,
    })
    return response.data.data!
  }

  async analyzeStockOpportunity(
    symbol: string,
    userContext?: Record<string, any>
  ): Promise<StockAnalysis> {
    const response = await apiClient.post<ApiResponse<StockAnalysis>>('/ai/stock-opportunity', {
      symbol,
      user_context: userContext,
    })
    return response.data.data!
  }

  async assessPortfolioRisk(portfolio: Record<string, number>): Promise<RiskAssessment> {
    const response = await apiClient.post<ApiResponse<RiskAssessment>>('/ai/risk-assessment', {
      portfolio,
    })
    return response.data.data!
  }

  async generateTradingAdvice(
    symbol: string,
    planContext: Record<string, any>
  ): Promise<TradingAdvice> {
    const response = await apiClient.post<ApiResponse<TradingAdvice>>('/ai/trading-advice', {
      symbol,
      plan_context: planContext,
    })
    return response.data.data!
  }

  async getMarketOverview(): Promise<MarketOverview> {
    const response = await apiClient.get<ApiResponse<MarketOverview>>('/ai/market-overview')
    return response.data.data!
  }

  async getStockQuote(symbol: string): Promise<StockQuote> {
    const response = await apiClient.get<ApiResponse<StockQuote>>(`/ai/stock/${symbol}/quote`)
    return response.data.data!
  }

  async getAnalysisHistory(limit: number = 20, offset: number = 0): Promise<any[]> {
    const response = await apiClient.get<ApiResponse<{ analyses: any[] }>>(
      `/ai/history?limit=${limit}&offset=${offset}`
    )
    return response.data.data!.analyses
  }

  async getStockHistory(symbol: string, period: string = '1mo'): Promise<StockHistoryResponse> {
    const response = await apiClient.get<ApiResponse<StockHistoryResponse>>(
      `/ai/stock/${symbol}/history?period=${period}`
    )
    return response.data.data!
  }

  // 健康检查
  async healthCheck(): Promise<{ status: string }> {
    const response = await apiClient.get<ApiResponse<{ status: string }>>('/ai/health')
    return response.data.data!
  }

  // 分时数据
  async getMinuteData(symbol: string): Promise<MinuteDataResponse> {
    const response = await apiClient.get<ApiResponse<MinuteDataResponse>>(
      `/ai/stock/${symbol}/minute`
    )
    return response.data.data!
  }

  // 概念板块热点轮动
  async getSectorHotspot(days: number = 5): Promise<SectorHotspotResponse> {
    const response = await apiClient.get<ApiResponse<SectorHotspotResponse>>(
      `/ai/sector/hotspot?days=${days}`
    )
    return response.data.data!
  }

  // ============ 持仓管理 ============

  async getPositions(account?: string): Promise<PositionItem[]> {
    const params = account ? `?account=${encodeURIComponent(account)}` : ''
    const response = await apiClient.get<ApiResponse<PositionItem[]>>(`/trading/positions${params}`)
    return response.data.data!
  }

  async addPosition(data: AddPositionRequest): Promise<PositionItem> {
    const response = await apiClient.post<ApiResponse<PositionItem>>('/trading/positions', data)
    return response.data.data!
  }

  async deletePosition(id: string): Promise<void> {
    await apiClient.delete(`/trading/positions/${id}`)
  }

  // ============ 交易记录 ============

  async recordTrade(data: RecordTradeRequest): Promise<TradeExecutionItem> {
    const response = await apiClient.post<ApiResponse<TradeExecutionItem>>('/trading/execute', data)
    return response.data.data!
  }

  async getTradeHistory(limit: number = 20, offset: number = 0, account?: string): Promise<{ executions: TradeExecutionItem[]; total: number }> {
    let url = `/trading/history?limit=${limit}&offset=${offset}`
    if (account) url += `&account=${encodeURIComponent(account)}`
    const response = await apiClient.get<ApiResponse<{ executions: TradeExecutionItem[]; total: number }>>(url)
    return response.data.data!
  }

  // ============ 资金管理 ============

  async getFund(account?: string): Promise<FundInfo> {
    const params = account ? `?account=${encodeURIComponent(account)}` : ''
    const response = await apiClient.get<ApiResponse<FundInfo>>(`/trading/fund${params}`)
    return response.data.data!
  }

  async updateFund(data: UpdateFundRequest): Promise<FundInfo> {
    const response = await apiClient.put<ApiResponse<FundInfo>>('/trading/fund', data)
    return response.data.data!
  }

  // ============ 投资组合概览 ============

  async getPortfolioSummary(account?: string): Promise<PortfolioSummary> {
    const params = account ? `?account=${encodeURIComponent(account)}` : ''
    const response = await apiClient.get<ApiResponse<PortfolioSummary>>(`/trading/portfolio${params}`)
    return response.data.data!
  }

  // ============ 股票搜索（在线实时搜索，通过新浪 API） ============

  async searchStocks(query: string, limit: number = 10): Promise<StockSearchResult[]> {
    const response = await apiClient.get<ApiResponse<StockSearchResult[]>>(
      `/ai/stocks/search?q=${encodeURIComponent(query)}&limit=${limit}`
    )
    return response.data.data!
  }

  // ============ 策略管理 ============

  async getBuiltinStrategies(): Promise<BuiltinStrategy[]> {
    const response = await apiClient.get<ApiResponse<BuiltinStrategy[]>>('/trading/strategies/builtin')
    return response.data.data!
  }

  async getStrategies(): Promise<TradingStrategy[]> {
    const response = await apiClient.get<ApiResponse<TradingStrategy[]>>('/trading/strategies')
    return response.data.data!
  }

  async createStrategy(data: CreateStrategyRequest): Promise<TradingStrategy> {
    const response = await apiClient.post<ApiResponse<TradingStrategy>>('/trading/strategies', data)
    return response.data.data!
  }

  async updateStrategy(id: string, data: UpdateStrategyRequest): Promise<TradingStrategy> {
    const response = await apiClient.put<ApiResponse<TradingStrategy>>(`/trading/strategies/${id}`, data)
    return response.data.data!
  }

  async deleteStrategy(id: string): Promise<void> {
    await apiClient.delete(`/trading/strategies/${id}`)
  }

  // ============ 策略提醒 ============

  async getAlerts(unreadOnly: boolean = false, limit: number = 20, offset: number = 0): Promise<AlertsResponse> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (unreadOnly) params.set('unread_only', 'true')
    const response = await apiClient.get<ApiResponse<AlertsResponse>>(`/trading/strategy-alerts?${params}`)
    return response.data.data!
  }

  async markAlertRead(id: string): Promise<void> {
    await apiClient.put(`/trading/strategy-alerts/${id}/read`)
  }

  async markAllAlertsRead(): Promise<void> {
    await apiClient.put('/trading/strategy-alerts/read-all')
  }

  async getUnreadAlertCount(): Promise<number> {
    const response = await apiClient.get<ApiResponse<{ count: number }>>('/trading/strategy-alerts/unread-count')
    return response.data.data!.count
  }

  async muteAlert(stockSymbol: string, alertType: string): Promise<void> {
    await apiClient.post('/trading/strategy-alerts/mute', { stock_symbol: stockSymbol, alert_type: alertType })
  }

  async unmuteAlert(stockSymbol: string, alertType: string): Promise<void> {
    await apiClient.post('/trading/strategy-alerts/unmute', { stock_symbol: stockSymbol, alert_type: alertType })
  }

  async getMutedAlerts(): Promise<AlertMute[]> {
    const response = await apiClient.get<ApiResponse<{ mutes: AlertMute[] }>>('/trading/strategy-alerts/mutes')
    return response.data.data!.mutes
  }

  // ============ 回测 ============

  async runBacktest(data: BacktestRequest): Promise<BacktestResult> {
    const response = await apiClient.post<{ success: boolean; data: BacktestResult }>('/trading/backtest', data)
    return response.data.data
  }

  // ============ 交易计划 ============

  async getPlans(status?: string): Promise<TradingPlan[]> {
    const params = status ? `?status=${encodeURIComponent(status)}` : ''
    const response = await apiClient.get<ApiResponse<TradingPlan[]>>(`/trading/plans${params}`)
    return response.data.data!
  }

  async getPlanByID(id: string): Promise<TradingPlan> {
    const response = await apiClient.get<ApiResponse<TradingPlan>>(`/trading/plans/${id}`)
    return response.data.data!
  }

  async createPlan(data: CreatePlanRequest): Promise<TradingPlan> {
    const response = await apiClient.post<ApiResponse<TradingPlan>>('/trading/plans', data)
    return response.data.data!
  }

  async updatePlanStatus(id: string, data: UpdatePlanStatusRequest): Promise<TradingPlan> {
    const response = await apiClient.put<ApiResponse<TradingPlan>>(`/trading/plans/${id}/status`, data)
    return response.data.data!
  }

  // ============ 批量获取股票行情 ============

  async getBatchStockQuotes(symbols: string[]): Promise<Record<string, StockQuote>> {
    if (symbols.length === 0) return {}
    const results: Record<string, StockQuote> = {}
    const promises = symbols.map(async (symbol) => {
      try {
        const quote = await this.getStockQuote(symbol)
        results[symbol] = quote
      } catch {
        // 单只失败不影响其他
      }
    })
    await Promise.allSettled(promises)
    return results
  }
}

// 导出API实例
export const api = new TradingAPI()
export default apiClient