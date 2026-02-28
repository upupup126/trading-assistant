# Trading Assistant - Python AI Service

AI驱动的股票交易分析服务，提供市场分析、个股分析、风险评估和交易建议等功能。

## 功能特性

- 🤖 **AI智能分析**: 基于大语言模型的市场和个股分析
- 📊 **市场数据**: 实时股票行情和历史数据获取
- 🎯 **风险评估**: 投资组合风险分析和建议
- 💡 **交易建议**: 基于AI的个性化交易策略推荐
- 🔍 **股票搜索**: 智能股票代码和名称搜索
- 📈 **技术指标**: 专业的技术分析和指标计算

## 快速开始

### 1. 环境准备

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 环境配置

创建 `.env` 文件：

```env
# AI服务配置
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-3.5-turbo

# 服务配置
HOST=0.0.0.0
PORT=8001
DEBUG=true
LOG_LEVEL=INFO

# 数据库配置（可选）
DATABASE_URL=postgresql://user:password@localhost/trading_db
REDIS_URL=redis://localhost:6379

# CORS配置
CORS_ORIGINS=["http://localhost:3000", "http://localhost:5173"]
```

### 3. 启动服务

```bash
# 方式1: 使用启动脚本
python start.py

# 方式2: 直接使用uvicorn
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# 方式3: 使用Python模块
python -m app.main
```

### 4. 访问API文档

服务启动后，访问以下地址查看API文档：

- Swagger UI: http://localhost:8001/docs
- ReDoc: http://localhost:8001/redoc

## API 接口

### AI分析接口

#### 1. 市场趋势分析
```http
POST /api/ai/market-trend
Content-Type: application/json

{
  "symbols": ["000001.SZ", "399001.SZ"],
  "analysis_type": "comprehensive"
}
```

#### 2. 个股机会分析
```http
POST /api/ai/stock-opportunity
Content-Type: application/json

{
  "symbol": "000001.SZ",
  "user_context": {
    "risk_tolerance": "中等",
    "investment_horizon": "中期"
  }
}
```

#### 3. 风险评估
```http
POST /api/ai/risk-assessment
Content-Type: application/json

{
  "portfolio": {
    "000001.SZ": 50000,
    "600036.SH": 30000,
    "000858.SZ": 20000
  }
}
```

#### 4. 交易建议
```http
POST /api/ai/trading-advice
Content-Type: application/json

{
  "symbol": "000001.SZ",
  "plan_context": {
    "plan_type": "BUY",
    "target_price": 12.50,
    "current_price": 12.00
  }
}
```

### 市场数据接口

#### 1. 市场概览
```http
GET /api/ai/market-overview
```

#### 2. 股票实时行情
```http
GET /api/ai/stock/000001.SZ/quote
```

#### 3. 历史数据
```http
GET /api/ai/stock/000001.SZ/history?period=1mo
```

#### 4. 股票搜索
```http
GET /api/ai/stocks/search?q=平安银行&limit=10
```

## 服务架构

```
python-service/
├── app/
│   ├── api/                    # API路由
│   │   ├── health.py          # 健康检查
│   │   ├── analysis.py        # 原有分析API
│   │   └── ai_analysis.py     # 新AI分析API
│   ├── services/              # 业务服务
│   │   ├── ai_analyst.py      # AI分析服务
│   │   └── market_data.py     # 市场数据服务
│   ├── models/                # 数据模型
│   ├── config.py              # 配置管理
│   └── main.py                # 应用入口
├── requirements.txt           # 依赖包
├── start.py                   # 启动脚本
└── README.md                  # 说明文档
```

## 核心服务

### AIAnalystService
- 市场趋势分析
- 个股投资机会评估
- 投资组合风险分析
- 交易策略建议生成

### MarketDataService
- 实时股票行情获取
- 历史数据查询
- 市场概览统计
- 股票搜索功能

## 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI API密钥 | 必填 |
| `OPENAI_BASE_URL` | OpenAI API地址 | https://api.openai.com/v1 |
| `OPENAI_MODEL` | 使用的模型 | gpt-3.5-turbo |
| `HOST` | 服务监听地址 | 0.0.0.0 |
| `PORT` | 服务端口 | 8001 |
| `DEBUG` | 调试模式 | false |
| `LOG_LEVEL` | 日志级别 | INFO |

### AI模型配置

支持多种AI模型：
- OpenAI GPT系列 (gpt-3.5-turbo, gpt-4)
- 腾讯混元 (通过兼容的API接口)
- 其他兼容OpenAI API的模型

## 开发指南

### 添加新的分析功能

1. 在 `AIAnalystService` 中添加新方法
2. 在 `ai_analysis.py` 中添加对应的API端点
3. 更新数据模型和请求/响应格式

### 集成新的数据源

1. 在 `MarketDataService` 中添加数据获取方法
2. 实现数据格式标准化
3. 添加缓存和错误处理

### 性能优化

- 使用Redis缓存AI分析结果
- 实现异步数据获取
- 添加请求限流和熔断机制

## 部署

### Docker部署

```bash
# 构建镜像
docker build -t trading-ai-service .

# 运行容器
docker run -d \
  --name trading-ai \
  -p 8001:8001 \
  -e OPENAI_API_KEY=your_key \
  trading-ai-service
```

### 生产环境

- 使用Gunicorn作为WSGI服务器
- 配置Nginx反向代理
- 设置日志轮转和监控
- 使用Redis集群和数据库连接池

## 故障排除

### 常见问题

1. **AI分析失败**
   - 检查OpenAI API密钥是否正确
   - 确认网络连接正常
   - 查看API配额和限制

2. **市场数据获取失败**
   - 检查yfinance库是否正常工作
   - 确认股票代码格式正确
   - 查看网络连接和防火墙设置

3. **服务启动失败**
   - 检查端口是否被占用
   - 确认所有依赖包已安装
   - 查看日志文件获取详细错误信息

### 日志查看

```bash
# 查看应用日志
tail -f app.log

# 查看特定级别日志
grep ERROR app.log
```

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交代码更改
4. 创建Pull Request

## 许可证

MIT License