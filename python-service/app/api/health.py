"""
健康检查API
"""

import time
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from ..config import get_settings, Settings


router = APIRouter()


class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str
    timestamp: datetime
    version: str
    uptime: float
    checks: dict


class ReadinessResponse(BaseModel):
    """就绪检查响应"""
    ready: bool
    timestamp: datetime
    checks: dict


# 应用启动时间
start_time = time.time()


@router.get("/", response_model=HealthResponse)
async def health_check(settings: Settings = Depends(get_settings)):
    """健康检查"""
    
    checks = {}
    status = "healthy"
    
    # 检查AI服务
    try:
        # TODO: 实际检查OpenAI API连接
        checks["ai_service"] = {"status": "healthy"}
    except Exception as e:
        checks["ai_service"] = {"status": "unhealthy", "error": str(e)}
        status = "unhealthy"
    
    # 检查数据库连接
    try:
        # TODO: 实际检查数据库连接
        checks["database"] = {"status": "healthy"}
    except Exception as e:
        checks["database"] = {"status": "unhealthy", "error": str(e)}
        status = "unhealthy"
    
    # 检查Redis连接
    try:
        # TODO: 实际检查Redis连接
        checks["redis"] = {"status": "healthy"}
    except Exception as e:
        checks["redis"] = {"status": "unhealthy", "error": str(e)}
        status = "unhealthy"
    
    return HealthResponse(
        status=status,
        timestamp=datetime.utcnow(),
        version=settings.app_version,
        uptime=time.time() - start_time,
        checks=checks
    )


@router.get("/ready", response_model=ReadinessResponse)
async def readiness_check():
    """就绪检查"""
    
    checks = {}
    ready = True
    
    # 检查服务是否准备好接收请求
    try:
        # TODO: 检查必要的服务是否已初始化
        checks["initialization"] = {"ready": True}
    except Exception as e:
        checks["initialization"] = {"ready": False, "error": str(e)}
        ready = False
    
    return ReadinessResponse(
        ready=ready,
        timestamp=datetime.utcnow(),
        checks=checks
    )


@router.get("/live")
async def liveness_check():
    """存活检查"""
    return {
        "alive": True,
        "timestamp": datetime.utcnow()
    }