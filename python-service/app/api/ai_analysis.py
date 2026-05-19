"""
AI分析API路由
提供市场分析、个股分析、风险评估等AI服务
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.services.ai_analyst import ai_analyst
from app.services.market_data import market_data_service

router = APIRouter(prefix="/api/ai", tags=["AI分析"])

class MarketAnalysisRequest(BaseModel):
    symbols: Optional[List[str]] = None
    analysis_type: str = "comprehensive"

class StockAnalysisRequest(BaseModel):
    symbol: str
    user_context: Optional[Dict[str, Any]] = None

class RiskAssessmentRequest(BaseModel):
    portfolio: Dict[str, float]  # symbol -> position_value
    user_profile: Optional[Dict[str, Any]] = None

class TradingAdviceRequest(BaseModel):
    symbol: str
    plan_context: Dict[str, Any]

@router.post("/market-trend")
async def analyze_market_trend(request: MarketAnalysisRequest):
    """分析市场趋势"""
    try:
        analysis = await ai_analyst.analyze_market_trend(request.symbols)
        return analysis.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"市场分析失败: {str(e)}")

@router.post("/stock-opportunity")
async def analyze_stock_opportunity(request: StockAnalysisRequest):
    """分析个股投资机会"""
    try:
        analysis = await ai_analyst.analyze_stock_opportunity(
            request.symbol, 
            request.user_context
        )
        return analysis.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"个股分析失败: {str(e)}")

@router.post("/risk-assessment")
async def assess_portfolio_risk(request: RiskAssessmentRequest):
    """评估投资组合风险"""
    try:
        assessment = await ai_analyst.assess_portfolio_risk(request.portfolio)
        return assessment.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"风险评估失败: {str(e)}")

@router.post("/trading-advice")
async def generate_trading_advice(request: TradingAdviceRequest):
    """生成交易建议"""
    try:
        advice = await ai_analyst.generate_trading_advice(
            request.symbol,
            request.plan_context
        )
        return advice.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"交易建议生成失败: {str(e)}")

@router.get("/market-overview")
async def get_market_overview():
    """获取市场概览"""
    try:
        async with market_data_service as service:
            overview = await service.get_market_overview()
            return overview
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取市场概览失败: {str(e)}")

@router.get("/stock/{symbol}/quote")
async def get_stock_quote(symbol: str):
    """获取股票实时行情"""
    try:
        async with market_data_service as service:
            quote = await service.get_stock_quote(symbol)
            return quote
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取股票行情失败: {str(e)}")

@router.get("/stock/{symbol}/history")
async def get_stock_history(symbol: str, period: str = "1mo"):
    """获取股票历史数据"""
    try:
        async with market_data_service as service:
            history = await service.get_historical_data(symbol, period)
            return {"symbol": symbol, "period": period, "data": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取历史数据失败: {str(e)}")

@router.get("/stocks/search")
async def search_stocks(q: str, limit: int = 10):
    """搜索股票"""
    try:
        async with market_data_service as service:
            results = await service.search_stocks(q, limit)
            return {"query": q, "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"股票搜索失败: {str(e)}")

@router.get("/stock/{symbol}/minute")
async def get_stock_minute(symbol: str):
    """获取股票分时走势数据"""
    try:
        async with market_data_service as service:
            data = await service.get_minute_data(symbol)
            return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取分时数据失败: {str(e)}")

@router.get("/sector/hotspot")
async def get_sector_hotspot(days: int = 5):
    """获取概念板块热点轮动数据"""
    try:
        async with market_data_service as service:
            data = await service.get_concept_sector_hotspot(days)
            return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取板块热点数据失败: {str(e)}")

@router.get("/stock/{symbol}/capital-flow")
async def get_stock_capital_flow(symbol: str):
    """获取个股实时资金流向"""
    try:
        async with market_data_service as service:
            flow = await service.get_capital_flow(symbol)
            return flow
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取资金流向失败: {str(e)}")

@router.get("/stock/{symbol}/capital-flow/history")
async def get_stock_capital_flow_history(symbol: str):
    """获取个股历史资金流向（近30日）"""
    try:
        from app.services.fundamental_data import get_fund_flow_history
        result = await get_fund_flow_history(symbol)
        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取历史资金流向失败: {str(e)}")

@router.get("/stock/{symbol}/fundamentals")
async def get_stock_fundamentals(symbol: str):
    """获取个股基本面财务数据"""
    try:
        from app.services.fundamental_data import get_stock_fundamentals as _get_fundamentals
        result = await _get_fundamentals(symbol)
        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取基本面数据失败: {str(e)}")

@router.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "service": "AI Analysis Service",
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }