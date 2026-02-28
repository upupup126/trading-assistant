-- 回滚初始Schema迁移
-- 删除所有表和触发器

-- 删除触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
DROP TRIGGER IF EXISTS update_stocks_updated_at ON stocks;
DROP TRIGGER IF EXISTS update_trading_plans_updated_at ON trading_plans;
DROP TRIGGER IF EXISTS update_positions_updated_at ON positions;
DROP TRIGGER IF EXISTS update_smart_alerts_updated_at ON smart_alerts;
DROP TRIGGER IF EXISTS update_trading_journals_updated_at ON trading_journals;
DROP TRIGGER IF EXISTS update_system_configs_updated_at ON system_configs;

-- 删除触发器函数
DROP FUNCTION IF EXISTS update_updated_at_column();

-- 删除表（按依赖关系逆序删除）
DROP TABLE IF EXISTS alert_history;
DROP TABLE IF EXISTS smart_alerts;
DROP TABLE IF EXISTS ai_analyses;
DROP TABLE IF EXISTS trading_journals;
DROP TABLE IF EXISTS user_watchlists;
DROP TABLE IF EXISTS market_data;
DROP TABLE IF EXISTS trade_executions;
DROP TABLE IF EXISTS positions;
DROP TABLE IF EXISTS trading_plans;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS system_configs;
DROP TABLE IF EXISTS stocks;
DROP TABLE IF EXISTS users;

-- 删除扩展（可选，如果其他应用不使用）
-- DROP EXTENSION IF EXISTS "uuid-ossp";