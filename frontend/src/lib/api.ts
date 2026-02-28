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

  // 健康检查
  async healthCheck(): Promise<{ status: string }> {
    const response = await apiClient.get<ApiResponse<{ status: string }>>('/ai/health')
    return response.data.data!
  }
}

// 导出API实例
export const api = new TradingAPI()
export default apiClient