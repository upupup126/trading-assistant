import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toaster'
import { useAuthStore } from '@/stores/authStore'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Dashboard from '@/pages/Dashboard'
import AIAnalysis from '@/pages/AIAnalysis'
import TradingPlans from '@/pages/TradingPlans'
import RiskManagement from '@/pages/RiskManagement'
import Alerts from '@/pages/Alerts'
import Layout from '@/components/Layout'

// 创建React Query客户端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// 受保护的路由组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token } = useAuthStore()
  
  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

// 公开路由组件（已登录用户重定向到仪表板）
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token } = useAuthStore()
  
  if (isAuthenticated && token) {
    return <Navigate to="/dashboard" replace />
  }
  
  return <>{children}</>
}

function App() {
  const { token, getProfile } = useAuthStore()

  useEffect(() => {
    // 如果有token，尝试获取用户信息
    if (token) {
      getProfile().catch(() => {
        // 如果获取用户信息失败，可能token已过期
        console.log('Token may be expired, user will be redirected to login')
      })
    }
  }, [token, getProfile])

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <Routes>
            {/* 公开路由 */}
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />

            <Route 
              path="/register" 
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              } 
            />
            
            {/* 受保护的路由 */}
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <Dashboard />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            
            <Route 
              path="/ai-analysis" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <AIAnalysis />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/trading-plans" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <TradingPlans />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/risk-management" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <RiskManagement />
                  </Layout>
                </ProtectedRoute>
              } 
            />

            <Route 
              path="/alerts" 
              element={
                <ProtectedRoute>
                  <Layout>
                    <Alerts />
                  </Layout>
                </ProtectedRoute>
              } 
            />
            
            {/* 默认重定向 */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* 404页面 */}
            <Route 
              path="*" 
              element={
                <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                  <div className="text-center">
                    <h1 className="text-4xl font-bold text-white mb-4">404</h1>
                    <p className="text-slate-400 mb-8">页面未找到</p>
                    <a 
                      href="/dashboard" 
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
                    >
                      返回首页
                    </a>
                  </div>
                </div>
              } 
            />
          </Routes>
          
          {/* 全局Toast通知 */}
          <Toaster />
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App