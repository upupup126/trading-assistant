-- AI交易助手数据库Schema设计
-- 创建数据库和基础配置

-- 启用UUID扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- 用户配置表
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    risk_tolerance VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH
    default_position_size DECIMAL(10,2) DEFAULT 1000.00,
    max_daily_loss DECIMAL(10,2) DEFAULT 500.00,
    notification_preferences JSONB DEFAULT '{}',
    trading_hours JSONB DEFAULT '{"start": "09:30", "end": "15:00"}',
    timezone VARCHAR(50) DEFAULT 'Asia/Shanghai',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 股票信息表
CREATE TABLE stocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) UNIQUE NOT NULL, -- 股票代码
    name VARCHAR(100) NOT NULL, -- 股票名称
    exchange VARCHAR(20) NOT NULL, -- 交易所
    sector VARCHAR(50), -- 行业
    market_cap BIGINT, -- 市值
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 交易计划表
CREATE TABLE trading_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES stocks(id),
    plan_type VARCHAR(20) NOT NULL, -- BUY, SELL
    target_price DECIMAL(10,4) NOT NULL,
    stop_loss DECIMAL(10,4),
    take_profit DECIMAL(10,4),
    quantity INTEGER NOT NULL,
    reasoning TEXT, -- 交易理由
    ai_confidence DECIMAL(3,2), -- AI置信度 0-1
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, EXECUTED, CANCELLED, EXPIRED
    priority VARCHAR(20) DEFAULT 'MEDIUM', -- LOW, MEDIUM, HIGH
    expected_return DECIMAL(5,2), -- 预期收益率
    max_risk DECIMAL(5,2), -- 最大风险
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

-- 交易执行记录表
CREATE TABLE trade_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trading_plan_id UUID REFERENCES trading_plans(id),
    stock_id UUID NOT NULL REFERENCES stocks(id),
    trade_type VARCHAR(20) NOT NULL, -- BUY, SELL
    quantity INTEGER NOT NULL,
    price DECIMAL(10,4) NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    commission DECIMAL(8,2) DEFAULT 0,
    execution_type VARCHAR(20) DEFAULT 'MANUAL', -- MANUAL, AUTO, AI_SUGGESTED
    notes TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 持仓表
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES stocks(id),
    quantity INTEGER NOT NULL,
    avg_cost DECIMAL(10,4) NOT NULL,
    total_cost DECIMAL(12,2) NOT NULL,
    current_price DECIMAL(10,4),
    unrealized_pnl DECIMAL(12,2),
    realized_pnl DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, stock_id)
);

-- AI分析记录表
CREATE TABLE ai_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    stock_id UUID REFERENCES stocks(id),
    analysis_type VARCHAR(50) NOT NULL, -- MARKET_OVERVIEW, STOCK_ANALYSIS, RISK_ASSESSMENT, STRATEGY_ADVICE
    prompt TEXT NOT NULL,
    result JSONB NOT NULL,
    confidence_score DECIMAL(3,2), -- 0-1
    model_version VARCHAR(50),
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 智能提醒表
CREATE TABLE smart_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id UUID REFERENCES stocks(id),
    alert_type VARCHAR(50) NOT NULL, -- PRICE_TARGET, VOLUME_SPIKE, NEWS_SENTIMENT, AI_SIGNAL
    conditions JSONB NOT NULL, -- 提醒条件
    message_template TEXT,
    is_active BOOLEAN DEFAULT true,
    trigger_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 提醒历史表
CREATE TABLE alert_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID NOT NULL REFERENCES smart_alerts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    delivery_method VARCHAR(20) NOT NULL, -- EMAIL, SMS, PUSH, WEBSOCKET
    delivery_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SENT, DELIVERED, FAILED
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- 市场数据表（缓存外部API数据）
CREATE TABLE market_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_id UUID NOT NULL REFERENCES stocks(id),
    price DECIMAL(10,4) NOT NULL,
    volume BIGINT,
    change_amount DECIMAL(10,4),
    change_percent DECIMAL(5,2),
    high DECIMAL(10,4),
    low DECIMAL(10,4),
    open DECIMAL(10,4),
    previous_close DECIMAL(10,4),
    market_cap BIGINT,
    data_source VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stock_id, timestamp)
);

-- 用户关注股票表
CREATE TABLE user_watchlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_id UUID NOT NULL REFERENCES stocks(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, stock_id)
);

-- 交易日志表（复盘分析）
CREATE TABLE trading_journals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trade_execution_id UUID REFERENCES trade_executions(id),
    entry_reason TEXT,
    exit_reason TEXT,
    emotions_before TEXT,
    emotions_after TEXT,
    lessons_learned TEXT,
    performance_rating INTEGER CHECK (performance_rating >= 1 AND performance_rating <= 5),
    ai_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 系统配置表
CREATE TABLE system_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_trading_plans_user_id ON trading_plans(user_id);
CREATE INDEX idx_trading_plans_status ON trading_plans(status);
CREATE INDEX idx_trading_plans_created_at ON trading_plans(created_at);
CREATE INDEX idx_trade_executions_user_id ON trade_executions(user_id);
CREATE INDEX idx_trade_executions_executed_at ON trade_executions(executed_at);
CREATE INDEX idx_positions_user_id ON positions(user_id);
CREATE INDEX idx_ai_analyses_user_id ON ai_analyses(user_id);
CREATE INDEX idx_ai_analyses_created_at ON ai_analyses(created_at);
CREATE INDEX idx_smart_alerts_user_id ON smart_alerts(user_id);
CREATE INDEX idx_smart_alerts_is_active ON smart_alerts(is_active);
CREATE INDEX idx_market_data_stock_id ON market_data(stock_id);
CREATE INDEX idx_market_data_timestamp ON market_data(timestamp);
CREATE INDEX idx_user_watchlists_user_id ON user_watchlists(user_id);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表添加更新时间触发器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stocks_updated_at BEFORE UPDATE ON stocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trading_plans_updated_at BEFORE UPDATE ON trading_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_smart_alerts_updated_at BEFORE UPDATE ON smart_alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trading_journals_updated_at BEFORE UPDATE ON trading_journals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_configs_updated_at BEFORE UPDATE ON system_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();