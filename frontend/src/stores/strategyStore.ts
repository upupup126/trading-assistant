import { create } from 'zustand'
import {
  api,
  BuiltinStrategy,
  TradingStrategy,
  StrategyAlert,
  BacktestResult,
  CreateStrategyRequest,
  UpdateStrategyRequest,
  BacktestRequest,
  AlertMute,
} from '@/lib/api'

interface StrategyState {
  builtinStrategies: BuiltinStrategy[]
  strategies: TradingStrategy[]
  alerts: StrategyAlert[]
  alertsTotal: number
  unreadAlertCount: number
  backtestResult: BacktestResult | null
  mutedAlerts: AlertMute[]

  isLoading: boolean
  loadingStates: Record<string, boolean>
  error: string | null
}

interface StrategyActions {
  fetchBuiltinStrategies: () => Promise<void>
  fetchStrategies: () => Promise<void>
  createStrategy: (data: CreateStrategyRequest) => Promise<TradingStrategy>
  updateStrategy: (id: string, data: UpdateStrategyRequest) => Promise<TradingStrategy>
  deleteStrategy: (id: string) => Promise<void>

  fetchAlerts: (unreadOnly?: boolean, limit?: number, offset?: number) => Promise<void>
  markAlertRead: (id: string) => Promise<void>
  markAllAlertsRead: () => Promise<void>
  fetchUnreadAlertCount: () => Promise<void>

  muteAlert: (stockSymbol: string, alertType: string) => Promise<void>
  unmuteAlert: (stockSymbol: string, alertType: string) => Promise<void>
  fetchMutedAlerts: () => Promise<void>

  runBacktest: (data: BacktestRequest) => Promise<BacktestResult>
  clearBacktestResult: () => void

  setLoading: (key: string, loading: boolean) => void
  clearError: () => void
}

export const useStrategyStore = create<StrategyState & StrategyActions>((set, get) => ({
  builtinStrategies: [],
  strategies: [],
  alerts: [],
  alertsTotal: 0,
  unreadAlertCount: 0,
  backtestResult: null,
  mutedAlerts: [],
  isLoading: false,
  loadingStates: {},
  error: null,

  fetchBuiltinStrategies: async () => {
    try {
      get().setLoading('builtin', true)
      const data = await api.getBuiltinStrategies()
      set({ builtinStrategies: data })
    } catch (error: any) {
      set({ error: error.response?.data?.error?.message || '获取内置策略失败' })
    } finally {
      get().setLoading('builtin', false)
    }
  },

  fetchStrategies: async () => {
    try {
      get().setLoading('strategies', true)
      const data = await api.getStrategies()
      set({ strategies: data })
    } catch (error: any) {
      set({ error: error.response?.data?.error?.message || '获取策略列表失败' })
    } finally {
      get().setLoading('strategies', false)
    }
  },

  createStrategy: async (data: CreateStrategyRequest) => {
    try {
      get().setLoading('createStrategy', true)
      const strategy = await api.createStrategy(data)
      set(state => ({ strategies: [...state.strategies, strategy] }))
      return strategy
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || '创建策略失败'
      set({ error: msg })
      throw new Error(msg)
    } finally {
      get().setLoading('createStrategy', false)
    }
  },

  updateStrategy: async (id: string, data: UpdateStrategyRequest) => {
    try {
      get().setLoading('updateStrategy', true)
      const strategy = await api.updateStrategy(id, data)
      set(state => ({
        strategies: state.strategies.map(s => s.id === id ? strategy : s),
      }))
      return strategy
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || '更新策略失败'
      set({ error: msg })
      throw new Error(msg)
    } finally {
      get().setLoading('updateStrategy', false)
    }
  },

  deleteStrategy: async (id: string) => {
    try {
      get().setLoading('deleteStrategy', true)
      await api.deleteStrategy(id)
      set(state => ({
        strategies: state.strategies.filter(s => s.id !== id),
      }))
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || '删除策略失败'
      set({ error: msg })
      throw new Error(msg)
    } finally {
      get().setLoading('deleteStrategy', false)
    }
  },

  fetchAlerts: async (unreadOnly = false, limit = 20, offset = 0) => {
    try {
      get().setLoading('alerts', true)
      const data = await api.getAlerts(unreadOnly, limit, offset)
      set({ alerts: data.alerts, alertsTotal: data.total })
    } catch (error: any) {
      set({ error: error.response?.data?.error?.message || '获取提醒失败' })
    } finally {
      get().setLoading('alerts', false)
    }
  },

  markAlertRead: async (id: string) => {
    try {
      await api.markAlertRead(id)
      set(state => ({
        alerts: state.alerts.map(a => a.id === id ? { ...a, is_read: true } : a),
        unreadAlertCount: Math.max(0, state.unreadAlertCount - 1),
      }))
    } catch (error: any) {
      set({ error: error.response?.data?.error?.message || '标记已读失败' })
    }
  },

  markAllAlertsRead: async () => {
    try {
      await api.markAllAlertsRead()
      set(state => ({
        alerts: state.alerts.map(a => ({ ...a, is_read: true })),
        unreadAlertCount: 0,
      }))
    } catch (error: any) {
      set({ error: error.response?.data?.error?.message || '全部标记已读失败' })
    }
  },

  fetchUnreadAlertCount: async () => {
    try {
      const count = await api.getUnreadAlertCount()
      set({ unreadAlertCount: count })
    } catch {
      // silent
    }
  },

  muteAlert: async (stockSymbol: string, alertType: string) => {
    try {
      await api.muteAlert(stockSymbol, alertType)
      const mutes = await api.getMutedAlerts()
      set({ mutedAlerts: mutes || [] })
    } catch (error: any) {
      set({ error: error.response?.data?.error?.message || '静音失败' })
    }
  },

  unmuteAlert: async (stockSymbol: string, alertType: string) => {
    try {
      await api.unmuteAlert(stockSymbol, alertType)
      set(state => ({
        mutedAlerts: state.mutedAlerts.filter(
          m => !(m.stock_symbol === stockSymbol && m.alert_type === alertType)
        ),
      }))
    } catch (error: any) {
      set({ error: error.response?.data?.error?.message || '取消静音失败' })
    }
  },

  fetchMutedAlerts: async () => {
    try {
      const mutes = await api.getMutedAlerts()
      set({ mutedAlerts: mutes || [] })
    } catch {
      // silent
    }
  },

  runBacktest: async (data: BacktestRequest) => {
    try {
      get().setLoading('backtest', true)
      set({ backtestResult: null })
      const result = await api.runBacktest(data)
      set({ backtestResult: result })
      return result
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || '回测执行失败'
      set({ error: msg })
      throw new Error(msg)
    } finally {
      get().setLoading('backtest', false)
    }
  },

  clearBacktestResult: () => set({ backtestResult: null }),

  setLoading: (key: string, loading: boolean) => {
    set(state => ({
      loadingStates: { ...state.loadingStates, [key]: loading },
      isLoading: loading,
    }))
  },

  clearError: () => set({ error: null }),
}))
