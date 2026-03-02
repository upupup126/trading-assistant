"""
策略 API 路由 - 回测 + 信号检查 + 技术指标
"""

import logging
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.market_data import MarketDataService
from app.services.strategy_engine import (
    build_indicators,
    check_latest_signals,
    compute_config_hash,
    get_cached_backtest,
    run_backtest,
    save_backtest_cache,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/strategy", tags=["策略引擎"])


# ============ 请求模型 ============

class BacktestRequestModel(BaseModel):
    stock_symbol: str
    builtin_strategy_ids: List[str] = []
    custom_rules: str = "[]"
    start_date: str = ""
    end_date: str = ""
    initial_capital: float = 100000.0


class CheckSignalItem(BaseModel):
    strategy_id: str
    user_id: str
    stock_symbol: str
    stock_name: str = ""
    builtin_strategy_ids: List[str] = []
    custom_rules: str = "[]"


class CheckSignalsRequest(BaseModel):
    strategies: List[CheckSignalItem]


# ============ 回测 ============

@router.post("/backtest")
async def backtest(req: BacktestRequestModel):
    """执行策略回测"""
    has_builtin = len(req.builtin_strategy_ids) > 0
    has_custom = req.custom_rules not in ("", "[]")
    if not has_builtin and not has_custom:
        raise HTTPException(status_code=400, detail="至少需要选择一个内置策略或填写自定义规则")

    # 检查缓存
    config_hash = compute_config_hash(req.stock_symbol, req.builtin_strategy_ids, req.custom_rules, req.start_date, req.end_date, req.initial_capital)
    cached = await get_cached_backtest(req.stock_symbol, config_hash)
    if cached:
        logger.info(f"Backtest cache hit for {req.stock_symbol}")
        return cached

    # 获取K线数据
    market_svc = MarketDataService()
    async with market_svc:
        kline_data = await market_svc.get_historical_data(req.stock_symbol, period="daily")

    if not kline_data or len(kline_data) < 60:
        raise HTTPException(status_code=400, detail=f"历史数据不足（需要至少60个交易日），当前: {len(kline_data) if kline_data else 0}")

    df = pd.DataFrame(kline_data)

    # 执行回测（传递自定义规则和日期范围）
    result = run_backtest(
        df, req.builtin_strategy_ids,
        custom_rules=req.custom_rules,
        initial_capital=req.initial_capital,
        start_date=req.start_date,
        end_date=req.end_date,
    )

    # 缓存结果
    await save_backtest_cache(
        req.stock_symbol,
        config_hash,
        {"builtin_strategy_ids": req.builtin_strategy_ids, "custom_rules": req.custom_rules, "start_date": req.start_date, "end_date": req.end_date, "initial_capital": req.initial_capital},
        result,
    )

    return result


# ============ 信号检查（定时任务调用） ============

@router.post("/check-signals")
async def check_signals(req: CheckSignalsRequest):
    """批量检查策略信号"""
    all_signals = []

    for item in req.strategies:
        if not item.builtin_strategy_ids:
            continue

        sigs = await check_latest_signals(item.stock_symbol, item.builtin_strategy_ids)

        for sig in sigs:
            all_signals.append({
                "strategy_id": item.strategy_id,
                "user_id": item.user_id,
                "stock_symbol": item.stock_symbol,
                "stock_name": item.stock_name,
                **sig,
            })

    return {"signals": all_signals}


# ============ 技术指标查询 ============

@router.get("/indicators/{symbol}")
async def get_indicators(symbol: str):
    """获取股票技术指标数据"""
    market_svc = MarketDataService()
    async with market_svc:
        kline_data = await market_svc.get_historical_data(symbol, period="daily")

    if not kline_data:
        raise HTTPException(status_code=404, detail="未找到该股票的K线数据")

    df = pd.DataFrame(kline_data)
    df = build_indicators(df)

    # 取最近30条数据返回
    recent = df.tail(30)
    result = []
    for _, row in recent.iterrows():
        item = {
            "date": row["date"],
            "close": round(float(row["close"]), 2),
            "ma5": round(float(row["ma5"]), 2) if pd.notna(row["ma5"]) else None,
            "ma10": round(float(row["ma10"]), 2) if pd.notna(row["ma10"]) else None,
            "ma20": round(float(row["ma20"]), 2) if pd.notna(row["ma20"]) else None,
            "ma60": round(float(row["ma60"]), 2) if pd.notna(row["ma60"]) else None,
            "dif": round(float(row["dif"]), 2) if pd.notna(row["dif"]) else None,
            "dea": round(float(row["dea"]), 2) if pd.notna(row["dea"]) else None,
            "macd": round(float(row["macd_hist"]), 2) if pd.notna(row["macd_hist"]) else None,
            "k": round(float(row["k"]), 2) if pd.notna(row["k"]) else None,
            "d": round(float(row["d"]), 2) if pd.notna(row["d"]) else None,
            "j": round(float(row["j"]), 2) if pd.notna(row["j"]) else None,
            "boll_upper": round(float(row["boll_upper"]), 2) if pd.notna(row["boll_upper"]) else None,
            "boll_mid": round(float(row["boll_mid"]), 2) if pd.notna(row["boll_mid"]) else None,
            "boll_lower": round(float(row["boll_lower"]), 2) if pd.notna(row["boll_lower"]) else None,
        }
        result.append(item)

    return {"success": True, "data": result}
