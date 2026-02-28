# AI交易执行助手

一个基于Go+Python混合架构的AI驱动股票交易执行助手，帮助投资者制定和严格执行交易计划，减少情绪化交易。

## 🚀 项目特色

- **AI智能分析**：市场热点识别、买卖点判断、风险评估
- **交易纪律管理**：计划制定、执行跟踪、情绪控制
- **实时提醒系统**：价格监控、条件触发、多渠道通知
- **高效复盘工具**：AI驱动的模式识别和改进建议
- **PWA支持**：离线使用、推送通知、移动端优化

## 🏗️ 技术架构

### 前端 (React + PWA)
- React 18 + TypeScript
- shadcn/ui + Tailwind CSS
- Zustand + React Query
- PWA + Service Worker

### 后端 (Go + Python 微服务)
- **Go服务**：API网关、认证、WebSocket、数据库操作
- **Python服务**：AI分析、数据处理、机器学习
- **数据库**：PostgreSQL + Redis
- **通信**：HTTP API + 消息队列

## 📁 项目结构

```
trading-assistant/
├── frontend/           # React PWA前端应用
├── go-service/         # Go主服务
├── python-service/     # Python AI服务
├── shared/            # 共享配置和文档
└── docs/              # 项目文档
```

## 🛠️ 开发环境

### 前端
```bash
cd frontend
npm install
npm run dev
```

### Go服务
```bash
cd go-service
go mod tidy
go run cmd/server/main.go
```

### Python服务
```bash
cd python-service
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## 📱 渐进式移动端扩展

1. **阶段1**：响应式Web + PWA（当前）
2. **阶段2**：React Native扩展
3. **阶段3**：原生App（可选）

## 🎯 核心功能

- 交易计划管理
- AI智能分析
- 实时提醒系统
- 风险控制工具
- 复盘分析功能

## 📄 许可证

MIT License