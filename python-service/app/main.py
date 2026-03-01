"""
FastAPI应用主入口
"""

import logging
import sys
import time
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from .api import analysis, health
from .api.ai_analysis import router as ai_analysis_router
from .api.strategy import router as strategy_router
from .config import get_settings, validate_environment
from .services.ai_analyst import AIAnalystService


# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
    ]
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    logger.info("Starting Trading Assistant AI Service...")
    
    try:
        logger.info("Application startup completed")
        
        # 初始化AI分析服务
        ai_service = AIAnalystService()
        app.state.ai_service = ai_service
        logger.info("AI Analyst Service initialized")
        
        # TODO: 初始化数据库连接
        # TODO: 初始化Redis连接
        # TODO: 预热AI模型
        
        logger.info("Application startup completed")
        
    except Exception as e:
        logger.error(f"Failed to start application: {e}")
        raise
    
    yield
    
    # 关闭时执行
    logger.info("Shutting down Trading Assistant AI Service...")
    
    # TODO: 清理资源
    # TODO: 关闭数据库连接
    # TODO: 关闭Redis连接
    
    logger.info("Application shutdown completed")


def create_app() -> FastAPI:
    """创建FastAPI应用"""
    settings = get_settings()
    
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="AI驱动的股票交易分析服务",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan
    )
    
    # 添加中间件
    setup_middleware(app, settings)
    
    # 添加路由
    setup_routes(app)
    
    # 添加异常处理
    setup_exception_handlers(app)
    
    return app


def setup_middleware(app: FastAPI, settings):
    """设置中间件"""
    
    # CORS中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE"],
        allow_headers=["*"],
    )
    
    # 可信主机中间件（生产环境）
    if not settings.debug:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["*"]
        )
    
    # 请求日志中间件
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.time()
        
        # 记录请求
        logger.info(f"Request: {request.method} {request.url}")
        
        response = await call_next(request)
        
        # 记录响应
        process_time = time.time() - start_time
        logger.info(f"Response: {response.status_code} - {process_time:.3f}s")
        
        return response


def setup_routes(app: FastAPI):
    """设置路由"""
    
    # 健康检查
    app.include_router(
        health.router,
        prefix="/health",
        tags=["健康检查"]
    )
    
    # AI分析API
    app.include_router(
        analysis.router,
        prefix="/api/v1/analysis",
        tags=["AI分析"]
    )
    
    # 新的AI分析API
    app.include_router(
        ai_analysis_router,
        tags=["AI智能分析"]
    )
    
    # 策略引擎API
    app.include_router(
        strategy_router,
        tags=["策略引擎"]
    )
    
    # 根路径
    @app.get("/")
    async def root():
        return {
            "message": "Trading Assistant AI Service",
            "version": get_settings().app_version,
            "status": "running"
        }


def setup_exception_handlers(app: FastAPI):
    """设置异常处理器"""
    
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        logger.error(f"ValueError: {exc}")
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": "INVALID_INPUT",
                    "message": str(exc)
                }
            }
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_SERVER_ERROR",
                    "message": "An internal error occurred"
                }
            }
        )


# 创建应用实例
app = create_app()


if __name__ == "__main__":
    settings = get_settings()
    
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        workers=1 if settings.debug else settings.workers,
        log_level=settings.log_level.lower()
    )