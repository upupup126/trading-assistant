import { create } from 'zustand'
import { 
  api, 
  MarketAnalysis, 
  StockAnalysis, 
  RiskAssessment, 
  TradingAdvice,
  MarketOverview,
  StockQuote,
  StockHistoryResponse,
  MinuteDataResponse,
  SectorHotspotResponse
} from '@/lib/api'

interface AIState {
  // 市场分析
  marketAnalysis: MarketAnalysis | null
  marketOverview: MarketOverview | null
  
  // 个股分析
  stockAnalyses: Record<string, StockAnalysis>
  stockQuotes: Record<string, StockQuote>
  
  // K线历史数据
  stockHistories: Record<string, StockHistoryResponse>
  
  // 分时数据
  minuteData: Record<string, MinuteDataResponse>
  
  // 板块热点轮动
  sectorHotspot: SectorHotspotResponse | null
  
  // 风险评估
  riskAssessment: RiskAssessment | null
  
  // 交易建议
  tradingAdvices: Record<string, TradingAdvice>
  
  // 分析历史
  analysisHistory: any[]
  
  // 加载状态
  isLoading: boolean
  loadingStates: Record<string, boolean>
  
  // 错误状态
  error: string | null
  errors: Record<string, string>
}

interface AIActions {
  // 市场分析
  analyzeMarketTrend: (symbols?: string[]) => Promise<MarketAnalysis>
  getMarketOverview: () => Promise<MarketOverview>
  
  // 个股分析
  analyzeStockOpportunity: (symbol: string, userContext?: Record<string, any>) => Promise<StockAnalysis>
  getStockQuote: (symbol: string) => Promise<StockQuote>
  getStockHistory: (symbol: string, period?: string) => Promise<StockHistoryResponse>
  
  // 分时数据
  getMinuteData: (symbol: string) => Promise<MinuteDataResponse>
  
  // 板块热点轮动
  getSectorHotspot: (days?: number) => Promise<SectorHotspotResponse>
  
  // 风险评估
  assessPortfolioRisk: (portfolio: Record<string, number>) => Promise<RiskAssessment>
  
  // 交易建议
  generateTradingAdvice: (symbol: string, planContext: Record<string, any>) => Promise<TradingAdvice>
  
  // 分析历史
  getAnalysisHistory: (limit?: number, offset?: number) => Promise<any[]>
  
  // 工具方法
  clearError: () => void
  clearErrors: () => void
  setLoading: (key: string, loading: boolean) => void
}

