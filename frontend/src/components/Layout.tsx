import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger 
} from '@/components/ui/sheet'
import { useAuthStore } from '@/stores/authStore'
import { useToast } from '@/hooks/use-toast'
import { 
  BarChart3, 
  Brain, 
  Menu, 
  LogOut, 
  User, 
  Settings,
  TrendingUp,
  Shield,
  Bell,
  Home
} from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user, logout } = useAuthStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await logout()
      toast({
        title: '已退出登录',
        description: '感谢使用AI交易助手',
      })
      navigate('/login')
    } catch (error) {
      toast({
        title: '退出失败',
        description: '请稍后重试',
        variant: 'destructive',
      })
    }
  }

  const navigationItems = [
    {
      name: '仪表板',
      href: '/dashboard',
      icon: Home,
      description: '总览和快速操作'
    },
    {
      name: 'AI分析',
      href: '/ai-analysis',
      icon: Brain,
      description: '智能市场分析'
    },
    {
      name: '交易计划',
      href: '/trading-plans',
      icon: TrendingUp,
      description: '制定和管理交易计划'
    },
    {
      name: '风险控制',
      href: '/risk-management',
      icon: Shield,
      description: '投资组合风险管理'
    },
    {
      name: '智能提醒',
      href: '/alerts',
      icon: Bell,
      description: '价格和事件提醒'
    },
  ]

  const isActiveRoute = (href: string) => {
    return location.pathname === href
  }

  const NavigationContent = () => (
    <nav className="space-y-2">
      {navigationItems.map((item) => {
        const Icon = item.icon
        const isActive = isActiveRoute(item.href)
        
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5" />
            <div>
              <div className="font-medium">{item.name}</div>
              <div className="text-xs opacity-75">{item.description}</div>
            </div>
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-slate-900 flex">
      {/* 桌面端侧边栏 */}
      <aside className="hidden lg:flex lg:flex-col lg:w-80 bg-slate-800 border-r border-slate-700">
        {/* Logo区域 */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AI交易助手</h1>
              <p className="text-sm text-slate-400">智能投资决策平台</p>
            </div>
          </div>
        </div>

        {/* 导航菜单 */}
        <div className="flex-1 p-6">
          <NavigationContent />
        </div>

        {/* 用户信息区域 */}
        <div className="p-6 border-t border-slate-700">
          <div className="flex items-center space-x-3 mb-4">
            <Avatar>
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-blue-600 text-white">
                {user?.username?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium text-white">{user?.username}</p>
              <p className="text-sm text-slate-400">{user?.email}</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <User className="w-4 h-4 mr-2" />
              个人资料
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <Settings className="w-4 h-4 mr-2" />
              设置
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </Button>
          </div>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className="flex-1 flex flex-col">
        {/* 移动端顶部导航 */}
        <header className="lg:hidden bg-slate-800 border-b border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-lg font-bold text-white">AI交易助手</h1>
            </div>
            
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="border-slate-600">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 bg-slate-800 border-slate-700">
                <SheetHeader>
                  <SheetTitle className="text-white">导航菜单</SheetTitle>
                  <SheetDescription className="text-slate-400">
                    选择要访问的功能模块
                  </SheetDescription>
                </SheetHeader>
                
                <div className="mt-6">
                  <NavigationContent />
                </div>

                {/* 移动端用户信息 */}
                <div className="mt-8 pt-6 border-t border-slate-700">
                  <div className="flex items-center space-x-3 mb-4">
                    <Avatar>
                      <AvatarImage src={user?.avatar} />
                      <AvatarFallback className="bg-blue-600 text-white">
                        {user?.username?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-white">{user?.username}</p>
                      <p className="text-sm text-slate-400">{user?.email}</p>
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLogout}
                    className="w-full justify-start border-red-600 text-red-400 hover:bg-red-600 hover:text-white"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    退出登录
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* 页面内容 */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  )
}