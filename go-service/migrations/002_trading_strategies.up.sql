-- 交易策略模块迁移
-- 新增策略管理、策略提醒、回测结果缓存三张表

-- 1. 用户交易策略表
CREATE TABLE IF NOT EXISTS trading_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_symbol VARCHAR(20) NOT NULL,
    stock_name VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    strategy_type VARCHAR(20) NOT NULL,
    builtin_strategy_ids JSONB DEFAULT '[]',
    custom_rules JSONB DEFAULT '[]',
    alert_enabled BOOLEAN DEFAULT true,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trading_strategies_user_id ON trading_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_strategies_status ON trading_strategies(status);
CREATE INDEX IF NOT EXISTS idx_trading_strategies_stock ON trading_strategies(stock_symbol);

DROP TRIGGER IF EXISTS update_trading_strategies_updated_at ON trading_strategies;
CREATE TRIGGER update_trading_strategies_updated_at
    BEFORE UPDATE ON trading_strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. 策略提醒记录表
CREATE TABLE IF NOT EXISTS strategy_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id UUID NOT NULL REFERENCES trading_strategies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_symbol VARCHAR(20) NOT NULL,
    alert_type VARCHAR(20) NOT NULL,
    triggered_strategy VARCHAR(50),
    message TEXT NOT NULL,
    details JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_strategy_alerts_user_id ON strategy_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_strategy_alerts_strategy_id ON strategy_alerts(strategy_id);
CREATE INDEX IF NOT EXISTS idx_strategy_alerts_is_read ON strategy_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_strategy_alerts_created_at ON strategy_alerts(created_at);

-- 3. 回测结果缓存表
CREATE TABLE IF NOT EXISTS backtest_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stock_symbol VARCHAR(20) NOT NULL,
    strategy_config JSONB NOT NULL,
    config_hash VARCHAR(64) NOT NULL,
    result_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(stock_symbol, config_hash)
);

CREATE INDEX IF NOT EXISTS idx_backtest_results_symbol ON backtest_results(stock_symbol);
CREATE INDEX IF NOT EXISTS idx_backtest_results_hash ON backtest_results(config_hash);
