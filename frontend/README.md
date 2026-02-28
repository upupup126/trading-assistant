# Trading Assistant Frontend

AI驱动的股票交易助手前端应用，基于React + TypeScript + Vite构建。

## 功能特性

- 🎨 **现代化UI设计**: 使用shadcn/ui组件库，深色主题，金融科技风格
- 📱 **响应式设计**: 支持桌面端和移动端，PWA支持
- 🤖 **AI智能分析**: 市场趋势分析、个股机会评估、风险评估、交易建议
- 📊 **实时数据展示**: 市场概览、股票行情、指数数据
- 🔐 **用户认证**: JWT认证，安全的用户会话管理
- 🚀 **高性能**: Vite构建，React Query数据管理，Zustand状态管理

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite 5
- **UI组件**: shadcn/ui + Tailwind CSS
- **状态管理**: Zustand
- **数据获取**: TanStack Query (React Query)
- **路由**: React Router v6
- **图表**: Recharts
- **PWA**: Vite PWA Plugin

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 环境配置

复制环境变量文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置API地址：

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

### 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 启动。

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 项目结构

```
src/
├── components/          # 可复用组件
│   ├── ui/             # shadcn/ui组件
│   └── Layout.tsx      # 布局组件
├── pages/              # 页面组件
│   ├── Login.tsx       # 登录页面
│   ├── Dashboard.tsx   # 仪表板
│   └── AIAnalysis.tsx  # AI分析页面
├── stores/             # Zustand状态管理
│   ├── authStore.ts    # 认证状态
│   └── aiStore.ts      # AI分析状态
├── lib/                # 工具库
│   ├── api.ts          # API客户端
│   └── utils.ts        # 工具函数
├── hooks/              # 自定义Hook
└── types/              # TypeScript类型定义
```

## 核心功能

### 用户认证

- JWT token认证
- 自动token刷新
- 受保护的路由

### AI分析功能

1. **市场趋势分析**
   - 整体市场情绪分析
   - 热点板块识别
   - 关键市场洞察

2. **个股机会分析**
   - 投资建议（买入/卖出/持有）
   - 目标价格预测
   - 支撑位和阻力位
   - 利好和风险因素

3. **风险评估**
   - 投资组合风险等级
   - 分散化评分
   - 行业集中度分析
   - 风险管理建议

4. **交易建议**
   - 个性化交易策略
   - 入场价格建议
   - 止损止盈设置
   - 仓位管理建议

### 响应式设计

- 移动端优先设计
- 桌面端侧边栏导航
- 移动端抽屉式菜单
- 触摸友好的交互

## API集成

前端通过HTTP API与Go后端服务通信：

```typescript
// API客户端配置
const apiClient = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  timeout: 30000,
})

// 自动添加认证头
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

## 状态管理

使用Zustand进行状态管理，支持持久化：

```typescript
// 认证状态
const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: async (credentials) => { /* ... */ },
      logout: async () => { /* ... */ },
    }),
    { name: 'auth-storage' }
  )
)
```

## 样式系统

使用Tailwind CSS + shadcn/ui组件：

```css
/* 金融科技风格的自定义样式 */
.trading-card {
  background: linear-gradient(145deg, #1f2937, #374151);
  border: 1px solid rgba(59, 130, 246, 0.3);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.glass-effect {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

## PWA支持

应用支持PWA功能：

- 离线缓存
- 桌面安装
- 推送通知
- 后台同步

## 开发指南

### 添加新页面

1. 在 `src/pages/` 创建页面组件
2. 在 `App.tsx` 添加路由
3. 在 `Layout.tsx` 添加导航项

### 添加新的API接口

1. 在 `src/lib/api.ts` 添加接口方法
2. 在对应的store中添加状态管理
3. 在组件中使用

### 自定义组件

使用shadcn/ui添加组件：

```bash
npx shadcn@latest add [component-name]
```

## 部署

### Docker部署

```dockerfile
FROM node:18-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 静态部署

构建后的文件在 `dist/` 目录，可以部署到任何静态文件服务器。

## 故障排除

### 常见问题

1. **API连接失败**
   - 检查 `.env` 文件中的API地址
   - 确认后端服务已启动
   - 检查CORS配置

2. **认证失败**
   - 清除浏览器localStorage
   - 检查JWT token有效期
   - 确认后端认证服务正常

3. **组件样式问题**
   - 确认Tailwind CSS配置正确
   - 检查shadcn/ui组件是否正确安装
   - 验证CSS变量定义

### 调试技巧

```bash
# 查看详细的构建信息
npm run build -- --debug

# 分析包大小
npm run build -- --analyze

# 检查类型错误
npm run type-check
```

## 贡献指南

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 许可证

MIT License