export const useAIStore = create<AIState & AIActions>((set, get) => ({
  // 初始状态
  marketAnalysis: null,
  marketOverview: null,
  stockAnalyses: {},
  stockQuotes: {},
  stockHistories: {},
  minuteData: {},
  sectorHotspot: null,
  riskAssessment: null,
  tradingAdvices: {},
  analysisHistory: [],
  isLoading: false,
  loadingStates: {},
  error: null,
  errors: {},

  // 市场分析
  analyzeMarketTrend: async (symbols?: string[]) => {
    try {
      set({ isLoading: true, error: null })
      get().setLoading('marketTrend', true)
      
      const analysis = await api.analyzeMarketTrend(symbols)
      
      set({ 
        marketAnalysis: analysis,
        isLoading: false,
        error: null 
      })
      get().setLoading('marketTrend', false)
      
      return analysis
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || '市场分析失败'
      set({ 
        isLoading: false, 
        error: errorMessage 
      })
      get().setLoading('marketTrend', false)
      throw error
    }
  },

  getMarketOverview: async () => {
    try {
      get().setLoading('marketOverview', true)
      
      const overview = await api.getMarketOverview()
      
      set({ marketOverview: overview })
      get().setLoading('marketOverview', false)
      
      return overview
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || '获取市场概览失败'
      set(state => ({
        errors: { ...state.errors, marketOverview: errorMessage }
      }))
      get().setLoading('marketOverview', false)
      throw error
    }
  },

  // 个股分析
  analyzeStockOpportunity: async (symbol: string, userContext?: Record<string, any>) => {
    try {
      get().setLoading(`stockAnalysis_${symbol}`, true)
      
      const analysis = await api.analyzeStockOpportunity(symbol, userContext)
      
      set(state => ({
        stockAnalyses: {
          ...state.stockAnalyses,
          [symbol]: analysis
        }
      }))
      get().setLoading(`stockAnalysis_${symbol}`, false)
      
      return analysis
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || '个股分析失败'
      set(state => ({
        errors: { ...state.errors, [`stockAnalysis_${symbol}`]: errorMessage }
      }))
      get().setLoading(`stockAnalysis_${symbol}`, false)
      throw error
    }
  },

  getStockQuote: async (symbol: string) => {
    try {
      get().setLoading(`stockQuote_${symbol}`, true)
      
      const quote = await api.getStockQuote(symbol)
      
      set(state => ({
        stockQuotes: {
          ...state.stockQuotes,
          [symbol]: quote
        }
      }))
      get().setLoading(`stockQuote_${symbol}`, false)
      
      return quote
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || '获取股票行情失败'
      set(state => ({
        errors: { ...state.errors, [`stockQuote_${symbol}`]: errorMessage }
      }))
      get().setLoading(`stockQuote_${symbol}`, false)
      throw error
    }
  },

  getStockHistory: async (symbol: string, period: string = '1mo') => {
    const key = `stockHistory_${symbol}_${period}`
    try {
      get().setLoading(key, true)
      
      const history = await api.getStockHistory(symbol, period)
      
      set(state => ({
        stockHistories: {
          ...state.stockHistories,
          [`${symbol}_${period}`]: history
        }
      }))
      get().setLoading(key, false)
      
      return history
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || '获取K线数据失败'
      set(state => ({
        errors: { ...state.errors, [key]: errorMessage }
      }))
      get().setLoading(key, false)
      throw error
    }
  },

  // 分时数据
  getMinuteData: async (symbol: string) => {
    const key = `minuteData_${symbol}`
    try {
      get().setLoading(key, true)
      
      const data = await api.getMinuteData(symbol)
      
      set(state => ({
        minuteData: {
          ...state.minuteData,
          [symbol]: data
        }
      }))
      get().setLoading(key, false)
      
      return data
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || '获取分时数据失败'
      set(state => ({
        errors: { ...state.errors, [key]: errorMessage }
      }))
      get().setLoading(key, false)
      throw error
    }
  },

  // 板块热点轮动
  getSectorHotspot: async (days: number = 5) => {
    try {
      get().setLoading('sectorHotspot', true)
      
      const data = await api.getSectorHotspot(days)
      
      set({ sectorHotspot: data })
      get().setLoading('sectorHotspot', false)
      
      return data
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || '获取板块热点数据失败'
      set(state => ({
        errors: { ...state.errors, sectorHotspot: errorMessage }
      }))
      get().setLoading('sectorHotspot', false)
      throw error
    }
  },

  // 风险评估
  assessPortfolioRisk: async (portfolio: Record<string, number>) => {
    try {
      get().setLoading('riskAssessment', true)
      
      const assessment = await api.assessPortfolioRisk(portfolio)
      
      set({ riskAssessment: assessment })
      get().setLoading('riskAssessment', false)
      
      return assessment
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || '风险评估失败'
      set(state => ({
        errors: { ...state.errors, riskAssessment: errorMessage }
      }))
      get().setLoading('riskAssessment', false)
      throw error
    }
  },

  // 交易建议
  generateTradingAdvice: async (symbol: string, planContext: Record<string, any>) => {
    try {
      get().setLoading(`tradingAdvice_${symbol}`, true)
      
      const advice = await api.generateTradingAdvice(symbol, planContext)
      
      set(state => ({
        tradingAdvices: {
          ...state.tradingAdvices,
          [symbol]: advice
        }
      }))
      get().setLoading(`tradingAdvice_${symbol}`, false)
      
      return advice
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || '生成交易建议失败'
      set(state => ({
        errors: { ...state.errors, [`tradingAdvice_${symbol}`]: errorMessage }
      }))
      get().setLoading(`tradingAdvice_${symbol}`, false)
      throw error
    }
  },

  // 分析历史
  getAnalysisHistory: async (limit: number = 20, offset: number = 0) => {
    try {
      get().setLoading('analysisHistory', true)
      
      const history = await api.getAnalysisHistory(limit, offset)
      
      set({ analysisHistory: history })
      get().setLoading('analysisHistory', false)
      
      return history
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || '获取分析历史失败'
      set(state => ({
        errors: { ...state.errors, analysisHistory: errorMessage }
      }))
      get().setLoading('analysisHistory', false)
      throw error
    }
  },

  // 工具方法
  clearError: () => {
    set({ error: null })
  },

  clearErrors: () => {
    set({ errors: {} })
  },

  setLoading: (key: string, loading: boolean) => {
    set(state => ({
      loadingStates: {
        ...state.loadingStates,
        [key]: loading
      }
    }))
  },
}))