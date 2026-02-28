#!/usr/bin/env python3
"""
Python AI服务启动脚本
"""

import os
import sys
import logging
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

def main():
    """启动AI服务"""
    
    # 设置环境变量（如果没有设置的话）
    if not os.getenv("OPENAI_API_KEY"):
        print("警告: 未设置 OPENAI_API_KEY 环境变量，AI功能将使用模拟数据")
    
    # 配置日志
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    logger = logging.getLogger(__name__)
    logger.info("启动 Trading Assistant AI Service...")
    
    try:
        # 导入并运行应用
        import uvicorn
        from app.main import app
        from app.config import get_settings
        
        settings = get_settings()
        
        logger.info(f"服务将在 http://{settings.host}:{settings.port} 启动")
        logger.info(f"调试模式: {settings.debug}")
        logger.info(f"API文档: http://{settings.host}:{settings.port}/docs")
        
        uvicorn.run(
            app,
            host=settings.host,
            port=settings.port,
            reload=settings.debug,
            workers=1 if settings.debug else settings.workers,
            log_level=settings.log_level.lower()
        )
        
    except KeyboardInterrupt:
        logger.info("收到停止信号，正在关闭服务...")
    except Exception as e:
        logger.error(f"启动失败: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()