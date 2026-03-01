import axios, { AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'http://45.40.228.140:8080/api/v1';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('auth_token');
    }
    return Promise.reject(error);
  }
);

// ============ 通用类型 ============

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ============ 用户认证 ============

export interface User {
  id: number;
  username: string;
  email: string;
  phone?: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

// ============ AI 分析 ============

export interface MarketAnalysis {
  analysis_id: string;
  market_sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  hot_sectors: string[];
  key_insights: string[];
  market_summary: string;
  confidence_score: number;
  generated_at: string;
}

export interface StockAnalysis {
  analysis_id: string;
  symbol: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  target_price?: number;
  support_levels: number[];
  resistance_levels: number[];
  key_factors: string[];
  risk_factors: string[];
  opportunity_score: number;
  risk_score: number;
  confidence_score: number;
  generated_at: string;
  risk_level?: string;
  analysis_summary?: string;
  [key: string]: any;
}

export interface RiskAssessment {
  assessment_id: string;
  portfolio_risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  diversification_score: number;
  volatility_score: number;
  sector_concentration: Record<string, number>;
  risk_metrics: Record<string, number>;
  recommendations: string[];
  generated_at: string;
  risk_score?: number;
  risk_summary?: string;
  risk_factors?: string[];
  [key: string]: any;
}

export interface TradingAdvice {
  advice_id: string;
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  reasoning: string | string[];
  entry_price?: number;
  stop_loss?: number;
  take_profit?: number;
  position_size?: number;
  time_horizon: 'SHORT' | 'MEDIUM' | 'LONG';
  confidence_level: number;
  generated_at: string;
  advice_summary?: string;
  risk_reward_ratio?: number;
  [key: string]: any;
}

export interface StockHistoryItem {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

export interface StockHistoryResponse {
  symbol: string;
  period: string;
  data: StockHistoryItem[];
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  change: number;
  change_percent: number;
  market_cap: number;
  pe_ratio: number;
  timestamp: string;
}

export interface MarketOverview {
  indices: any;
  market_stats: any;
  sector_performance: any;
  timestamp: string;
  [key: string]: any;
}

// ============ 持仓/交易/资金 ============

export const ACCOUNTS = [
  { key: 'pingan', label: '平安证券' },
  { key: 'xingye', label: '兴业证券' },
] as const;

export type AccountKey = typeof ACCOUNTS[number]['key'];

export interface PositionItem {
  id: string;
  symbol: string;
  stock_name: string;
  exchange: string;
  account: string;
  quantity: number;
  avg_cost: number;
  total_cost: number;
  current_price: number | null;
  unrealized_pnl: number | null;
  realized_pnl: number;
  created_at: string;
  updated_at: string;
}

export interface TradeExecutionItem {
  id: string;
  symbol: string;
  stock_name: string;
  account: string;
  trade_type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total_amount: number;
  commission: number;
  execution_type: string;
  notes: string | null;
  executed_at: string;
}

export interface FundInfo {
  account: string;
  total_capital: number;
  available_cash: number;
  position_value: number;
  total_assets: number;
}

export interface PortfolioSummary {
  funds: FundInfo[];
  positions: PositionItem[];
}

export interface AddPositionRequest {
  symbol: string;
  name: string;
  exchange: string;
  account: string;
  quantity: number;
  avg_cost: number;
}

export interface RecordTradeRequest {
  symbol: string;
  name: string;
  exchange: string;
  account: string;
  trade_type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  commission?: number;
  notes?: string;
}

export interface UpdateFundRequest {
  account: string;
  total_capital: number;
  available_cash: number;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

// ============ 策略模块 ============

export interface BuiltinStrategy {
  id: string;
  name: string;
  type: 'SHORT' | 'MID' | 'LONG' | 'POSITION';
  description: string;
  buy_logic: string;
  sell_logic: string;
}

export interface TradingStrategy {
  id: string;
  stock_symbol: string;
  stock_name: string;
  name: string;
  strategy_type: 'SHORT' | 'MID' | 'LONG';
  builtin_strategy_ids: string[];
  custom_rules: string;
  alert_enabled: boolean;
  status: 'ACTIVE' | 'PAUSED';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateStrategyRequest {
  stock_symbol: string;
  stock_name: string;
  name: string;
  strategy_type: 'SHORT' | 'MID' | 'LONG';
  builtin_strategy_ids: string[];
  custom_rules?: string;
  alert_enabled?: boolean;
  notes?: string;
}

export interface UpdateStrategyRequest {
  name?: string;
  strategy_type?: string;
  builtin_strategy_ids?: string[];
  custom_rules?: string;
  alert_enabled?: boolean;
  status?: string;
  notes?: string;
}

export interface StrategyAlert {
  id: string;
  strategy_id: string;
  stock_symbol: string;
  alert_type: 'BUY_SIGNAL' | 'SELL_SIGNAL';
  triggered_strategy: string | null;
  message: string;
  details: string | null;
  is_read: boolean;
  created_at: string;
}

export interface BacktestRequest {
  stock_symbol: string;
  builtin_strategy_ids: string[];
  custom_rules?: string;
  start_date?: string;
  end_date?: string;
  initial_capital?: number;
}

export interface BacktestTrade {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  pnl_pct: number;
  hold_days: number;
  strategy: string;
  entry_strategy?: string;
  quantity?: number;
  action_type?: string;
  trade_direction?: string;
  amount?: number;
  position_ratio?: number;
}

export interface BacktestKlineItem {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  signal: number;
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma60?: number;
}

export interface BacktestSummary {
  total_trades: number;
  win_rate: number;
  avg_return: number;
  total_return: number;
  max_drawdown: number;
  profit_factor: number;
  avg_win: number;
  avg_loss: number;
  total_wins: number;
  total_losses: number;
  final_capital: number;
  initial_capital: number;
}

export interface BacktestResult {
  summary: BacktestSummary;
  trades: BacktestTrade[];
  kline_data: BacktestKlineItem[];
  strategy_ids: string[];
}

export interface AlertsResponse {
  alerts: StrategyAlert[];
  total: number;
  limit: number;
  offset: number;
}

// ============ API 方法 ============

class TradingAPI {
  // 认证
  async login(data: { username: string; password: string }): Promise<AuthResponse> {
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/auth/login', data);
    return res.data.data!;
  }

