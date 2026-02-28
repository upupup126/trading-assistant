import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/hooks/use-toast'
import { Eye, EyeOff, TrendingUp } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { login, isLoading, error, clearError } = useAuthStore()
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (error) clearError()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.username || !formData.password) {
      toast({
        title: '输入错误',
        description: '请填写用户名和密码',
        variant: 'destructive',
      })
      return
    }

    try {
      await login(formData)
      toast({
        title: '登录成功',
        description: '欢迎回到AI交易助手',
      })
      navigate('/dashboard')
    } catch (error) {
      toast({
        title: '登录失败',
        description: '用户名或密码错误',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo和标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AI交易助手</h1>
          <p className="text-blue-200">智能分析 · 精准决策 · 风险控制</p>
        </div>

        {/* 登录表单 */}
        <Card className="glass-effect border-blue-500/30">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-white">登录账户</CardTitle>
            <CardDescription className="text-center text-blue-200">
              输入您的账户信息以访问交易助手
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white">用户名</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="请输入用户名"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">密码</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400 focus:border-blue-500 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? '登录中...' : '登录'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-slate-400">
                还没有账户？{' '}
                <Link to="/register" className="text-blue-400 hover:text-blue-300 underline">
                  立即注册
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 功能特色 */}
        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="text-blue-200">
            <div className="text-2xl mb-1">🤖</div>
            <div className="text-xs">AI智能分析</div>
          </div>
          <div className="text-blue-200">
            <div className="text-2xl mb-1">📊</div>
            <div className="text-xs">实时数据</div>
          </div>
          <div className="text-blue-200">
            <div className="text-2xl mb-1">🛡️</div>
            <div className="text-xs">风险控制</div>
          </div>
        </div>
      </div>
    </div>
  )
}