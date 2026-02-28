"""
AI分析相关数据模型
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from uuid import UUID

from pydantic import Field, validator

from .base import BaseModel, TimestampMixin, UUIDMixin


class AnalysisType(str, Enum):
    """分析类型枚举"""
    MARKET_OVERVIEW = "MARKET_OVERVIEW"
    STOCK_ANALYSIS = "STOCK_ANALYSIS"
    RISK_ASSESSMENT = "RISK_ASSESSMENT"
    STRATEGY_ADVICE = "STRATEGY_ADVICE"
    SENTIMENT_ANALYSIS = "SENTIMENT_ANALYSIS"
    TECHNICAL_ANALYSIS = "TECHNICAL_ANALYSIS"


class MarketSentiment(str, Enum):
    """市场情绪枚举"""
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    NEUTRAL = "NEUTRAL"
    VOLATILE = "VOLATILE"


class RiskLevel(str, Enum):
    """风险等级枚举"""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    EXTREME = "EXTREME"


class TradingSignal(str, Enum):
    """交易信号枚举"""
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    WAIT = "WAIT"


class AIAnalysisRequest(BaseModel):
    """AI分析请求模型"""
    analysis_type: AnalysisType
    user_id: Optional[UUID] = None
    stock_symbol: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    parameters: Optional[Dict[str, Any]] = None
    
    @validator('stock_symbol')
    def validate_stock_symbol(cls, v):
        if v and len(v) > 20:
            raise ValueError('股票代码长度不能超过20个字符')
        return v


class MarketAnalysis(TimestampMixin):
    """市场分析结果"""
    analysis_id: str
    market_sentiment: MarketSentiment
    hot_sectors: List[str] = Field(default_factory=list)
    key_insights: List[str] = Field(default_factory=list)
    market_trends: Dict[str, Any] = Field(default_factory=dict)
    confidence_score: float = Field(ge=0.0, le=1.0)
    risk_factors: List[str] = Field(default_factory=list)
    opportunities: List[str] = Field(default_factory=list)


class StockAnalysis(TimestampMixin):
    """个股分析结果"""
    analysis_id: str
    stock_symbol: str
    stock_name: Optional[str] = None
    current_price: Optional[float] = None
    target_price: Optional[float] = None
    trading_signal: TradingSignal
    confidence_score: float = Field(ge=0.0, le=1.0)
    
    # 技术分析
    technical_indicators: Dict[str, Any] = Field(default_factory=dict)
    support_levels: List[float] = Field(default_factory=list)
    resistance_levels: List[float] = Field(default_factory=list)
    
    # 基本面分析
    fundamental_metrics: Dict[str, Any] = Field(default_factory=dict)
    
    # 分析结论
    buy_reasons: List[str] = Field(default_factory=list)
    sell_reasons: List[str] = Field(default_factory=list)
    risk_factors: List[str] = Field(default_factory=list)
    
    # 预期收益和风险
    expected_return: Optional[float] = None
    max_risk: Optional[float] = None
    holding_period: Optional[str] = None


class RiskAssessment(TimestampMixin):
    """风险评估结果"""
    assessment_id: str
    overall_risk_level: RiskLevel
    risk_score: float = Field(ge=0.0, le=100.0)
    
    # 风险分解
    market_risk: float = Field(ge=0.0, le=100.0)
    liquidity_risk: float = Field(ge=0.0, le=100.0)
    concentration_risk: float = Field(ge=0.0, le=100.0)
    volatility_risk: float = Field(ge=0.0, le=100.0)
    
    # 风险建议
    risk_warnings: List[str] = Field(default_factory=list)
    mitigation_strategies: List[str] = Field(default_factory=list)
    
    # 投资组合相关
    portfolio_metrics: Dict[str, Any] = Field(default_factory=dict)
    diversification_score: Optional[float] = None
    
    confidence_score: float = Field(ge=0.0, le=1.0)


class TradingAdvice(TimestampMixin):
    """交易建议结果"""
    advice_id: str
    stock_symbol: Optional[str] = None
    action: TradingSignal
    confidence_score: float = Field(ge=0.0, le=1.0)
    
    # 交易参数建议
    suggested_price: Optional[float] = None
    suggested_quantity: Optional[int] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    
    # 时机建议
    timing_advice: str
    holding_period: Optional[str] = None
    
    # 理由和风险
    reasoning: List[str] = Field(default_factory=list)
    risk_warnings: List[str] = Field(default_factory=list)
    
    # 市场条件
    market_conditions: Dict[str, Any] = Field(default_factory=dict)
    
    # 替代方案
    alternative_strategies: List[Dict[str, Any]] = Field(default_factory=list)


class AIAnalysisResponse(TimestampMixin):
    """AI分析响应模型"""
    request_id: str
    analysis_type: AnalysisType
    status: str = "completed"  # pending, processing, completed, failed
    
    # 分析结果（根据类型选择性填充）
    market_analysis: Optional[MarketAnalysis] = None
    stock_analysis: Optional[StockAnalysis] = None
    risk_assessment: Optional[RiskAssessment] = None
    trading_advice: Optional[TradingAdvice] = None
    
    # 元数据
    model_version: str = "gpt-4"
    processing_time_ms: Optional[int] = None
    tokens_used: Optional[int] = None
    
    # 错误信息
    error_message: Optional[str] = None
    error_code: Optional[str] = None


class AnalysisHistory(UUIDMixin, TimestampMixin):
    """分析历史记录"""
    user_id: Optional[UUID] = None
    analysis_type: AnalysisType
    request_data: Dict[str, Any]
    response_data: Dict[str, Any]
    processing_time_ms: int
    success: bool = True
    error_message: Optional[str] = None


class BatchAnalysisRequest(BaseModel):
    """批量分析请求"""
    requests: List[AIAnalysisRequest]
    priority: int = Field(default=1, ge=1, le=5)
    callback_url: Optional[str] = None
    
    @validator('requests')
    def validate_requests_count(cls, v):
        if len(v) > 10:
            raise ValueError('单次批量分析请求不能超过10个')
        return v


class BatchAnalysisResponse(TimestampMixin):
    """批量分析响应"""
    batch_id: str
    total_requests: int
    completed_requests: int
    failed_requests: int
    results: List[AIAnalysisResponse]
    overall_status: str  # pending, processing, completed, partial_failed, failed