  async register(data: { username: string; password: string; email: string }): Promise<AuthResponse> {
    const res = await apiClient.post<ApiResponse<AuthResponse>>('/auth/register', data);
    return res.data.data!;
  }

  async logout(): Promise<void> {
    await apiClient.post('/users/logout');
    await SecureStore.deleteItemAsync('auth_token');
  }

  async getProfile(): Promise<User> {
    const res = await apiClient.get<ApiResponse<User>>('/users/profile');
    return res.data.data!;
  }

  // AI 分析
  async getMarketOverview(): Promise<MarketOverview> {
    const res = await apiClient.get<ApiResponse<MarketOverview>>('/ai/market-overview');
    return res.data.data!;
  }

  async analyzeMarketTrend(symbols?: string[]): Promise<MarketAnalysis> {
    const res = await apiClient.post<ApiResponse<MarketAnalysis>>('/ai/market-trend', { symbols });
    return res.data.data!;
  }

  async analyzeStockOpportunity(symbol: string, userContext?: Record<string, any>): Promise<StockAnalysis> {
    const res = await apiClient.post<ApiResponse<StockAnalysis>>('/ai/stock-opportunity', { symbol, user_context: userContext });
    return res.data.data!;
  }

  async assessPortfolioRisk(portfolio: Record<string, number>): Promise<RiskAssessment> {
    const res = await apiClient.post<ApiResponse<RiskAssessment>>('/ai/risk-assessment', { portfolio });
    return res.data.data!;
  }

  async generateTradingAdvice(symbol: string, planContext?: Record<string, any>): Promise<TradingAdvice> {
    const res = await apiClient.post<ApiResponse<TradingAdvice>>('/ai/trading-advice', { symbol, plan_context: planContext });
    return res.data.data!;
  }

  async getStockQuote(symbol: string): Promise<StockQuote> {
    const res = await apiClient.get<ApiResponse<StockQuote>>(`/ai/stock/${symbol}/quote`);
    return res.data.data!;
  }

  async getStockHistory(symbol: string, period: string = '1mo'): Promise<StockHistoryResponse> {
    const res = await apiClient.get<ApiResponse<StockHistoryResponse>>(`/ai/stock/${symbol}/history?period=${period}`);
    return res.data.data!;
  }

  async getAnalysisHistory(limit: number = 10, offset: number = 0): Promise<any[]> {
    const res = await apiClient.get<ApiResponse<{ analyses: any[] }>>(`/ai/history?limit=${limit}&offset=${offset}`);
    return res.data.data!.analyses;
  }

  async healthCheck(): Promise<{ status: string }> {
    const res = await apiClient.get<ApiResponse<{ status: string }>>('/ai/health');
    return res.data.data!;
  }

