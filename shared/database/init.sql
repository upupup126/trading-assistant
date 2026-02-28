-- 数据库初始化脚本
-- 插入基础数据和配置

-- 插入系统配置
INSERT INTO system_configs (config_key, config_value, description) VALUES
('ai_models', '{"primary": "gpt-4", "fallback": "gpt-3.5-turbo", "max_tokens": 2000}', 'AI模型配置'),
('market_hours', '{"start": "09:30", "end": "15:00", "timezone": "Asia/Shanghai"}', '交易时间配置'),
('risk_limits', '{"max_position_size": 0.1, "max_daily_loss": 0.05, "max_leverage": 1.0}', '风险控制配置'),
('notification_settings', '{"email_enabled": true, "sms_enabled": false, "push_enabled": true}', '通知设置'),
('data_sources', '{"primary": "sina", "fallback": "netease", "update_interval": 5}', '数据源配置');

-- 插入常见股票数据（示例）
INSERT INTO stocks (symbol, name, exchange, sector) VALUES
('000001', '平安银行', 'SZSE', '银行'),
('000002', '万科A', 'SZSE', '房地产'),
('600000', '浦发银行', 'SSE', '银行'),
('600036', '招商银行', 'SSE', '银行'),
('600519', '贵州茅台', 'SSE', '食品饮料'),
('000858', '五粮液', 'SZSE', '食品饮料'),
('002415', '海康威视', 'SZSE', '电子'),
('300059', '东方财富', 'SZSE', '非银金融'),
('300750', '宁德时代', 'SZSE', '电气设备'),
('002594', '比亚迪', 'SZSE', '汽车');

-- 创建测试用户（开发环境）
-- 密码: password123 (bcrypt hash)
INSERT INTO users (username, email, password_hash, full_name, is_active, email_verified) VALUES
('testuser', 'test@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '测试用户', true, true),
('demo', 'demo@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '演示用户', true, true);

-- 为测试用户创建默认设置
INSERT INTO user_settings (user_id, risk_tolerance, default_position_size, max_daily_loss) 
SELECT id, 'MEDIUM', 5000.00, 1000.00 FROM users WHERE username IN ('testuser', 'demo');

-- 创建示例交易计划
INSERT INTO trading_plans (user_id, stock_id, plan_type, target_price, stop_loss, take_profit, quantity, reasoning, ai_confidence, status)
SELECT 
    u.id,
    s.id,
    'BUY',
    15.50,
    14.00,
    17.00,
    1000,
    '技术面突破，AI分析显示上涨概率较高',
    0.75,
    'ACTIVE'
FROM users u, stocks s 
WHERE u.username = 'testuser' AND s.symbol = '000001'
LIMIT 1;

-- 创建示例智能提醒
INSERT INTO smart_alerts (user_id, stock_id, alert_type, conditions, message_template, is_active)
SELECT 
    u.id,
    s.id,
    'PRICE_TARGET',
    '{"target_price": 16.00, "condition": ">="}',
    '股票 {{symbol}} 已达到目标价格 {{price}}',
    true
FROM users u, stocks s 
WHERE u.username = 'testuser' AND s.symbol = '000001'
LIMIT 1;

-- 创建用户关注列表
INSERT INTO user_watchlists (user_id, stock_id, notes)
SELECT 
    u.id,
    s.id,
    '重点关注'
FROM users u 
CROSS JOIN stocks s 
WHERE u.username = 'testuser' AND s.symbol IN ('600519', '000858', '300750');