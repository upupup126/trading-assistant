"""
基本面与资金流数据服务
基于 AKShare 获取免费 A 股基本面财务数据和历史资金流向
无需注册/付费，数据来源为东方财富
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

# 内存缓存
_cache: Dict[str, tuple] = {}
_CACHE_TTL_FUNDAMENTAL = 3600  # 基本面缓存1小时
_CACHE_TTL_FUND_FLOW = 300  # 资金流缓存5分钟


def _get_cache(key: str, ttl: int) -> Optional[Any]:
    """获取缓存数据"""
    if key in _cache:
        data, ts = _cache[key]
        if (datetime.now() - ts).total_seconds() < ttl:
            return data
        del _cache[key]
    return None


def _set_cache(key: str, data: Any):
    """设置缓存"""
    _cache[key] = (data, datetime.now())


async def get_stock_fundamentals(symbol: str) -> Dict[str, Any]:
    """
    获取个股基本面财务指标
    返回：PE/PB/ROE/营收/净利润/毛利率/负债率等

    参数 symbol: 股票代码如 "600519" 或 "000858"（纯数字，不含交易所后缀）
    """
    # 去除可能的交易所后缀
    pure_code = symbol.split(".")[0] if "." in symbol else symbol
    pure_code = pure_code.replace("sh", "").replace("sz", "")

    cache_key = f"fundamental_{pure_code}"
    cached = _get_cache(cache_key, _CACHE_TTL_FUNDAMENTAL)
    if cached:
        return cached

    result = {
        "symbol": symbol,
        "financials": {},
        "error": None,
    }

    try:
        import akshare as ak

        # 获取财务分析指标（杜邦分析等）
        try:
            df = ak.stock_financial_analysis_indicator(symbol=pure_code)
            if df is not None and not df.empty:
                # 取最新一期数据
                latest = df.iloc[0]
                result["financials"]["report_date"] = str(latest.get("日期", ""))
                result["financials"]["roe"] = _safe_float(latest.get("净资产收益率(%)"))
                result["financials"]["gross_margin"] = _safe_float(latest.get("销售毛利率(%)"))
                result["financials"]["net_margin"] = _safe_float(latest.get("销售净利率(%)"))
                result["financials"]["debt_ratio"] = _safe_float(latest.get("资产负债率(%)"))
                result["financials"]["current_ratio"] = _safe_float(latest.get("流动比率"))
        except Exception as e:
            logger.warning(f"获取财务分析指标失败 {pure_code}: {e}")

        # 获取业绩报表（营收、净利润、EPS）
        try:
            # 尝试获取最近的业绩报表
            import pandas as pd
            df_perf = ak.stock_yjbb_em(date="")  # 最新一期
            if df_perf is not None and not df_perf.empty:
                stock_row = df_perf[df_perf["股票代码"] == pure_code]
                if not stock_row.empty:
                    row = stock_row.iloc[0]
                    result["financials"]["revenue"] = _safe_float(row.get("营业收入-营业收入"))
                    result["financials"]["revenue_yoy"] = _safe_float(row.get("营业收入-同比增长"))
                    result["financials"]["net_profit"] = _safe_float(row.get("净利润-净利润"))
                    result["financials"]["net_profit_yoy"] = _safe_float(row.get("净利润-同比增长"))
                    result["financials"]["eps"] = _safe_float(row.get("每股收益"))
        except Exception as e:
            logger.warning(f"获取业绩报表失败 {pure_code}: {e}")

        # 获取实时估值指标（PE/PB）
        try:
            df_val = ak.stock_a_indicator_lg(symbol=pure_code)
            if df_val is not None and not df_val.empty:
                latest_val = df_val.iloc[-1]
                result["financials"]["pe_ttm"] = _safe_float(latest_val.get("pe_ttm"))
                result["financials"]["pb"] = _safe_float(latest_val.get("pb"))
                result["financials"]["ps_ttm"] = _safe_float(latest_val.get("ps_ttm"))
                result["financials"]["total_mv"] = _safe_float(latest_val.get("total_mv"))  # 总市值（亿）
        except Exception as e:
            logger.warning(f"获取估值指标失败 {pure_code}: {e}")

    except ImportError:
        result["error"] = "akshare 未安装，请运行: pip install akshare"
        logger.error("akshare 未安装")
    except Exception as e:
        result["error"] = f"获取基本面数据失败: {str(e)}"
        logger.error(f"获取基本面数据失败 {pure_code}: {e}")

    _set_cache(cache_key, result)
    return result


async def get_fund_flow_history(symbol: str) -> Dict[str, Any]:
    """
    获取个股近100日历史资金流向
    返回：每日主力/散户/超大单/大单/中单/小单 净流入

    参数 symbol: 股票代码如 "600519" 或 "000858"
    """
    pure_code = symbol.split(".")[0] if "." in symbol else symbol
    pure_code = pure_code.replace("sh", "").replace("sz", "")

    # 判断市场
    if pure_code.startswith(("6", "5", "9")):
        market = "sh"
    else:
        market = "sz"

    cache_key = f"fund_flow_{pure_code}"
    cached = _get_cache(cache_key, _CACHE_TTL_FUND_FLOW)
    if cached:
        return cached

    result = {
        "symbol": symbol,
        "market": market,
        "flow_data": [],
        "summary": {},
        "error": None,
    }

    try:
        import akshare as ak

        df = ak.stock_individual_fund_flow(stock=pure_code, market=market)
        if df is not None and not df.empty:
            # 转换为列表格式（最近30条）
            recent = df.tail(30)
            flow_list = []
            for _, row in recent.iterrows():
                flow_list.append({
                    "date": str(row.get("日期", "")),
                    "main_net_inflow": _safe_float(row.get("主力净流入-净额")),
                    "main_net_pct": _safe_float(row.get("主力净流入-净占比")),
                    "large_net_inflow": _safe_float(row.get("大单净流入-净额")),
                    "xlarge_net_inflow": _safe_float(row.get("超大单净流入-净额")),
                    "mid_net_inflow": _safe_float(row.get("中单净流入-净额")),
                    "small_net_inflow": _safe_float(row.get("小单净流入-净额")),
                    "close": _safe_float(row.get("收盘价")),
                    "change_pct": _safe_float(row.get("涨跌幅")),
                })
            result["flow_data"] = flow_list

            # 汇总统计
            if flow_list:
                main_flows = [d["main_net_inflow"] for d in flow_list if d["main_net_inflow"] is not None]
                if main_flows:
                    result["summary"] = {
                        "days_count": len(flow_list),
                        "total_main_net": round(sum(main_flows), 2),
                        "avg_main_net": round(sum(main_flows) / len(main_flows), 2),
                        "positive_days": sum(1 for x in main_flows if x > 0),
                        "negative_days": sum(1 for x in main_flows if x < 0),
                        "max_inflow": round(max(main_flows), 2),
                        "max_outflow": round(min(main_flows), 2),
                        "recent_5d_net": round(sum(main_flows[-5:]), 2) if len(main_flows) >= 5 else None,
                        "recent_10d_net": round(sum(main_flows[-10:]), 2) if len(main_flows) >= 10 else None,
                    }

    except ImportError:
        result["error"] = "akshare 未安装，请运行: pip install akshare"
        logger.error("akshare 未安装")
    except Exception as e:
        result["error"] = f"获取资金流向数据失败: {str(e)}"
        logger.error(f"获取资金流向数据失败 {pure_code}: {e}")

    _set_cache(cache_key, result)
    return result


def _safe_float(val) -> Optional[float]:
    """安全转换为 float，处理各种异常值"""
    if val is None:
        return None
    try:
        import pandas as pd
        if pd.isna(val):
            return None
        f = float(val)
        if f != f:  # NaN check
            return None
        return round(f, 4)
    except (ValueError, TypeError):
        return None
