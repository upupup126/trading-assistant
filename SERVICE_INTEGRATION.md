# 服务集成文档

## 架构概览

Trading Assistant 采用Go+Python混合微服务架构：

- **Go服务** (端口8080): API网关、认证、WebSocket、数据库操作
- **Python服务** (端口8001): AI分析、市场数据、机器学习

## 服务通信

### HTTP API通信

Go服务通过HTTP客户端调用Python服务的REST API：

```
Go Service (8080) ──HTTP──> Python Service (8001)
      │                           │
      ├── 用户认证                 ├── AI分析
      ├── 数据存储                 ├── 市场数据
      ├── WebSocket               ├── 风险评估
      └── 业务逻辑                 └── 交易建议
```

### 数据流

1. **用户请求** → Go服务 (认证、权限检查)
2. **AI分析请求** → Python服务 (AI处理)
3. **分析结果** → Go服务 (数据存储)
4. **响应返回** → 用户

## API接口映射

### Go服务对外API

| 端点 | 方法 | 说明 | 对应Python API |
|------|------|------|----------------|
| `/api/v1/ai/market-trend` | POST | 市场趋势分析 | `/api/ai/market-trend` |
| `/api/v1/ai/stock-opportunity` | POST | 个股机会分析 | `/api/ai/stock-opportunity` |
| `/api/v1/ai/risk-assessment` | POST | 风险评估 | `/api/ai/risk-assessment` |
| `/api/v1/ai/trading-advice` | POST | 交易建议 | `/api/ai/trading-advice` |
| `/api/v1/ai/market-overview` | GET | 市场概览 | `/api/ai/market-overview` |
| `/api/v1/ai/stock/:symbol/quote` | GET | 股票行情 | `/api/ai/stock/:symbol/quote` |

### 认证和权限

- Go服务负责JWT认证和用户权限管理
- Python服务接收已认证的请求，专注于AI处理
- 用户ID通过请求头传递给Python服务

## 配置管理

### Go服务配置 (.env)

```env
# Python服务地址
PYTHON_SERVICE_URL=http://localhost:8001
AI_TIMEOUT=30s

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=trading_user
DB_PASSWORD=trading_password
DB_NAME=trading_assistant

# JWT配置
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
```

### Python服务配置 (.env)

```env
# AI配置
OPENAI_API_KEY=your_openai_key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-3.5-turbo

# 服务配置
HOST=0.0.0.0
PORT=8001
DEBUG=true
```

## 启动顺序

1. **启动PostgreSQL和Redis**
   ```bash
   docker-compose up -d postgres redis
   ```

2. **启动Python AI服务**
   ```bash
   cd python-service
   python start.py
   ```

3. **启动Go主服务**
   ```bash
   cd go-service
   go run cmd/server/main.go
   ```

## 健康检查

### 服务状态检查

```bash
# Go服务健康检查
curl http://localhost:8080/health

# Python服务健康检查
curl http://localhost:8001/api/ai/health

# AI服务连通性检查
curl -H "Authorization: Bearer <token>" \
     http://localhost:8080/api/v1/ai/health
```

### 监控指标

- **响应时间**: Go→Python API调用延迟
- **成功率**: AI分析请求成功率
- **错误率**: 服务间通信错误率
- **资源使用**: CPU、内存、网络使用情况

## 错误处理

### 网络错误

```go
// Go服务中的错误处理
if err := aiClient.AnalyzeMarketTrend(ctx, req); err != nil {
    if isNetworkError(err) {
        // 记录错误，返回缓存结果或默认响应
        return fallbackResponse, nil
    }
    return nil, err
}
```

### 超时处理

```go
// 设置请求超时
ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
defer cancel()

result, err := aiClient.AnalyzeStock(ctx, request)
```

### 重试机制

```go
// 实现指数退避重试
for i := 0; i < maxRetries; i++ {
    if result, err := aiClient.Call(ctx, req); err == nil {
        return result, nil
    }
    time.Sleep(time.Duration(math.Pow(2, float64(i))) * time.Second)
}
```

## 性能优化

### 缓存策略

1. **Go服务缓存**
   - Redis缓存AI分析结果
   - 用户会话缓存
   - 股票基础信息缓存

2. **Python服务缓存**
   - 内存缓存AI分析结果
   - 市场数据缓存
   - 模型预测结果缓存

### 连接池

```go
// HTTP客户端连接池配置
client := &http.Client{
    Transport: &http.Transport{
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 10,
        IdleConnTimeout:     90 * time.Second,
    },
    Timeout: 30 * time.Second,
}
```

### 异步处理

```go
// 异步AI分析
go func() {
    result, err := aiService.AnalyzeMarket(ctx, symbols)
    if err != nil {
        log.Printf("Async analysis failed: %v", err)
        return
    }
    // 通过WebSocket推送结果
    wsHub.Broadcast(userID, result)
}()
```

## 部署配置

### Docker Compose

```yaml
version: '3.8'
services:
  go-service:
    build: ./go-service
    ports:
      - "8080:8080"
    environment:
      - PYTHON_SERVICE_URL=http://python-service:8001
    depends_on:
      - postgres
      - redis
      - python-service

  python-service:
    build: ./python-service
    ports:
      - "8001:8001"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: go-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: go-service
  template:
    spec:
      containers:
      - name: go-service
        image: trading-assistant/go-service:latest
        env:
        - name: PYTHON_SERVICE_URL
          value: "http://python-service:8001"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: python-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: python-service
  template:
    spec:
      containers:
      - name: python-service
        image: trading-assistant/python-service:latest
```

## 故障排除

### 常见问题

1. **连接超时**
   - 检查网络连通性
   - 验证服务端口是否正确
   - 确认防火墙设置

2. **认证失败**
   - 检查JWT密钥配置
   - 验证token格式和有效期
   - 确认用户权限设置

3. **AI分析失败**
   - 检查OpenAI API密钥
   - 验证网络连接
   - 查看Python服务日志

### 日志分析

```bash
# Go服务日志
tail -f go-service/logs/app.log | grep ERROR

# Python服务日志
tail -f python-service/app.log | grep ERROR

# 服务间通信日志
grep "AI_CLIENT" go-service/logs/app.log
```

## 扩展性考虑

### 水平扩展

- Go服务: 无状态设计，支持多实例部署
- Python服务: AI计算密集型，可独立扩展
- 数据库: 读写分离，主从复制

### 负载均衡

```nginx
upstream go-service {
    server go-service-1:8080;
    server go-service-2:8080;
    server go-service-3:8080;
}

upstream python-service {
    server python-service-1:8001;
    server python-service-2:8001;
}
```

### 服务发现

使用Consul或etcd实现服务注册和发现：

```go
// 服务注册
consul.RegisterService("python-ai-service", "localhost:8001")

// 服务发现
pythonServiceURL := consul.DiscoverService("python-ai-service")
aiClient := client.NewAIClient(pythonServiceURL)
```