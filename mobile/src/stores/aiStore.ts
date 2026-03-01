import { create } from 'zustand';
import api from '../lib/api';

interface MarketOverview {
  indices: any[];
  market_stats: any;
  sector_performance: any[];
  timestamp: string;
}

interface MarketAnalysis {
  market_sentiment: string;
  hot_sectors: string[];
  key_insights: string[];
  market_summary: string;
  confidence_score: number;
}

interface StockAnalysis {
  recommendation: string;
  target_price_range: any;
  key_factors: string[];
  risk_level: string;
  opportunity_score: number;
  analysis_summary: string;
}

interface RiskAssessment {
  portfolio_risk_level: string;
  risk_score: number;
  diversification_score: number;
  risk_factors: string[];
  recommendations: string[];
  risk_summary: string;
}

interface TradingAdvice {
  action: string;
  entry_price_range: any;
  stop_loss: number;
  take_profit: number;
  position_size_suggestion: string;
  reasoning: string[];
  risk_reward_ratio: number;
  advice_summary: string;
}

interface StockHistoryItem {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface StockHistoryData {
  symbol: string;
  period: string;
  data: StockHistoryItem[];
}

interface AIState {
  marketOverview: MarketOverview | null;
  marketAnalysis: MarketAnalysis | null;
  stockAnalyses: Record<string, StockAnalysis>;
  stockHistories: Record<string, StockHistoryData>;
  riskAssessment: RiskAssessment | null;
  tradingAdvices: Record<string, TradingAdvice>;
  loadingStates: Record<string, boolean>;
  error: string | null;

  getMarketOverview: () => Promise<void>;
  analyzeMarketTrend: (symbols?: string[]) => Promise<void>;
  analyzeStockOpportunity: (symbol: string) => Promise<void>;
  getStockHistory: (symbol: string, period?: string) => Promise<void>;
  assessPortfolioRisk: (portfolio: Record<string, number>) => Promise<void>;
  generateTradingAdvice: (symbol: string, context?: object) => Promise<void>;
  clearError: () => void;
}

const setLoading = (set: any, key: string, val: boolean) =>
  set((s: AIState) => ({ loadingStates: { ...s.loadingStates, [key]: val } }));

export const useAIStore = create<AIState>((set) => ({
  marketOverview: null,
  marketAnalysis: null,
  stockAnalyses: {},
  stockHistories: {},
  riskAssessment: null,
  tradingAdvices: {},
  loadingStates: {},
  error: null,

  getMarketOverview: async () => {
    setLoading(set, 'marketOverview', true);
    try {
      const res = await api.getMarketOverview();
      set({ marketOverview: res.data.data });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      setLoading(set, 'marketOverview', false);
    }
  },

  analyzeMarketTrend: async (symbols = ['000001.SZ', '600519.SH']) => {
    setLoading(set, 'marketTrend', true);
    try {
      const res = await api.analyzeMarketTrend(symbols);
      set({ marketAnalysis: res.data.data?.ai_analysis || res.data.data });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      setLoading(set, 'marketTrend', false);
    }
  },

  analyzeStockOpportunity: async (symbol) => {
    const key = `stockAnalysis_${symbol}`;
    setLoading(set, key, true);
    try {
      const res = await api.analyzeStockOpportunity(symbol);
      const analysis = res.data.data?.ai_analysis || res.data.data;
      set((s) => ({ stockAnalyses: { ...s.stockAnalyses, [symbol]: analysis } }));
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      setLoading(set, key, false);
    }
  },

  getStockHistory: async (symbol, period = '1mo') => {
    const key = `stockHistory_${symbol}_${period}`;
    setLoading(set, key, true);
    try {
      const res = await api.getStockHistory(symbol, period);
      const historyData = res.data.data || res.data;
      set((s) => ({
        stockHistories: {
          ...s.stockHistories,
          [`${symbol}_${period}`]: historyData,
        },
      }));
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      setLoading(set, key, false);
    }
  },

  assessPortfolioRisk: async (portfolio) => {
    setLoading(set, 'riskAssessment', true);
    try {
      const res = await api.assessPortfolioRisk(portfolio);
      set({ riskAssessment: res.data.data?.ai_analysis || res.data.data });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      setLoading(set, 'riskAssessment', false);
    }
  },

  generateTradingAdvice: async (symbol, context) => {
    const key = `tradingAdvice_${symbol}`;
    setLoading(set, key, true);
    try {
      const res = await api.generateTradingAdvice(symbol, context);
      const advice = res.data.data?.ai_analysis || res.data.data;
      set((s) => ({ tradingAdvices: { ...s.tradingAdvices, [symbol]: advice } }));
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      setLoading(set, key, false);
    }
  },

  clearError: () => set({ error: null }),
}));