  // 股票搜索
  async searchStocks(query: string, limit: number = 10): Promise<StockSearchResult[]> {
    const res = await apiClient.get<ApiResponse<StockSearchResult[]>>(`/ai/stocks/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return res.data.data!;
  }

  // 持仓管理
  async getPositions(account?: string): Promise<PositionItem[]> {
    const params = account ? `?account=${encodeURIComponent(account)}` : '';
    const res = await apiClient.get<ApiResponse<PositionItem[]>>(`/trading/positions${params}`);
    return res.data.data!;
  }

  async addPosition(data: AddPositionRequest): Promise<PositionItem> {
    const res = await apiClient.post<ApiResponse<PositionItem>>('/trading/positions', data);
    return res.data.data!;
  }

  async deletePosition(id: string): Promise<void> {
    await apiClient.delete(`/trading/positions/${id}`);
  }

  // 交易记录
  async recordTrade(data: RecordTradeRequest): Promise<TradeExecutionItem> {
    const res = await apiClient.post<ApiResponse<TradeExecutionItem>>('/trading/execute', data);
    return res.data.data!;
  }

  async getTradeHistory(limit: number = 20, offset: number = 0, account?: string): Promise<{ executions: TradeExecutionItem[]; total: number }> {
    let url = `/trading/history?limit=${limit}&offset=${offset}`;
    if (account) url += `&account=${encodeURIComponent(account)}`;
    const res = await apiClient.get<ApiResponse<{ executions: TradeExecutionItem[]; total: number }>>(url);
    return res.data.data!;
  }

  // 资金管理
  async getFund(account?: string): Promise<FundInfo> {
    const params = account ? `?account=${encodeURIComponent(account)}` : '';
    const res = await apiClient.get<ApiResponse<FundInfo>>(`/trading/fund${params}`);
    return res.data.data!;
  }

  async updateFund(data: UpdateFundRequest): Promise<FundInfo> {
    const res = await apiClient.put<ApiResponse<FundInfo>>('/trading/fund', data);
    return res.data.data!;
  }

  // 投资组合
  async getPortfolioSummary(account?: string): Promise<PortfolioSummary> {
    const params = account ? `?account=${encodeURIComponent(account)}` : '';
    const res = await apiClient.get<ApiResponse<PortfolioSummary>>(`/trading/portfolio${params}`);
    return res.data.data!;
  }

  // 批量行情
  async getBatchStockQuotes(symbols: string[]): Promise<Record<string, StockQuote>> {
    if (symbols.length === 0) return {};
    const results: Record<string, StockQuote> = {};
    const promises = symbols.map(async (symbol) => {
      try {
        const quote = await this.getStockQuote(symbol);
        results[symbol] = quote;
      } catch {}
    });
    await Promise.allSettled(promises);
    return results;
  }

  // 策略管理
  async getBuiltinStrategies(): Promise<BuiltinStrategy[]> {
    const res = await apiClient.get<ApiResponse<BuiltinStrategy[]>>('/trading/strategies/builtin');
    return res.data.data!;
  }

  async getStrategies(): Promise<TradingStrategy[]> {
    const res = await apiClient.get<ApiResponse<TradingStrategy[]>>('/trading/strategies');
    return res.data.data!;
  }

  async createStrategy(data: CreateStrategyRequest): Promise<TradingStrategy> {
    const res = await apiClient.post<ApiResponse<TradingStrategy>>('/trading/strategies', data);
    return res.data.data!;
  }

  async updateStrategy(id: string, data: UpdateStrategyRequest): Promise<TradingStrategy> {
    const res = await apiClient.put<ApiResponse<TradingStrategy>>(`/trading/strategies/${id}`, data);
    return res.data.data!;
  }

  async deleteStrategy(id: string): Promise<void> {
    await apiClient.delete(`/trading/strategies/${id}`);
  }

  // 策略提醒
  async getAlerts(unreadOnly: boolean = false, limit: number = 20, offset: number = 0): Promise<AlertsResponse> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (unreadOnly) params.set('unread_only', 'true');
    const res = await apiClient.get<ApiResponse<AlertsResponse>>(`/trading/strategy-alerts?${params}`);
    return res.data.data!;
  }

  async markAlertRead(id: string): Promise<void> {
    await apiClient.put(`/trading/strategy-alerts/${id}/read`);
  }

  async markAllAlertsRead(): Promise<void> {
    await apiClient.put('/trading/strategy-alerts/read-all');
  }

  async getUnreadAlertCount(): Promise<number> {
    const res = await apiClient.get<ApiResponse<{ count: number }>>('/trading/strategy-alerts/unread-count');
    return res.data.data!.count;
  }

  // 回测
  async runBacktest(data: BacktestRequest): Promise<BacktestResult> {
    const res = await apiClient.post<{ success: boolean; data: BacktestResult }>('/trading/backtest', data);
    return res.data.data;
  }
}

export const api = new TradingAPI();
export default api;
