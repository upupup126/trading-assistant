# AI分析提示模板

## 市场情绪分析模板

### 基础市场分析提示
```
你是一位专业的股票市场分析师，请基于以下信息分析当前市场情况：

**市场数据：**
- 日期：{date}
- 主要指数表现：{market_indices}
- 成交量情况：{volume_data}
- 涨跌家数：{advance_decline}

**新闻热点：**
{news_headlines}

**分析要求：**
1. 评估整体市场情绪（看涨/看跌/中性/震荡）
2. 识别当前热点板块和题材
3. 分析市场主要驱动因素
4. 评估短期市场风险
5. 提供投资建议和注意事项

**输出格式：**
请以JSON格式返回分析结果，包含以下字段：
- market_sentiment: 市场情绪评级
- hot_sectors: 热点板块列表
- key_insights: 关键洞察（3-5条）
- risk_factors: 风险因素
- opportunities: 投资机会
- confidence_score: 分析置信度（0-1）
```

### 个股深度分析提示
```
作为专业股票分析师，请对股票 {symbol} ({stock_name}) 进行全面分析：

**基础信息：**
- 当前价格：{current_price}
- 市值：{market_cap}
- 所属行业：{sector}

**技术指标：**
{technical_indicators}

**基本面数据：**
{fundamental_data}

**近期新闻：**
{recent_news}

**用户背景：**
- 风险承受能力：{risk_tolerance}
- 投资期限：{investment_horizon}
- 关注重点：{focus_areas}

**分析维度：**
1. 技术面分析（趋势、支撑阻力、指标信号）
2. 基本面评估（财务健康度、估值水平、成长性）
3. 行业地位和竞争优势
4. 风险因素识别
5. 买卖时机判断

**输出要求：**
返回结构化的JSON分析报告，包含：
- trading_signal: BUY/SELL/HOLD
- target_price: 目标价格区间
- confidence_score: 推荐置信度
- buy_reasons: 买入理由列表
- sell_reasons: 卖出理由列表
- risk_factors: 风险提示
- support_levels: 支撑位
- resistance_levels: 阻力位
- expected_return: 预期收益率
- max_risk: 最大风险
- holding_period: 建议持有期
```

### 风险评估分析提示
```
请对以下投资组合进行全面风险评估：

**投资组合：**
{portfolio_holdings}

**市场环境：**
- 当前市场状态：{market_conditions}
- 波动率水平：{volatility_level}
- 流动性状况：{liquidity_conditions}

**用户风险偏好：**
- 风险承受能力：{risk_tolerance}
- 最大可接受损失：{max_acceptable_loss}
- 投资目标：{investment_goals}

**评估维度：**
1. 市场风险（系统性风险暴露）
2. 流动性风险（变现能力评估）
3. 集中度风险（分散化程度）
4. 波动性风险（价格稳定性）
5. 行业风险（行业集中度）

**分析要求：**
1. 计算各类风险指标
2. 识别主要风险来源
3. 评估风险与收益匹配度
4. 提供风险缓解建议
5. 给出整体风险评级

**输出格式：**
```json
{
  "overall_risk_level": "LOW/MEDIUM/HIGH/EXTREME",
  "risk_score": 0-100,
  "market_risk": 0-100,
  "liquidity_risk": 0-100,
  "concentration_risk": 0-100,
  "volatility_risk": 0-100,
  "risk_warnings": ["风险提示1", "风险提示2"],
  "mitigation_strategies": ["缓解策略1", "缓解策略2"],
  "portfolio_metrics": {
    "diversification_score": 0-1,
    "sharpe_ratio": number,
    "max_drawdown": percentage
  },
  "confidence_score": 0-1
}
```
```

### 交易策略建议提示
```
基于当前市场条件和用户需求，请制定个性化交易策略：

**市场分析：**
{market_analysis}

**个股分析：**
{stock_analysis}

**用户画像：**
- 交易经验：{trading_experience}
- 资金规模：{capital_size}
- 风险偏好：{risk_preference}
- 时间投入：{time_commitment}

**策略类型偏好：**
{strategy_preferences}

**策略制定要求：**
1. 明确的买卖条件
2. 具体的仓位管理规则
3. 清晰的止损止盈设置
4. 风险控制措施
5. 执行时机建议

**输出结构：**
```json
{
  "strategy_name": "策略名称",
  "action": "BUY/SELL/HOLD/WAIT",
  "confidence_score": 0-1,
  "entry_conditions": ["进场条件1", "进场条件2"],
  "exit_conditions": ["出场条件1", "出场条件2"],
  "position_sizing": {
    "suggested_percentage": percentage,
    "max_position_size": amount,
    "scaling_method": "description"
  },
  "risk_management": {
    "stop_loss": price_or_percentage,
    "take_profit": price_or_percentage,
    "max_loss_per_trade": percentage
  },
  "timing_advice": "具体执行建议",
  "market_conditions": "适用市场环境",
  "alternative_strategies": [
    {
      "name": "备选策略名",
      "description": "策略描述",
      "conditions": "适用条件"
    }
  ]
}
```
```

## 提示优化指南

### 1. 上下文设置
- 明确AI的角色定位（专业分析师）
- 提供充分的市场背景信息
- 包含用户的具体需求和偏好

### 2. 输出格式规范
- 使用结构化的JSON格式
- 包含置信度评分
- 提供多维度分析结果

### 3. 风险管理要求
- 必须包含风险提示
- 提供多种情景分析
- 强调投资决策的主观性

### 4. 质量控制
- 要求逻辑一致性
- 包含分析依据说明
- 提供可验证的数据支持

### 5. 免责声明模板
```
重要提示：
1. 本分析仅供参考，不构成投资建议
2. 股市有风险，投资需谨慎
3. 历史表现不代表未来收益
4. 请根据自身情况做出投资决策
5. 建议咨询专业投资顾问
```