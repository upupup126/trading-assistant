import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'http://45.40.228.140:8080/api/v1';

const apiClient = axios.create({
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

export const api = {
  // Auth
  login: (data: { username: string; password: string }) =>
    apiClient.post('/auth/login', data),
  register: (data: { username: string; password: string; email: string }) =>
    apiClient.post('/auth/register', data),
  logout: () => apiClient.post('/users/logout'),
  getProfile: () => apiClient.get('/users/profile'),

  // AI Analysis
  getMarketOverview: () => apiClient.get('/ai/market-overview'),
  analyzeMarketTrend: (symbols: string[]) =>
    apiClient.post('/ai/market-trend', { symbols }),
  analyzeStockOpportunity: (symbol: string, userContext?: object) =>
    apiClient.post('/ai/stock-opportunity', { symbol, user_context: userContext }),
  assessPortfolioRisk: (portfolio: Record<string, number>) =>
    apiClient.post('/ai/risk-assessment', { portfolio }),
  generateTradingAdvice: (symbol: string, planContext?: object) =>
    apiClient.post('/ai/trading-advice', { symbol, plan_context: planContext }),
  getStockQuote: (symbol: string) =>
    apiClient.get(`/ai/stock/${symbol}/quote`),
  getAnalysisHistory: (limit = 10, offset = 0) =>
    apiClient.get(`/ai/history?limit=${limit}&offset=${offset}`),
  healthCheck: () => apiClient.get('/ai/health'),
};

export default api;
