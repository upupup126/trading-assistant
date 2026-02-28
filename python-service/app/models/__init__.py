"""
数据模型包
定义AI分析服务使用的数据模型
"""

from .analysis import (
    MarketAnalysis,
    StockAnalysis, 
    RiskAssessment,
    TradingAdvice,
    AIAnalysisRequest,
    AIAnalysisResponse
)

from .base import BaseModel

__all__ = [
    "MarketAnalysis",
    "StockAnalysis", 
    "RiskAssessment",
    "TradingAdvice",
    "AIAnalysisRequest",
    "AIAnalysisResponse",
    "BaseModel"
]