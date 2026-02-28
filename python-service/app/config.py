"""
应用配置模块
"""

import os
from functools import lru_cache
from typing import Optional

try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings


class Settings(BaseSettings):
    """应用设置"""
    
    # 应用基础配置
    app_name: str = "Trading Assistant AI Service"
    app_version: str = "1.0.0"
    environment: str = "development"
    debug: bool = False
    
    # 服务配置
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1
    
    # 数据库配置
    database_url: str = "postgresql://trading_user:trading_password@localhost:5432/trading_assistant"
    database_pool_size: int = 10
    database_max_overflow: int = 20
    
    # Redis配置
    redis_url: str = "redis://localhost:6379/0"
    redis_password: Optional[str] = None
    
    # AI模型配置
    openai_api_key: str = ""
    openai_model: str = "gpt-3.5-turbo"
    openai_base_url: Optional[str] = None
    openai_temperature: float = 0.3
    openai_max_tokens: int = 2500
    openai_timeout: int = 30
    
    # 腾讯混元配置（备用）
    tencent_secret_id: Optional[str] = None
    tencent_secret_key: Optional[str] = None
    
    # 外部API配置
    stock_api_key: Optional[str] = None
    stock_api_timeout: int = 10
    
    # 缓存配置
    cache_ttl: int = 300  # 5分钟
    analysis_cache_ttl: int = 1800  # 30分钟
    
    # 日志配置
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # 安全配置
    cors_origins: list = ["http://localhost:3000", "http://localhost:8080", "http://45.40.228.140:3000", "http://45.40.228.140"]
    max_request_size: int = 10 * 1024 * 1024  # 10MB
    
    # 任务队列配置
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"
    
    # 监控配置
    enable_metrics: bool = True
    metrics_port: int = 9090
    
    # Uppercase aliases for env compatibility
    @property
    def OPENAI_API_KEY(self):
        return self.openai_api_key
    
    @property
    def OPENAI_BASE_URL(self):
        return self.openai_base_url
    
    @property
    def OPENAI_MODEL(self):
        return self.openai_model
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        env_prefix = ""


@lru_cache()
def get_settings() -> Settings:
    """获取应用设置（单例模式）"""
    return Settings()


# 环境检查
def validate_environment():
    """验证环境配置"""
    settings = get_settings()
    
    errors = []
    
    # 检查必需的配置
    if not settings.openai_api_key:
        errors.append("OPENAI_API_KEY is required")
    
    if not settings.database_url:
        errors.append("DATABASE_URL is required")
    
    if errors:
        raise ValueError(f"Configuration errors: {', '.join(errors)}")
    
    return True


# 开发环境配置
class DevelopmentSettings(Settings):
    """开发环境配置"""
    debug: bool = True
    log_level: str = "DEBUG"
    workers: int = 1


# 生产环境配置
class ProductionSettings(Settings):
    """生产环境配置"""
    debug: bool = False
    log_level: str = "INFO"
    workers: int = 4
    
    # 生产环境安全配置
    cors_origins: list = ["https://trading-assistant.com"]


# 测试环境配置
class TestSettings(Settings):
    """测试环境配置"""
    debug: bool = True
    log_level: str = "DEBUG"
    
    # 测试数据库
    database_url: str = "postgresql://trading_user:trading_password@localhost:5432/trading_assistant_test"
    
    # 测试Redis
    redis_url: str = "redis://localhost:6379/15"
    
    # 模拟AI API
    openai_api_key: str = "test-key"


def get_environment_settings() -> Settings:
    """根据环境变量获取对应的配置"""
    env = os.getenv("ENVIRONMENT", "development").lower()
    
    if env == "production":
        return ProductionSettings()
    elif env == "test":
        return TestSettings()
    else:
        return DevelopmentSettings()


# 常量定义
class Constants:
    """应用常量"""
    
    # 分析类型
    ANALYSIS_TYPES = {
        "MARKET_OVERVIEW": "市场概览",
        "STOCK_ANALYSIS": "个股分析", 
        "RISK_ASSESSMENT": "风险评估",
        "STRATEGY_ADVICE": "策略建议",
        "SENTIMENT_ANALYSIS": "情绪分析",
        "TECHNICAL_ANALYSIS": "技术分析"
    }
    
    # 交易信号
    TRADING_SIGNALS = {
        "BUY": "买入",
        "SELL": "卖出", 
        "HOLD": "持有",
        "WAIT": "观望"
    }
    
    # 风险等级
    RISK_LEVELS = {
        "LOW": "低风险",
        "MEDIUM": "中等风险",
        "HIGH": "高风险", 
        "EXTREME": "极高风险"
    }
    
    # 市场情绪
    MARKET_SENTIMENTS = {
        "BULLISH": "看涨",
        "BEARISH": "看跌",
        "NEUTRAL": "中性",
        "VOLATILE": "震荡"
    }
    
    # 缓存键前缀
    CACHE_PREFIXES = {
        "analysis": "analysis:",
        "market_data": "market:",
        "user_session": "session:",
        "rate_limit": "rate_limit:"
    }
    
    # API限制
    API_LIMITS = {
        "max_symbols_per_request": 10,
        "max_analysis_per_day": 100,
        "max_concurrent_requests": 5
    }


# 导出配置
__all__ = [
    "Settings",
    "get_settings", 
    "validate_environment",
    "get_environment_settings",
    "Constants"
]