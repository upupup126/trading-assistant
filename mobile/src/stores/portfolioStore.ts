import { create } from 'zustand';
import {
  api,
  PositionItem,
  TradeExecutionItem,
  FundInfo,
  StockQuote,
  AddPositionRequest,
  RecordTradeRequest,
  UpdateFundRequest,
  ACCOUNTS,
} from '../lib/api';

interface PortfolioState {
  currentAccount: string;
  positions: PositionItem[];
  positionQuotes: Record<string, StockQuote>;
  quotesLoading: boolean;
  tradeHistory: TradeExecutionItem[];
  tradeHistoryTotal: number;
  fund: FundInfo | null;
  isLoading: boolean;
  error: string | null;
}

interface PortfolioActions {
  setCurrentAccount: (account: string) => void;
  fetchPositions: () => Promise<void>;
  fetchPositionQuotes: () => Promise<void>;
  addPosition: (data: AddPositionRequest) => Promise<void>;
  deletePosition: (id: string) => Promise<void>;
  fetchTradeHistory: (limit?: number, offset?: number) => Promise<void>;
  recordTrade: (data: RecordTradeRequest) => Promise<void>;
  fetchFund: () => Promise<void>;
  updateFund: (data: UpdateFundRequest) => Promise<void>;
  clearError: () => void;
}

export const usePortfolioStore = create<PortfolioState & PortfolioActions>()(
  (set, get) => ({
    currentAccount: ACCOUNTS[0].key,
    positions: [],
    positionQuotes: {},
    quotesLoading: false,
    tradeHistory: [],
    tradeHistoryTotal: 0,
    fund: null,
    isLoading: false,
    error: null,

    setCurrentAccount: (account: string) => set({ currentAccount: account }),

    fetchPositions: async () => {
      try {
        set({ isLoading: true, error: null });
        const account = get().currentAccount;
        const positions = await api.getPositions(account);
        set({ positions, isLoading: false });
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || '获取持仓失败';
        set({ isLoading: false, error: msg });
      }
    },

    fetchPositionQuotes: async () => {
      const positions = get().positions;
      if (positions.length === 0) { set({ positionQuotes: {} }); return; }
      set({ quotesLoading: true });
      try {
        const symbols = positions.map((p) => p.symbol);
        const quotes = await api.getBatchStockQuotes(symbols);
        set({ positionQuotes: quotes, quotesLoading: false });
      } catch {
        set({ quotesLoading: false });
      }
    },

    addPosition: async (data: AddPositionRequest) => {
      try {
        set({ isLoading: true, error: null });
        await api.addPosition(data);
        await get().fetchPositions();
        await get().fetchFund();
        set({ isLoading: false });
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || '添加持仓失败';
        set({ isLoading: false, error: msg });
        throw error;
      }
    },

    deletePosition: async (id: string) => {
      try {
        set({ isLoading: true, error: null });
        await api.deletePosition(id);
        await get().fetchPositions();
        await get().fetchFund();
        set({ isLoading: false });
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || '删除持仓失败';
        set({ isLoading: false, error: msg });
        throw error;
      }
    },

    fetchTradeHistory: async (limit = 20, offset = 0) => {
      try {
        set({ isLoading: true, error: null });
        const account = get().currentAccount;
        const result = await api.getTradeHistory(limit, offset, account);
        set({ tradeHistory: result.executions, tradeHistoryTotal: result.total, isLoading: false });
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || '获取交易记录失败';
        set({ isLoading: false, error: msg });
      }
    },

    recordTrade: async (data: RecordTradeRequest) => {
      try {
        set({ isLoading: true, error: null });
        await api.recordTrade(data);
        await get().fetchPositions();
        await get().fetchTradeHistory();
        await get().fetchFund();
        set({ isLoading: false });
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || '记录交易失败';
        set({ isLoading: false, error: msg });
        throw error;
      }
    },

    fetchFund: async () => {
      try {
        set({ error: null });
        const account = get().currentAccount;
        const fund = await api.getFund(account);
        set({ fund });
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || '获取资金信息失败';
        set({ error: msg });
      }
    },

    updateFund: async (data: UpdateFundRequest) => {
      try {
        set({ isLoading: true, error: null });
        const fund = await api.updateFund(data);
        set({ fund, isLoading: false });
      } catch (error: any) {
        const msg = error.response?.data?.error?.message || '更新资金失败';
        set({ isLoading: false, error: msg });
        throw error;
      }
    },

    clearError: () => set({ error: null }),
  })
);
