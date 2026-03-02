ALTER TABLE trading_plans ADD COLUMN IF NOT EXISTS alert_id UUID REFERENCES strategy_alerts(id);
