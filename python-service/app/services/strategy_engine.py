"""
策略引擎 - 技术指标计算 + 回测 + 信号检查
"""

import hashlib
import json
import logging
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from app.services.market_data import MarketDataService, get_db_pool

logger = logging.getLogger(__name__)


# ============================================================
#  技术指标计算
# ============================================================

def calc_ma(closes: pd.Series, period: int) -> pd.Series:
    return closes.rolling(window=period, min_periods=period).mean()


def calc_ema(closes: pd.Series, period: int) -> pd.Series:
    return closes.ewm(span=period, adjust=False).mean()


def calc_macd(closes: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    ema_fast = calc_ema(closes, fast)
    ema_slow = calc_ema(closes, slow)
    dif = ema_fast - ema_slow
    dea = dif.ewm(span=signal, adjust=False).mean()
    macd_hist = (dif - dea) * 2
    return dif, dea, macd_hist


def calc_kdj(highs: pd.Series, lows: pd.Series, closes: pd.Series, period: int = 9):
    low_min = lows.rolling(window=period, min_periods=period).min()
    high_max = highs.rolling(window=period, min_periods=period).max()
    rsv = (closes - low_min) / (high_max - low_min + 1e-10) * 100

    k = pd.Series(np.nan, index=closes.index)
    d = pd.Series(np.nan, index=closes.index)

    first_valid = rsv.first_valid_index()
    if first_valid is None:
        return k, d, k - d

    k.iloc[first_valid] = 50.0
    d.iloc[first_valid] = 50.0

    for i in range(first_valid + 1, len(closes)):
        if np.isnan(rsv.iloc[i]):
            k.iloc[i] = k.iloc[i - 1]
            d.iloc[i] = d.iloc[i - 1]
        else:
            k.iloc[i] = 2 / 3 * k.iloc[i - 1] + 1 / 3 * rsv.iloc[i]
            d.iloc[i] = 2 / 3 * d.iloc[i - 1] + 1 / 3 * k.iloc[i]

    j = 3 * k - 2 * d
    return k, d, j


def calc_boll(closes: pd.Series, period: int = 20, nbdev: int = 2):
    mid = calc_ma(closes, period)
    std = closes.rolling(window=period, min_periods=period).std()
    upper = mid + nbdev * std
    lower = mid - nbdev * std
    return upper, mid, lower


def calc_volume_ma(volumes: pd.Series, period: int = 20) -> pd.Series:
    return volumes.rolling(window=period, min_periods=period).mean()


def build_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """为 DataFrame 计算全套技术指标"""
    c = df["close"]
    h = df["high"]
    l = df["low"]
    v = df["volume"].astype(float)

    # 均线
    for p in [5, 10, 20, 60, 250]:
        df[f"ma{p}"] = calc_ma(c, p)

    # MACD
    df["dif"], df["dea"], df["macd_hist"] = calc_macd(c)

    # KDJ
    df["k"], df["d"], df["j"] = calc_kdj(h, l, c)

    # BOLL
    df["boll_upper"], df["boll_mid"], df["boll_lower"] = calc_boll(c)

    # 量能
    df["vol_ma20"] = calc_volume_ma(v, 20)

    return df


# ============================================================
#  内置策略信号生成
# ============================================================

def _cross_up(series_a: pd.Series, series_b: pd.Series, idx: int) -> bool:
    """判断 series_a 在 idx 位置上穿 series_b"""
    if idx < 1:
        return False
    prev_a, prev_b = series_a.iloc[idx - 1], series_b.iloc[idx - 1]
    curr_a, curr_b = series_a.iloc[idx], series_b.iloc[idx]
    if any(np.isnan(x) for x in [prev_a, prev_b, curr_a, curr_b]):
        return False
    return prev_a <= prev_b and curr_a > curr_b


def _cross_down(series_a: pd.Series, series_b: pd.Series, idx: int) -> bool:
    if idx < 1:
        return False
    prev_a, prev_b = series_a.iloc[idx - 1], series_b.iloc[idx - 1]
    curr_a, curr_b = series_a.iloc[idx], series_b.iloc[idx]
    if any(np.isnan(x) for x in [prev_a, prev_b, curr_a, curr_b]):
        return False
    return prev_a >= prev_b and curr_a < curr_b


def _calc_weekly_macd_signals(df: pd.DataFrame) -> pd.Series:
    """
    将日K聚合为周K，计算周线MACD金叉/死叉，然后将信号映射回日线。
    信号出现在每周最后一个交易日（即该周确认收盘后才触发）。
    """
    signals = pd.Series(0, index=df.index)

    if "date" not in df.columns or len(df) < 30:
        return signals

    # 1. 按 ISO 周聚合日K为周K
    dates = pd.to_datetime(df["date"])
    df_temp = df.copy()
    df_temp["_dt"] = dates
    df_temp["_week_key"] = dates.dt.isocalendar().year.astype(str) + "-W" + dates.dt.isocalendar().week.astype(str).str.zfill(2)

    week_groups = df_temp.groupby("_week_key", sort=False)
    weekly_data = []
    week_last_idx = []  # 每周最后一个交易日在原 df 中的 index

    for week_key, group in week_groups:
        weekly_data.append({
            "close": group["close"].iloc[-1],
            "open": group["open"].iloc[0],
            "high": group["high"].max(),
            "low": group["low"].min(),
        })
        week_last_idx.append(group.index[-1])

    if len(weekly_data) < 10:
        return signals

    # 2. 计算周线 MACD
    weekly_closes = pd.Series([w["close"] for w in weekly_data])
    w_dif, w_dea, w_hist = calc_macd(weekly_closes)

    # 3. 检测周线金叉/死叉，映射到对应周的最后一个交易日
    for wi in range(1, len(weekly_closes)):
        if _cross_up(w_dif, w_dea, wi):
            day_idx = week_last_idx[wi]
            signals.iloc[day_idx] = 1
        elif _cross_down(w_dif, w_dea, wi):
            day_idx = week_last_idx[wi]
            signals.iloc[day_idx] = -1

    return signals


def generate_signals(df: pd.DataFrame, strategy_id: str) -> pd.DataFrame:
    """
    根据策略 ID 生成买卖信号列。
    返回的 DataFrame 多出 'signal' 列：1=买入, -1=卖出, 0=无信号
    """
    n = len(df)
    signals = pd.Series(0, index=df.index)

    for i in range(1, n):
        if strategy_id == "short_ma5_cross":
            if _cross_up(df["ma5"], df["ma10"], i):
                signals.iloc[i] = 1
            elif _cross_down(df["ma5"], df["ma10"], i):
                signals.iloc[i] = -1

        elif strategy_id == "short_macd_diverge":
            if _cross_up(df["dif"], df["dea"], i) and df["macd_hist"].iloc[i] > 0:
                signals.iloc[i] = 1
            elif _cross_down(df["dif"], df["dea"], i) and df["macd_hist"].iloc[i] < 0:
                signals.iloc[i] = -1

        elif strategy_id == "short_kdj_oversold":
            k_val = df["k"].iloc[i]
            if not np.isnan(k_val):
                if k_val < 20 and _cross_up(df["k"], df["d"], i):
                    signals.iloc[i] = 1
                elif k_val > 80 and _cross_down(df["k"], df["d"], i):
                    signals.iloc[i] = -1

        elif strategy_id == "mid_ma20_trend":
            close = df["close"].iloc[i]
            ma20 = df["ma20"].iloc[i]
            prev_ma20 = df["ma20"].iloc[i - 1] if i > 0 else np.nan
            if not any(np.isnan(x) for x in [close, ma20, prev_ma20]):
                if df["close"].iloc[i - 1] <= df["ma20"].iloc[i - 1] and close > ma20 and ma20 > prev_ma20:
                    signals.iloc[i] = 1
                elif df["close"].iloc[i - 1] >= df["ma20"].iloc[i - 1] and close < ma20:
                    signals.iloc[i] = -1

        elif strategy_id == "mid_boll_break":
            close = df["close"].iloc[i]
            lower = df["boll_lower"].iloc[i]
            upper = df["boll_upper"].iloc[i]
            prev_close = df["close"].iloc[i - 1]
            prev_lower = df["boll_lower"].iloc[i - 1]
            if not any(np.isnan(x) for x in [close, lower, upper, prev_close, prev_lower]):
                if prev_close <= prev_lower and close > lower:
                    signals.iloc[i] = 1
                prev_upper = df["boll_upper"].iloc[i - 1]
                if not np.isnan(prev_upper) and prev_close >= prev_upper and close < upper:
                    signals.iloc[i] = -1

        elif strategy_id == "mid_vol_price":
            close = df["close"].iloc[i]
            ma20 = df["ma20"].iloc[i]
            vol = df["volume"].iloc[i]
            vol_ma = df["vol_ma20"].iloc[i]
            prev_close = df["close"].iloc[i - 1]
            prev_ma20 = df["ma20"].iloc[i - 1]
            if not any(np.isnan(x) for x in [close, ma20, vol, vol_ma, prev_close, prev_ma20]):
                if prev_close <= prev_ma20 and close > ma20 and vol > vol_ma * 1.5:
                    signals.iloc[i] = 1
                elif prev_close >= prev_ma20 and close < ma20 and vol < vol_ma:
                    signals.iloc[i] = -1

        elif strategy_id == "long_ma_arrange":
            vals = [df[f"ma{p}"].iloc[i] for p in [5, 10, 20, 60]]
            prev_vals = [df[f"ma{p}"].iloc[i - 1] for p in [5, 10, 20, 60]]
            if not any(np.isnan(x) for x in vals + prev_vals):
                is_bull = vals[0] > vals[1] > vals[2] > vals[3]
                was_bull = prev_vals[0] > prev_vals[1] > prev_vals[2] > prev_vals[3]
                if is_bull and not was_bull:
                    signals.iloc[i] = 1
                elif was_bull and not is_bull:
                    signals.iloc[i] = -1

        elif strategy_id == "long_ma250_support":
            close = df["close"].iloc[i]
            ma250 = df["ma250"].iloc[i]
            prev_close = df["close"].iloc[i - 1]
            if not any(np.isnan(x) for x in [close, ma250, prev_close]):
                if prev_close <= ma250 * 1.02 and close > ma250 and close > prev_close:
                    signals.iloc[i] = 1
                # 连续3日收盘低于MA250
                if i >= 3:
                    below_count = sum(
                        1 for j in range(i - 2, i + 1)
                        if not np.isnan(df["ma250"].iloc[j]) and df["close"].iloc[j] < df["ma250"].iloc[j]
                    )
                    if below_count == 3 and df["close"].iloc[i - 3] >= df["ma250"].iloc[i - 3] if i >= 3 and not np.isnan(df["ma250"].iloc[i - 3]) else False:
                        signals.iloc[i] = -1

        elif strategy_id == "long_macd_weekly":
            # 周线 MACD：将日K聚合为周K，计算周线MACD，再映射回日线
            # 构建周K数据
            if i == 1:
                # 只在第一次循环时计算周线MACD信号，避免重复计算
                weekly_signals = _calc_weekly_macd_signals(df)
                df["_weekly_macd_signal"] = weekly_signals
            if "_weekly_macd_signal" in df.columns:
                signals.iloc[i] = df["_weekly_macd_signal"].iloc[i]

    df["signal"] = signals
    return df


# ============================================================
#  策略名称映射
# ============================================================

STRATEGY_NAMES = {
    "short_ma5_cross": "5日均线交叉",
    "short_macd_diverge": "MACD金叉死叉",
    "short_kdj_oversold": "KDJ超买超卖",
    "mid_ma20_trend": "20日均线趋势",
    "mid_boll_break": "布林带突破",
    "mid_vol_price": "量价配合",
    "long_ma_arrange": "多头排列",
    "long_ma250_support": "年线支撑",
    "long_macd_weekly": "周线MACD趋势",
    # 仓位管理策略
    "pos_pyramid_buy": "金字塔建仓",
    "pos_batch_buy": "均匀分批建仓",
    "pos_dynamic_rebalance": "动态再平衡",
}


def get_strategy_name(strategy_id: str) -> str:
    return STRATEGY_NAMES.get(strategy_id, strategy_id)


# 仓位管理策略 ID 集合
POSITION_STRATEGY_IDS = {"pos_pyramid_buy", "pos_batch_buy", "pos_dynamic_rebalance"}


def get_position_config(strategy_id: str) -> Dict[str, Any]:
    """
    获取仓位管理策略的配置参数。
    返回 dict: { "tranches": int, "ratios": list[float] }
    - tranches: 分几批建仓
    - ratios: 每批占总仓位的比例(相对于剩余可用资金)
    """
    if strategy_id == "pos_pyramid_buy":
        # 金字塔建仓: 首次50%, 二次30%, 三次20%
        return {"tranches": 3, "ratios": [0.50, 0.30, 0.20], "sell_tranches": 3, "sell_ratios": [0.50, 0.30, 0.20]}
    elif strategy_id == "pos_batch_buy":
        # 均匀分批建仓: 每次1/3
        return {"tranches": 3, "ratios": [1/3, 1/3, 1/3], "sell_tranches": 3, "sell_ratios": [1/3, 1/3, 1/3]}
    elif strategy_id == "pos_dynamic_rebalance":
        # 动态再平衡: 首次60%, 二次40%; 卖出也分两次
        return {"tranches": 2, "ratios": [0.60, 0.40], "sell_tranches": 2, "sell_ratios": [0.60, 0.40]}
    return {"tranches": 1, "ratios": [1.0], "sell_tranches": 1, "sell_ratios": [1.0]}


# ============================================================
#  自定义规则解析
# ============================================================

import re

def parse_custom_rules(custom_rules: str) -> Dict[str, Any]:
    """
    解析用户输入的自定义规则文本，提取可执行的规则参数。
    支持的规则类型：
      - 止损：止损-5%、止损 5%、stop loss 5%
      - 止盈：止盈10%、止盈 10%、take profit 10%
      - 最大持有天数：持有N天、最多持有N天
    返回 dict: { "stop_loss": float|None, "take_profit": float|None, "max_hold_days": int|None, "raw_text": str }
    """
    rules = {
        "stop_loss": None,
        "take_profit": None,
        "max_hold_days": None,
        "raw_text": custom_rules.strip() if custom_rules else "",
    }

    if not custom_rules or custom_rules in ("[]", ""):
        return rules

    text = custom_rules.lower().replace("：", ":").replace("，", ",").replace("%", "%")

    # 止损规则: 匹配 "止损-5%", "止损5%", "止损 -5%", "stop loss 5%", "-5%止损"
    sl_patterns = [
        r"止损[:\s]*[-]?(\d+(?:\.\d+)?)\s*%",
        r"stop\s*loss[:\s]*[-]?(\d+(?:\.\d+)?)\s*%",
        r"[-](\d+(?:\.\d+)?)\s*%\s*止损",
        r"亏损[超过达到]*[:\s]*[-]?(\d+(?:\.\d+)?)\s*%",
        r"跌[破幅]*[:\s]*[-]?(\d+(?:\.\d+)?)\s*%",
    ]
    for pat in sl_patterns:
        m = re.search(pat, text)
        if m:
            rules["stop_loss"] = float(m.group(1))
            break

    # 止盈规则: 匹配 "止盈10%", "take profit 10%", "收益达到10%"
    tp_patterns = [
        r"止盈[:\s]*(\d+(?:\.\d+)?)\s*%",
        r"take\s*profit[:\s]*(\d+(?:\.\d+)?)\s*%",
        r"收益[率]?[超过达到]*[:\s]*(\d+(?:\.\d+)?)\s*%",
        r"盈利[超过达到]*[:\s]*(\d+(?:\.\d+)?)\s*%",
        r"涨[幅]*[超过达到]*[:\s]*(\d+(?:\.\d+)?)\s*%",
    ]
    for pat in tp_patterns:
        m = re.search(pat, text)
        if m:
            rules["take_profit"] = float(m.group(1))
            break

    # 最大持有天数: 匹配 "持有30天", "最多持有30天", "持有期30天"
    hd_patterns = [
        r"(?:最多|最长)?持有[期]?\s*(\d+)\s*[天日个交易]",
        r"(\d+)\s*[天日].*(?:清仓|卖出|平仓)",
    ]
    for pat in hd_patterns:
        m = re.search(pat, text)
        if m:
            rules["max_hold_days"] = int(m.group(1))
            break

    return rules


# ============================================================
#  回测引擎
# ============================================================

def run_backtest(
    df: pd.DataFrame,
    strategy_ids: List[str],
    custom_rules: str = "",
    initial_capital: float = 100000.0,
    start_date: str = "",
    end_date: str = "",
    commission_rate: float = 0.00025,
    stamp_tax_rate: float = 0.001,
    min_commission: float = 5.0,
) -> Dict[str, Any]:
    """
    执行回测。将多个策略的信号合并（任一策略触发即执行）。
    同时应用自定义规则（止损/止盈/最大持有天数）。
    支持仓位管理策略（分批建仓/加仓/减仓/清仓）。
    支持按时间段过滤回测范围。

    交易成本参数：
      commission_rate: 佣金费率，默认万2.5（买卖双边各收）
      stamp_tax_rate: 印花税费率，默认千1（仅卖出时收取）
      min_commission: 单笔最低佣金，默认5元
    返回回测统计 + 交易明细 + K线数据（含买卖点标记）。
    """

    def _calc_buy_cost(amount: float) -> float:
        """计算买入交易成本（佣金）"""
        commission = max(amount * commission_rate, min_commission)
        return commission

    def _calc_sell_cost(amount: float) -> float:
        """计算卖出交易成本（佣金 + 印花税）"""
        commission = max(amount * commission_rate, min_commission)
        stamp_tax = amount * stamp_tax_rate
        return commission + stamp_tax
    if df.empty:
        return {"error": "No data available for backtest"}

    df = build_indicators(df.copy())

    # 按时间段过滤（需要在计算指标之后过滤，保证指标计算正确）
    backtest_start_idx = 0
    backtest_end_idx = len(df) - 1
    if "date" in df.columns:
        if start_date:
            mask = df["date"] >= start_date
            if mask.any():
                backtest_start_idx = mask.idxmax()
        if end_date:
            mask = df["date"] <= end_date
            if mask.any():
                backtest_end_idx = mask[::-1].idxmax()

    # 解析自定义规则
    parsed_rules = parse_custom_rules(custom_rules)
    stop_loss = parsed_rules["stop_loss"]
    take_profit = parsed_rules["take_profit"]
    max_hold_days = parsed_rules["max_hold_days"]

    # 分离仓位管理策略和信号策略
    signal_strategy_ids = [sid for sid in strategy_ids if sid not in POSITION_STRATEGY_IDS]
    pos_strategy_ids = [sid for sid in strategy_ids if sid in POSITION_STRATEGY_IDS]
    use_position_management = len(pos_strategy_ids) > 0
    pos_config = get_position_config(pos_strategy_ids[0]) if use_position_management else None

    # 合并多策略信号
    combined = pd.Series(0, index=df.index)
    signal_sources = {}  # idx -> strategy_id

    for sid in signal_strategy_ids:
        df_with_sig = generate_signals(df.copy(), sid)
        for i in range(len(df_with_sig)):
            sig = df_with_sig["signal"].iloc[i]
            if sig != 0 and combined.iloc[i] == 0:
                combined.iloc[i] = sig
                signal_sources[i] = sid

    df["signal"] = combined

    # 模拟交易
    trades: List[Dict] = []
    capital = initial_capital
    available_cash = initial_capital
    total_shares = 0  # 当前持有总股数
    avg_cost = 0.0  # 平均持仓成本
    entry_date_first = ""  # 第一次建仓日期
    entry_idx_first = 0  # 第一次建仓 index
    entry_strategy_name = ""

    # 仓位管理状态
    buy_tranche = 0  # 当前买入到第几批
    sell_tranche = 0  # 当前卖出到第几批

    for i in range(backtest_start_idx, backtest_end_idx + 1):
        sig = df["signal"].iloc[i]
        price = df["close"].iloc[i]
        high_price = df["high"].iloc[i]
        low_price = df["low"].iloc[i]
        d = df["date"].iloc[i] if "date" in df.columns else str(i)

        if use_position_management:
            # ======== 仓位管理模式 ========
            if sig == 1 and buy_tranche < pos_config["tranches"]:
                # 买入信号 - 分批建仓/加仓
                ratio = pos_config["ratios"][buy_tranche]
                invest_amount = available_cash * ratio if buy_tranche == 0 else available_cash * ratio
                # 对于非首次买入，ratio是相对于剩余可用资金
                if buy_tranche > 0:
                    invest_amount = available_cash * ratio

                shares_to_buy = int(invest_amount / price / 100) * 100  # A股整手
                if shares_to_buy <= 0:
                    shares_to_buy = 100  # 最少1手
                actual_cost = shares_to_buy * price

                if actual_cost > available_cash:
                    shares_to_buy = int(available_cash / price / 100) * 100
                    actual_cost = shares_to_buy * price

                if shares_to_buy > 0:
                    # 确定仓位动作类型
                    if total_shares == 0:
                        action_type = "建仓"
                        entry_date_first = d
                        entry_idx_first = i
                    else:
                        action_type = "加仓"

                    src_id = signal_sources.get(i, "")
                    entry_strategy_name = get_strategy_name(src_id) if src_id else "自定义规则"
                    pos_name = get_strategy_name(pos_strategy_ids[0])

                    # 更新平均成本（含交易成本）
                    buy_fee = _calc_buy_cost(actual_cost)
                    total_cost_before = avg_cost * total_shares
                    total_shares += shares_to_buy
                    avg_cost = (total_cost_before + actual_cost + buy_fee) / total_shares
                    available_cash -= (actual_cost + buy_fee)
                    buy_tranche += 1

                    df.at[df.index[i], "signal"] = 1

                    total_assets = available_cash + total_shares * price
                    position_ratio = round((total_shares * price) / total_assets * 100, 2) if total_assets > 0 else 0
                    trades.append({
                        "entry_date": d,
                        "exit_date": "",
                        "entry_price": round(price, 2),
                        "exit_price": 0,
                        "pnl_pct": 0,
                        "hold_days": 0,
                        "strategy": f"{entry_strategy_name} + {pos_name}",
                        "entry_strategy": entry_strategy_name,
                        "quantity": shares_to_buy,
                        "action_type": action_type,
                        "trade_direction": "BUY",
                        "amount": round(actual_cost, 2),
                        "position_ratio": position_ratio,
                    })

            elif total_shares > 0:
                # 持仓中，检查卖出条件
                current_pnl = (price - avg_cost) / avg_cost * 100
                hold_days = i - entry_idx_first
                exit_reason = ""
                force_clear_all = False

                # 止损检查（用最低价）
                if stop_loss is not None:
                    intraday_loss = (low_price - avg_cost) / avg_cost * 100
                    if intraday_loss <= -stop_loss:
                        exit_reason = f"止损(-{stop_loss}%)"
                        price = avg_cost * (1 - stop_loss / 100)
                        force_clear_all = True

                # 止盈检查（用最高价）
                if not exit_reason and take_profit is not None:
                    intraday_gain = (high_price - avg_cost) / avg_cost * 100
                    if intraday_gain >= take_profit:
                        exit_reason = f"止盈(+{take_profit}%)"
                        price = avg_cost * (1 + take_profit / 100)
                        force_clear_all = True

                # 最大持有天数检查
                if not exit_reason and max_hold_days is not None and hold_days >= max_hold_days:
                    exit_reason = f"持有到期({max_hold_days}天)"
                    force_clear_all = True

                # 内置策略卖出信号
                if not exit_reason and sig == -1:
                    src_id = signal_sources.get(i, "")
                    exit_reason = get_strategy_name(src_id) if src_id else "策略卖出"

                if exit_reason:
                    if force_clear_all or sell_tranche >= pos_config["sell_tranches"] - 1:
                        # 清仓
                        shares_to_sell = total_shares
                        action_type = "清仓"
                    else:
                        # 分批减仓
                        sell_ratio = pos_config["sell_ratios"][sell_tranche]
                        shares_to_sell = int(total_shares * sell_ratio / 100) * 100
                        if shares_to_sell <= 0:
                            shares_to_sell = total_shares  # 股数太少直接全卖
                        if shares_to_sell >= total_shares:
                            shares_to_sell = total_shares
                            action_type = "清仓"
                        else:
                            action_type = "减仓"

                    pnl_pct = (price - avg_cost) / avg_cost * 100
                    sell_amount = shares_to_sell * price
                    sell_fee = _calc_sell_cost(sell_amount)
                    available_cash += (sell_amount - sell_fee)
                    total_shares -= shares_to_sell
                    sell_tranche += 1

                    df.at[df.index[i], "signal"] = -1

                    pos_name = get_strategy_name(pos_strategy_ids[0])
                    total_assets_after = available_cash + total_shares * price
                    position_ratio = round((total_shares * price) / total_assets_after * 100, 2) if total_assets_after > 0 else 0
                    trades.append({
                        "entry_date": entry_date_first,
                        "exit_date": d,
                        "entry_price": round(avg_cost, 2),
                        "exit_price": round(price, 2),
                        "pnl_pct": round(pnl_pct, 2),
                        "hold_days": hold_days,
                        "strategy": f"{exit_reason} + {pos_name}",
                        "entry_strategy": entry_strategy_name,
                        "quantity": shares_to_sell,
                        "action_type": action_type,
                        "trade_direction": "SELL",
                        "amount": round(sell_amount, 2),
                        "position_ratio": position_ratio,
                    })

                    if total_shares == 0:
                        # 完全清仓，重置状态
                        buy_tranche = 0
                        sell_tranche = 0
                        avg_cost = 0.0
                        entry_date_first = ""
                        entry_idx_first = 0

        else:
            # ======== 全仓模式（原有逻辑，增加数量标注） ========
            if sig == 1 and total_shares == 0:
                # 买入 - 建仓
                shares_to_buy = int(available_cash / price / 100) * 100
                if shares_to_buy <= 0:
                    shares_to_buy = 100
                actual_cost = shares_to_buy * price
                if actual_cost > available_cash:
                    shares_to_buy = int(available_cash / price / 100) * 100
                    actual_cost = shares_to_buy * price

                if shares_to_buy > 0:
                    total_shares = shares_to_buy
                    buy_fee = _calc_buy_cost(actual_cost)
                    avg_cost = (actual_cost + buy_fee) / shares_to_buy
                    available_cash -= (actual_cost + buy_fee)
                    entry_date_first = d
                    entry_idx_first = i
                    src_id = signal_sources.get(i, "")
                    entry_strategy_name = get_strategy_name(src_id) if src_id else "自定义规则"

                    total_assets = available_cash + total_shares * price
                    position_ratio = round((total_shares * price) / total_assets * 100, 2) if total_assets > 0 else 0
                    trades.append({
                        "entry_date": d,
                        "exit_date": "",
                        "entry_price": round(price, 2),
                        "exit_price": 0,
                        "pnl_pct": 0,
                        "hold_days": 0,
                        "strategy": "",
                        "entry_strategy": entry_strategy_name,
                        "quantity": shares_to_buy,
                        "action_type": "建仓",
                        "trade_direction": "BUY",
                        "amount": round(actual_cost, 2),
                        "position_ratio": position_ratio,
                    })

            elif total_shares > 0:
                # 持仓中，检查自定义规则触发卖出
                current_pnl = (price - avg_cost) / avg_cost * 100
                hold_days = i - entry_idx_first
                exit_reason = ""

                # 止损检查（用最低价）
                if stop_loss is not None:
                    intraday_loss = (low_price - avg_cost) / avg_cost * 100
                    if intraday_loss <= -stop_loss:
                        exit_reason = f"止损(-{stop_loss}%)"
                        price = avg_cost * (1 - stop_loss / 100)

                # 止盈检查（用最高价）
                if not exit_reason and take_profit is not None:
                    intraday_gain = (high_price - avg_cost) / avg_cost * 100
                    if intraday_gain >= take_profit:
                        exit_reason = f"止盈(+{take_profit}%)"
                        price = avg_cost * (1 + take_profit / 100)

                # 最大持有天数检查
                if not exit_reason and max_hold_days is not None and hold_days >= max_hold_days:
                    exit_reason = f"持有到期({max_hold_days}天)"

                # 内置策略卖出信号
                if not exit_reason and sig == -1:
                    src_id = signal_sources.get(i, "")
                    exit_reason = get_strategy_name(src_id) if src_id else "策略卖出"

                if exit_reason:
                    pnl_pct = (price - avg_cost) / avg_cost * 100
                    sell_amount = total_shares * price
                    sell_fee = _calc_sell_cost(sell_amount)
                    available_cash += (sell_amount - sell_fee)

                    df.at[df.index[i], "signal"] = -1

                    trades.append({
                        "entry_date": entry_date_first,
                        "exit_date": d,
                        "entry_price": round(avg_cost, 2),
                        "exit_price": round(price, 2),
                        "pnl_pct": round(pnl_pct, 2),
                        "hold_days": hold_days,
                        "strategy": exit_reason,
                        "entry_strategy": entry_strategy_name,
                        "quantity": total_shares,
                        "action_type": "清仓",
                        "trade_direction": "SELL",
                        "amount": round(sell_amount, 2),
                        "position_ratio": 0,
                    })

                    total_shares = 0
                    avg_cost = 0.0
                    entry_date_first = ""
                    entry_idx_first = 0

    # 计算最终资产（含未平仓持仓市值）
    if total_shares > 0 and len(df) > 0:
        last_price = df["close"].iloc[backtest_end_idx]
        capital = available_cash + total_shares * last_price

        # 追加"持有中"记录
        last_date = df["date"].iloc[backtest_end_idx] if "date" in df.columns else ""
        hold_days = backtest_end_idx - entry_idx_first
        unrealized_pnl = (last_price - avg_cost) / avg_cost * 100 if avg_cost > 0 else 0

        hold_market_value = total_shares * last_price
        total_assets_now = available_cash + hold_market_value
        position_ratio = round(hold_market_value / total_assets_now * 100, 2) if total_assets_now > 0 else 0
        trades.append({
            "entry_date": entry_date_first,
            "exit_date": last_date,
            "entry_price": round(avg_cost, 2),
            "exit_price": round(last_price, 2),
            "pnl_pct": round(unrealized_pnl, 2),
            "hold_days": hold_days,
            "strategy": "持有中 (未平仓)",
            "entry_strategy": entry_strategy_name,
            "quantity": total_shares,
            "action_type": "持有中",
            "trade_direction": "HOLD",
            "amount": round(hold_market_value, 2),
            "position_ratio": position_ratio,
        })
    else:
        capital = available_cash

    # =========================================================
    # 重建 K 线 signal 列：只保留与实际交易对应的买卖标记
    # =========================================================
    df["signal"] = 0  # 先清零
    # 构建日期到交易方向的映射（同一天可能有多笔交易，取最后一笔的方向）
    trade_signal_map: Dict[str, int] = {}
    for t in trades:
        if t["trade_direction"] == "BUY":
            trade_signal_map[t["entry_date"]] = 1
        elif t["trade_direction"] == "SELL" and t["exit_date"]:
            trade_signal_map[t["exit_date"]] = -1
    # 写回 signal 列
    if "date" in df.columns:
        for i in range(len(df)):
            d = df["date"].iloc[i]
            if d in trade_signal_map:
                df.at[df.index[i], "signal"] = trade_signal_map[d]

    # 统计（只统计已平仓的卖出交易）
    closed_trades = [t for t in trades if t["trade_direction"] == "SELL" and t["exit_price"] > 0]

    # 计算总交易成本
    total_trade_cost = 0.0
    for t in trades:
        if t["trade_direction"] == "BUY":
            total_trade_cost += _calc_buy_cost(t["amount"])
        elif t["trade_direction"] == "SELL":
            total_trade_cost += _calc_sell_cost(t["amount"])
    if closed_trades:
        pnls = [t["pnl_pct"] for t in closed_trades]
        wins = [p for p in pnls if p > 0]
        losses = [p for p in pnls if p <= 0]
        win_rate = len(wins) / len(pnls) * 100
        avg_return = sum(pnls) / len(pnls)
        avg_win = sum(wins) / len(wins) if wins else 0
        avg_loss = sum(losses) / len(losses) if losses else 0
        # 利润因子 = 总盈利 / 总亏损绝对值
        total_win_amount = sum(wins) if wins else 0
        total_loss_amount = abs(sum(losses)) if losses else 0
        profit_factor = total_win_amount / total_loss_amount if total_loss_amount != 0 else float("inf")

        # 最大回撤
        equity_curve = [initial_capital]
        for t in closed_trades:
            eq_change = t["quantity"] * (t["exit_price"] - t["entry_price"])
            equity_curve.append(equity_curve[-1] + eq_change)

        peak = equity_curve[0]
        max_drawdown = 0.0
        for eq in equity_curve:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak * 100
            if dd > max_drawdown:
                max_drawdown = dd

        total_return = (capital - initial_capital) / initial_capital * 100
    else:
        win_rate = 0
        avg_return = 0
        avg_win = 0
        avg_loss = 0
        profit_factor = 0
        max_drawdown = 0
        total_return = (capital - initial_capital) / initial_capital * 100

    # 构造 K线数据 + 买卖标记（仅回测时间范围内的数据）
    kline_data = []
    for i in range(backtest_start_idx, backtest_end_idx + 1):
        row = df.iloc[i]
        item = {
            "date": row["date"] if "date" in df.columns else "",
            "open": round(float(row["open"]), 2),
            "close": round(float(row["close"]), 2),
            "high": round(float(row["high"]), 2),
            "low": round(float(row["low"]), 2),
            "volume": int(row["volume"]),
            "signal": int(row["signal"]),
        }
        # 附加关键指标
        for col in ["ma5", "ma10", "ma20", "ma60"]:
            if col in df.columns and not np.isnan(row[col]):
                item[col] = round(float(row[col]), 2)
        kline_data.append(item)

    # 构建规则描述列表
    applied_rules = []
    for sid in strategy_ids:
        applied_rules.append(get_strategy_name(sid))
    if stop_loss is not None:
        applied_rules.append(f"止损(-{stop_loss}%)")
    if take_profit is not None:
        applied_rules.append(f"止盈(+{take_profit}%)")
    if max_hold_days is not None:
        applied_rules.append(f"最大持有{max_hold_days}天")
    if parsed_rules["raw_text"] and not any([stop_loss, take_profit, max_hold_days]):
        applied_rules.append(f"自定义: {parsed_rules['raw_text'][:50]}")

    # 统计用的已完成交易（卖出交易）
    sell_trades = [t for t in trades if t["trade_direction"] == "SELL" and t["exit_price"] > 0]

    return {
        "success": True,
        "data": {
            "summary": {
                "total_trades": len(trades),
                "win_rate": round(win_rate, 1),
                "avg_return": round(avg_return, 2),
                "total_return": round(total_return, 2),
                "max_drawdown": round(max_drawdown, 2),
                "profit_factor": round(profit_factor, 2) if profit_factor != float("inf") else 99.99,
                "avg_win": round(avg_win, 2),
                "avg_loss": round(avg_loss, 2),
                "total_wins": len([t for t in sell_trades if t["pnl_pct"] > 0]),
                "total_losses": len([t for t in sell_trades if t["pnl_pct"] <= 0]),
                "final_capital": round(capital, 2),
                "initial_capital": initial_capital,
                "total_trade_cost": round(total_trade_cost, 2),
                "commission_rate": commission_rate,
                "stamp_tax_rate": stamp_tax_rate,
            },
            "trades": trades,
            "kline_data": kline_data,
            "strategy_ids": strategy_ids,
            "applied_rules": applied_rules,
        },
    }


# ============================================================
#  信号检查（实时 - 检查最新一根K线）
# ============================================================

def _generate_signal_reason(sid: str, action: str, df: pd.DataFrame, last_idx: int) -> str:
    """根据策略ID和指标数据生成买卖原因说明"""
    row = df.iloc[last_idx]
    reasons = []

    if sid == "ma_cross":
        ma5 = row.get("ma5")
        ma10 = row.get("ma10")
        if pd.notna(ma5) and pd.notna(ma10):
            if action == "买入":
                reasons.append(f"MA5({ma5:.2f})上穿MA10({ma10:.2f})，短期均线向上，趋势转强")
            else:
                reasons.append(f"MA5({ma5:.2f})下穿MA10({ma10:.2f})，短期均线向下，趋势转弱")
    elif sid == "macd_cross":
        dif = row.get("dif")
        dea = row.get("dea")
        if pd.notna(dif) and pd.notna(dea):
            if action == "买入":
                reasons.append(f"MACD金叉：DIF({dif:.2f})上穿DEA({dea:.2f})，多头动能增强")
            else:
                reasons.append(f"MACD死叉：DIF({dif:.2f})下穿DEA({dea:.2f})，空头动能增强")
    elif sid == "kdj_cross":
        k = row.get("k")
        d = row.get("d")
        j = row.get("j")
        if pd.notna(k) and pd.notna(d):
            if action == "买入":
                reasons.append(f"KDJ金叉：K({k:.1f})上穿D({d:.1f})，J值({j:.1f})，超卖区回升")
            else:
                reasons.append(f"KDJ死叉：K({k:.1f})下穿D({d:.1f})，J值({j:.1f})，超买区回落")
    elif sid == "boll_band":
        close = row.get("close", 0)
        upper = row.get("boll_upper")
        lower = row.get("boll_lower")
        mid = row.get("boll_mid")
        if pd.notna(upper) and pd.notna(lower):
            if action == "买入":
                reasons.append(f"股价({close:.2f})触及布林带下轨({lower:.2f})，存在反弹机会")
            else:
                reasons.append(f"股价({close:.2f})触及布林带上轨({upper:.2f})，存在回调风险")
    elif sid == "rsi_signal":
        rsi = row.get("rsi") if "rsi" in df.columns else None
        if pd.notna(rsi):
            if action == "买入":
                reasons.append(f"RSI({rsi:.1f})进入超卖区域，存在反弹预期")
            else:
                reasons.append(f"RSI({rsi:.1f})进入超买区域，存在回调预期")
        else:
            reasons.append(f"RSI指标触发{action}信号")
    elif sid == "vol_price":
        volume = row.get("volume", 0)
        close = row.get("close", 0)
        if action == "买入":
            reasons.append(f"量价齐升：成交量放大配合价格上涨({close:.2f})，多头力量增强")
        else:
            reasons.append(f"量价背离：成交量异动配合价格下跌({close:.2f})，空头压力加大")

    if not reasons:
        name = get_strategy_name(sid)
        reasons.append(f"{name}策略触发{action}信号")

    return "；".join(reasons)


async def check_latest_signals(
    stock_symbol: str,
    builtin_strategy_ids: List[str],
) -> List[Dict[str, Any]]:
    """
    检查某只股票在最新交易日是否触发了策略信号。
    增强版：多策略共振评分 + 大盘过滤 + 冷却期 + 异动检测。
    返回触发的信号列表，按评分从高到低排序。
    """
    signals = []

    try:
        market_svc = MarketDataService()
        async with market_svc:
            kline_data = await market_svc.get_historical_data(stock_symbol, period="daily")

            # 获取实时行情
            quote = None
            try:
                quote = await market_svc.get_stock_quote(stock_symbol)
            except Exception as qe:
                logger.warning(f"获取实时行情失败 {stock_symbol}: {qe}")

            # 获取上证指数数据用于大盘过滤
            index_data = None
            try:
                index_kline = await market_svc.get_historical_data("000001.SH", period="daily")
                if index_kline and len(index_kline) >= 20:
                    index_data = pd.DataFrame(index_kline)
            except Exception as ie:
                logger.warning(f"获取大盘数据失败: {ie}")

        if not kline_data or len(kline_data) < 60:
            return signals

        df = pd.DataFrame(kline_data)
        df = build_indicators(df)

        last_idx = len(df) - 1

        # 从实时行情或K线数据提取关键行情信息
        stock_name = quote.get("name", "") if quote else ""
        current_price = quote.get("price", 0) if quote else float(df["close"].iloc[last_idx])
        change_pct = quote.get("change_percent", 0) if quote else 0
        high = quote.get("high", 0) if quote else float(df["high"].iloc[last_idx])
        low = quote.get("low", 0) if quote else float(df["low"].iloc[last_idx])
        volume = quote.get("volume", 0) if quote else int(df["volume"].iloc[last_idx])
        prev_close = quote.get("prev_close", 0) if quote else (float(df["close"].iloc[last_idx - 1]) if last_idx > 0 else 0)

        # ============================================================
        # 大盘环境过滤
        # ============================================================
        market_filter_block_buy = False
        if index_data is not None and len(index_data) >= 20:
            idx_closes = index_data["close"].astype(float)
            idx_ma20 = idx_closes.rolling(20).mean()
            idx_last_close = float(idx_closes.iloc[-1])
            idx_prev_close = float(idx_closes.iloc[-2]) if len(idx_closes) > 1 else idx_last_close
            idx_ma20_val = float(idx_ma20.iloc[-1]) if not np.isnan(idx_ma20.iloc[-1]) else 0
            idx_change_pct = (idx_last_close - idx_prev_close) / idx_prev_close * 100 if idx_prev_close > 0 else 0

            # 大盘在 MA20 下方且当日跌幅 > 2% → 屏蔽买入信号
            if idx_ma20_val > 0 and idx_last_close < idx_ma20_val and idx_change_pct < -2.0:
                market_filter_block_buy = True
                logger.info(f"大盘过滤器触发：上证 {idx_last_close:.2f} < MA20 {idx_ma20_val:.2f}，跌幅 {idx_change_pct:.1f}%，屏蔽买入信号")

        # ============================================================
        # 逐策略检测信号 + 共振评分
        # ============================================================
        buy_signals_raw = []  # [(strategy_id, reason)]
        sell_signals_raw = []

        for sid in builtin_strategy_ids:
            df_sig = generate_signals(df.copy(), sid)
            sig_val = df_sig["signal"].iloc[last_idx]

            if sig_val == 1:
                reason = _generate_signal_reason(sid, "买入", df, last_idx)
                buy_signals_raw.append((sid, reason))
            elif sig_val == -1:
                reason = _generate_signal_reason(sid, "卖出", df, last_idx)
                sell_signals_raw.append((sid, reason))

        # ============================================================
        # 异动检测：成交量 > 20日均量 3 倍
        # ============================================================
        vol_ma20 = df["vol_ma20"].iloc[last_idx] if "vol_ma20" in df.columns else 0
        current_vol = float(df["volume"].iloc[last_idx])
        volume_anomaly = False
        if vol_ma20 and not np.isnan(vol_ma20) and vol_ma20 > 0 and current_vol > vol_ma20 * 3:
            volume_anomaly = True
            vol_ratio = round(current_vol / vol_ma20, 1)
            anomaly_direction = "放量上涨" if change_pct > 0 else "放量下跌" if change_pct < 0 else "放量震荡"

        # ============================================================
        # 冷却期检查：检查最近3个交易日是否有同方向信号
        # ============================================================
        def _check_cooldown(direction: int) -> bool:
            """检查最近3个交易日是否已触发过同方向信号"""
            if last_idx < 3:
                return False
            for sid in builtin_strategy_ids:
                df_check = generate_signals(df.copy(), sid)
                for back in range(1, 4):  # 往前看3天
                    idx = last_idx - back
                    if idx >= 0 and df_check["signal"].iloc[idx] == direction:
                        return True  # 冷却期内有同方向信号
            return False

        buy_in_cooldown = _check_cooldown(1)
        sell_in_cooldown = _check_cooldown(-1)

        # ============================================================
        # 构建最终信号列表
        # ============================================================
        trade_date = df["date"].iloc[last_idx]
        display_name = f"{stock_name}({stock_symbol})" if stock_name else stock_symbol

        # 处理买入信号
        if buy_signals_raw and not market_filter_block_buy and not buy_in_cooldown:
            # 共振评分
            num_buy = len(buy_signals_raw)
            if num_buy >= 3:
                score = 80 + min(num_buy - 3, 2) * 10  # 3个80分，4个90分，5个+100分
            elif num_buy == 2:
                score = 60
            else:
                score = 30

            # 异动加分
            if volume_anomaly and change_pct > 0:
                score = min(score + 15, 100)

            strategy_names = [get_strategy_name(sid) for sid, _ in buy_signals_raw]
            reasons = [reason for _, reason in buy_signals_raw]

            signals.append({
                "alert_type": "BUY_SIGNAL",
                "triggered_strategy": buy_signals_raw[0][0],
                "stock_name": stock_name,
                "message": f"{display_name} 买入信号（{num_buy}策略共振，评分{score}）| {trade_date} | ¥{current_price:.2f}",
                "details": json.dumps({
                    "signal_type": "买入",
                    "resonance_count": num_buy,
                    "resonance_score": score,
                    "strategies": strategy_names,
                    "reasons": reasons,
                    "price": round(current_price, 2),
                    "date": trade_date,
                    "stock_name": stock_name,
                    "recommendation": "买入",
                    "market_filter": "通过",
                    "volume_anomaly": volume_anomaly,
                    "quote": {
                        "current_price": round(current_price, 2),
                        "change_percent": round(change_pct, 2),
                        "high": round(high, 2),
                        "low": round(low, 2),
                        "prev_close": round(prev_close, 2),
                        "volume": volume,
                    },
                }, ensure_ascii=False),
            })
        elif buy_signals_raw and market_filter_block_buy:
            logger.info(f"{stock_symbol} 买入信号被大盘过滤器屏蔽（{len(buy_signals_raw)}个策略触发）")
        elif buy_signals_raw and buy_in_cooldown:
            logger.info(f"{stock_symbol} 买入信号处于冷却期内，跳过")

        # 处理卖出信号
        if sell_signals_raw and not sell_in_cooldown:
            num_sell = len(sell_signals_raw)
            if num_sell >= 3:
                score = 80 + min(num_sell - 3, 2) * 10
            elif num_sell == 2:
                score = 60
            else:
                score = 30

            if volume_anomaly and change_pct < 0:
                score = min(score + 15, 100)

            strategy_names = [get_strategy_name(sid) for sid, _ in sell_signals_raw]
            reasons = [reason for _, reason in sell_signals_raw]

            signals.append({
                "alert_type": "SELL_SIGNAL",
                "triggered_strategy": sell_signals_raw[0][0],
                "stock_name": stock_name,
                "message": f"{display_name} 卖出信号（{num_sell}策略共振，评分{score}）| {trade_date} | ¥{current_price:.2f}",
                "details": json.dumps({
                    "signal_type": "卖出",
                    "resonance_count": num_sell,
                    "resonance_score": score,
                    "strategies": strategy_names,
                    "reasons": reasons,
                    "price": round(current_price, 2),
                    "date": trade_date,
                    "stock_name": stock_name,
                    "recommendation": "卖出",
                    "market_filter": "不适用",
                    "volume_anomaly": volume_anomaly,
                    "quote": {
                        "current_price": round(current_price, 2),
                        "change_percent": round(change_pct, 2),
                        "high": round(high, 2),
                        "low": round(low, 2),
                        "prev_close": round(prev_close, 2),
                        "volume": volume,
                    },
                }, ensure_ascii=False),
            })
        elif sell_signals_raw and sell_in_cooldown:
            logger.info(f"{stock_symbol} 卖出信号处于冷却期内，跳过")

        # 异动信号（独立于买卖信号）
        if volume_anomaly and not buy_signals_raw and not sell_signals_raw:
            signals.append({
                "alert_type": "VOLUME_ANOMALY",
                "triggered_strategy": "volume_anomaly",
                "stock_name": stock_name,
                "message": f"{display_name} 成交量异动（{vol_ratio}倍均量，{anomaly_direction}）| {trade_date} | ¥{current_price:.2f}",
                "details": json.dumps({
                    "signal_type": "异动",
                    "resonance_count": 0,
                    "resonance_score": 50,
                    "strategies": ["成交量异动检测"],
                    "reasons": [f"当日成交量为20日均量的{vol_ratio}倍，{anomaly_direction}，需关注"],
                    "price": round(current_price, 2),
                    "date": trade_date,
                    "stock_name": stock_name,
                    "recommendation": "关注",
                    "volume_anomaly": True,
                    "volume_ratio": vol_ratio,
                    "quote": {
                        "current_price": round(current_price, 2),
                        "change_percent": round(change_pct, 2),
                        "high": round(high, 2),
                        "low": round(low, 2),
                        "prev_close": round(prev_close, 2),
                        "volume": volume,
                    },
                }, ensure_ascii=False),
            })

    except Exception as e:
        logger.error(f"Check signals failed for {stock_symbol}: {e}")

    return signals


# ============================================================
#  回测结果缓存
# ============================================================

def compute_config_hash(stock_symbol: str, strategy_ids: List[str], custom_rules: str, start_date: str = "", end_date: str = "", initial_capital: float = 100000.0) -> str:
    content = json.dumps({
        "symbol": stock_symbol,
        "strategies": sorted(strategy_ids),
        "custom_rules": custom_rules,
        "start_date": start_date,
        "end_date": end_date,
        "initial_capital": initial_capital,
    }, sort_keys=True)
    return hashlib.sha256(content.encode()).hexdigest()[:16]


async def get_cached_backtest(stock_symbol: str, config_hash: str) -> Optional[Dict]:
    """从数据库查询缓存的回测结果"""
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """SELECT result_data FROM backtest_results
                   WHERE stock_symbol=$1 AND config_hash=$2
                   AND created_at > NOW() - INTERVAL '1 day'""",
                stock_symbol, config_hash,
            )
            if row:
                return json.loads(row["result_data"])
    except Exception as e:
        logger.warning(f"Cache lookup failed: {e}")
    return None


async def save_backtest_cache(stock_symbol: str, config_hash: str, strategy_config: dict, result: dict):
    """保存回测结果到数据库缓存"""
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                """INSERT INTO backtest_results (id, stock_symbol, strategy_config, config_hash, result_data, created_at)
                   VALUES (uuid_generate_v4(), $1, $2, $3, $4, NOW())
                   ON CONFLICT (stock_symbol, config_hash) DO UPDATE
                   SET result_data = $4, created_at = NOW()""",
                stock_symbol,
                json.dumps(strategy_config, ensure_ascii=False),
                config_hash,
                json.dumps(result, ensure_ascii=False),
            )
    except Exception as e:
        logger.warning(f"Cache save failed: {e}")
