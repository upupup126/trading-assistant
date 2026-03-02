-- 给 strategy_alerts 表添加 stock_name 列
ALTER TABLE strategy_alerts ADD COLUMN IF NOT EXISTS stock_name VARCHAR(100) DEFAULT '';
