import { create } from 'zustand';
import {
  api,
  MarketOverview,
  MarketAnalysis,
  StockAnalysis,
  RiskAssessment,
  TradingAdvice,
  StockHistoryResponse,
} from '../lib/api';

interface AIState {
  marketOverview: MarketOverview | null;
  marketAnalysis: MarketAnalysis | null;
  stockAnalyses: Record<string, StockAnalysis>;
  stockHistories: Record<string, StockHistoryResponse>;
  riskAssessment: RiskAssessment | null;
  tradingAdvices: Record<string, TradingAdvice>;
  loadingStates: Record<string, boolean>;
  error: string | null;

  getMarketOverview: () => Promise<void>;
  analyzeMarketTrend: (symbols?: string[]) => Promise<void>;
  analyzeStockOpportunity: (symbol: string) => Promise<void>;
  getStockHistory: (symbol: string, period?: string) => Promise<void>;
  assessPortfolioRisk: (portfolio: Record<string, number>) => Promise<void>;
  generateTradingAdvice: (symbol: string, context?: Record<string, any>) => Promise<void>;
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
      const data = await api.getMarketOverview();
      set({ marketOverview: data });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      setLoading(set, 'marketOverview', false);
    }
  },

  analyzeMarketTrend: async (symbols = ['000001.SZ', '600519.SH']) => {
    setLoading(set, 'marketTrend', true);
    try {
      const data = await api.analyzeMarketTrend(symbols);
      set({ marketAnalysis: data });
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
      const analysis = await api.analyzeStockOpportunity(symbol);
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
      const historyData = await api.getStockHistory(symbol, period);
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
      const data = await api.assessPortfolioRisk(portfolio);
      set({ riskAssessment: data });
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
      const advice = await api.generateTradingAdvice(symbol, context);
      set((s) => ({ tradingAdvices: { ...s.tradingAdvices, [symbol]: advice } }));
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      setLoading(set, key, false);
    }
  },

  clearError: () => set({ error: null }),
}));
