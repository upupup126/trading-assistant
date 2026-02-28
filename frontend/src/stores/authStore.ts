import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api, User, LoginRequest, RegisterRequest } from '@/lib/api'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AuthActions {
  login: (credentials: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  getProfile: () => Promise<void>
  clearError: () => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // 状态
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // 操作
      login: async (credentials: LoginRequest) => {
        try {
          set({ isLoading: true, error: null })
          
          const response = await api.login(credentials)
          
          // 保存token到localStorage
          const accessToken = response.tokens.access_token
          localStorage.setItem('auth_token', accessToken)
          
          set({
            user: response.user,
            token: accessToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error: any) {
          const rawError = error.response?.data?.error
          const errorMessage = typeof rawError === 'string' ? rawError : rawError?.message || '登录失败'
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          })
          throw error
        }
      },

      register: async (data: RegisterRequest) => {
        try {
          set({ isLoading: true, error: null })
          
          const response = await api.register(data)
          
          // 保存token到localStorage
          const accessToken = response.tokens.access_token
          localStorage.setItem('auth_token', accessToken)
          
          set({
            user: response.user,
            token: accessToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })
        } catch (error: any) {
          const rawError = error.response?.data?.error
          const errorMessage = typeof rawError === 'string' ? rawError : rawError?.message || '注册失败'
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
          })
          throw error
        }
      },

      logout: async () => {
        try {
          await api.logout()
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          // 清除本地存储
          localStorage.removeItem('auth_token')
          
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          })
        }
      },

      getProfile: async () => {
        try {
          set({ isLoading: true, error: null })
          
          const user = await api.getProfile()
          
          set({
            user,
            isLoading: false,
            error: null,
          })
        } catch (error: any) {
          const errorMessage = error.response?.data?.error || '获取用户信息失败'
          set({
            isLoading: false,
            error: errorMessage,
          })
          
          // 如果是认证错误，清除登录状态
          if (error.response?.status === 401) {
            get().logout()
          }
        }
      },

      clearError: () => {
        set({ error: null })
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading })
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)