"""
AI分析API
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from ..models.analysis import (
    AIAnalysisRequest,
    AIAnalysisResponse,
    AnalysisType,
    BatchAnalysisRequest,
    BatchAnalysisResponse
)
from ..services.ai_analyst import AIAnalystService


router = APIRouter()
logger = logging.getLogger(__name__)


class AnalysisRequestModel(BaseModel):
    """分析请求模型"""
    analysis_type: AnalysisType
    stock_symbol: Optional[str] = None
    context: Optional[dict] = None
    parameters: Optional[dict] = None


class AnalysisResponseModel(BaseModel):
    """分析响应模型"""
    success: bool = True
    data: Optional[AIAnalysisResponse] = None
    error: Optional[dict] = None
    request_id: Optional[str] = None


def get_ai_service(request: Request) -> AIAnalystService:
    """获取AI分析服务实例"""
    return request.app.state.ai_service


@router.post("/", response_model=AnalysisResponseModel)
async def analyze(
    request_data: AnalysisRequestModel,
    ai_service: AIAnalystService = Depends(get_ai_service)
):
    """
    执行AI分析
    
    支持的分析类型：
    - MARKET_OVERVIEW: 市场概览分析
    - STOCK_ANALYSIS: 个股分析
    - RISK_ASSESSMENT: 风险评估
    - STRATEGY_ADVICE: 策略建议
    """
    
    try:
        # 构建分析请求
        analysis_request = AIAnalysisRequest(
            analysis_type=request_data.analysis_type,
            stock_symbol=request_data.stock_symbol,
            context=request_data.context or {},
            parameters=request_data.parameters or {}
        )
        
        # 执行分析
        result = await ai_service.analyze(analysis_request)
        
        return AnalysisResponseModel(
            success=True,
            data=result,
            request_id=result.request_id
        )
        
    except ValueError as e:
        logger.error(f"Invalid analysis request: {e}")
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_REQUEST",
                "message": str(e)
            }
        )
    
    except Exception as e:
        logger.error(f"Analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "ANALYSIS_FAILED",
                "message": "AI analysis failed"
            }
        )


@router.post("/batch", response_model=BatchAnalysisResponse)
async def batch_analyze(
    batch_request: BatchAnalysisRequest,
    ai_service: AIAnalystService = Depends(get_ai_service)
):
    """
    批量AI分析
    
    一次请求可以包含多个分析任务，系统会并行处理并返回所有结果。
    """
    
    try:
        # TODO: 实现批量分析
        # 这里需要实现并行处理多个分析请求的逻辑
        
        results = []
        for req in batch_request.requests:
            try:
                result = await ai_service.analyze(req)
                results.append(result)
            except Exception as e:
                logger.error(f"Batch analysis item failed: {e}")
                # 创建错误响应
                error_result = AIAnalysisResponse(
                    request_id=f"batch_error_{len(results)}",
                    analysis_type=req.analysis_type,
                    status="failed",
                    error_message=str(e),
                    error_code="ANALYSIS_ERROR"
                )
                results.append(error_result)
        
        # 统计结果
        total_requests = len(batch_request.requests)
        completed_requests = sum(1 for r in results if r.status == "completed")
        failed_requests = total_requests - completed_requests
        
        overall_status = "completed"
        if failed_requests > 0:
            if completed_requests > 0:
                overall_status = "partial_failed"
            else:
                overall_status = "failed"
        
        return BatchAnalysisResponse(
            batch_id=f"batch_{int(time.time())}",
            total_requests=total_requests,
            completed_requests=completed_requests,
            failed_requests=failed_requests,
            results=results,
            overall_status=overall_status
        )
        
    except Exception as e:
        logger.error(f"Batch analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "code": "BATCH_ANALYSIS_FAILED",
                "message": "Batch analysis failed"
            }
        )


@router.get("/market-overview")
async def get_market_overview(
    ai_service: AIAnalystService = Depends(get_ai_service)
):
    """
    获取市场概览分析
    
    快速获取当前市场整体情况分析。
    """
    
    try:
        request_data = AIAnalysisRequest(
            analysis_type=AnalysisType.MARKET_OVERVIEW,
            context={
                "date": datetime.now().strftime("%Y-%m-%d"),
                "quick_analysis": True
            }
        )
        
        result = await ai_service.analyze(request_data)
        
        return {
            "success": True,
            "data": result.market_analysis,
            "request_id": result.request_id
        }
        
    except Exception as e:
        logger.error(f"Market overview analysis failed: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "MARKET_ANALYSIS_FAILED",
                "message": "Market overview analysis failed"
            }
        )


@router.get("/stock/{symbol}")
async def analyze_stock(
    symbol: str,
    analysis_depth: str = "basic",
    ai_service: AIAnalystService = Depends(get_ai_service)
):
    """
    分析特定股票
    
    Args:
        symbol: 股票代码
        analysis_depth: 分析深度 (basic/detailed/comprehensive)
    """
    
    try:
        request_data = AIAnalysisRequest(
            analysis_type=AnalysisType.STOCK_ANALYSIS,
            stock_symbol=symbol.upper(),
            context={
                "analysis_depth": analysis_depth,
                "include_technical": True,
                "include_fundamental": analysis_depth in ["detailed", "comprehensive"]
            }
        )
        
        result = await ai_service.analyze(request_data)
        
        return {
            "success": True,
            "data": result.stock_analysis,
            "request_id": result.request_id
        }
        
    except Exception as e:
        logger.error(f"Stock analysis failed for {symbol}: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "STOCK_ANALYSIS_FAILED",
                "message": f"Stock analysis failed for {symbol}"
            }
        )


@router.post("/risk-assessment")
async def assess_risk(
    portfolio_data: dict,
    ai_service: AIAnalystService = Depends(get_ai_service)
):
    """
    投资组合风险评估
    
    Args:
        portfolio_data: 投资组合数据
    """
    
    try:
        request_data = AIAnalysisRequest(
            analysis_type=AnalysisType.RISK_ASSESSMENT,
            context={
                "portfolio": portfolio_data,
                "assessment_type": "comprehensive"
            }
        )
        
        result = await ai_service.analyze(request_data)
        
        return {
            "success": True,
            "data": result.risk_assessment,
            "request_id": result.request_id
        }
        
    except Exception as e:
        logger.error(f"Risk assessment failed: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "RISK_ASSESSMENT_FAILED",
                "message": "Risk assessment failed"
            }
        )


@router.get("/history/{user_id}")
async def get_analysis_history(
    user_id: str,
    limit: int = 10,
    offset: int = 0,
    ai_service: AIAnalystService = Depends(get_ai_service)
):
    """
    获取用户分析历史
    
    Args:
        user_id: 用户ID
        limit: 返回数量限制
        offset: 偏移量
    """
    
    try:
        history = await ai_service.get_analysis_history(user_id, limit)
        
        return {
            "success": True,
            "data": {
                "history": history,
                "total": len(history),
                "limit": limit,
                "offset": offset
            }
        }
        
    except Exception as e:
        logger.error(f"Failed to get analysis history for user {user_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "HISTORY_FETCH_FAILED",
                "message": "Failed to fetch analysis history"
            }
        )


@router.get("/status")
async def get_service_status(
    ai_service: AIAnalystService = Depends(get_ai_service)
):
    """
    获取AI服务状态
    """
    
    try:
        status = await ai_service.health_check()
        
        return {
            "success": True,
            "data": status
        }
        
    except Exception as e:
        logger.error(f"Failed to get service status: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "code": "STATUS_CHECK_FAILED",
                "message": "Failed to check service status"
            }
        )