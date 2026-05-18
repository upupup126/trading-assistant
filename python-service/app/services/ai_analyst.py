"""
AI分析服务核心模块
实现市场分析、股票分析、风险评估和策略推荐
v2: 注入技术指标+K线数据+策略信号，重写结构化Prompt
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import aiohttp
import openai
from app.config import get_settings

logger = logging.getLogger(__name__)

# ============================================================
#  结构化 System Prompt
# ============================================================

SYSTEM_PROMPT_MARKET = """你是一位专业的 A 股量化市场分析师。请严格按以下框架分析：

1.【大盘趋势】基于指数价格和均线位置判断当前市场阶段（上升趋势/震荡/下降趋势）
2.【量能分析】结合成交量判断市场资金活跃度
3.【板块轮动】识别领涨和领跌板块，判断资金流向
4.【风险信号】识别潜在风险（如指数跌破关键均线、涨跌家数失衡等）
5.【操作建议】给出仓位建议（满仓/半仓/轻仓/空仓观望）

重要规则：
- 所有结论必须基于提供的数据，禁止编造数字
- 市场情绪判断必须给出具体依据
- 如果数据不足以得出结论，请明确说明"""

SYSTEM_PROMPT_STOCK = """你是一位专业的 A 股量化分析师，擅长技术分析和基本面评估。请严格按以下框架分析：

1.【趋势判断】基于 K 线形态和均线系统，判断当前处于什么阶段
   （底部筑底、上升初期、主升浪、加速赶顶、顶部、下降通道、超跌反弹...）
2.【均线系统】分析 MA5/MA10/MA20/MA60/MA250 的排列关系和支撑压力
3.【量价关系】结合近期成交量变化判断资金动向（放量上涨/缩量调整/放量下跌等）
4.【技术指标】综合 MACD/KDJ/布林带给出方向判断，重点关注背离和超买超卖
5.【关键价位】基于提供的 K 线数据中的近期高低点和均线位置，给出具体的支撑位和压力位
6.【策略信号】结合量化策略引擎的信号判断，给出综合研判
7.【风险评估】当前位置的风险收益比

重要规则：
- 支撑位和压力位必须基于提供的 K 线数据和均线数值计算，不可凭空编造
- 目标价必须有合理依据（如前高、均线位置、涨幅空间）
- 如果策略引擎触发了信号，需要结合技术分析判断该信号的可靠性
- 如果数据不足，请明确说明而不是猜测"""

SYSTEM_PROMPT_RISK = """你是一位专业的投资组合风险管理师，擅长 A 股市场风险评估。请严格按以下框架评估：

1.【集中度风险】分析持仓的行业分布和个股集中度
2.【相关性风险】判断持仓股票之间的相关性（同涨同跌风险）
3.【波动性评估】基于各持仓近期涨跌幅和技术指标评估波动风险
4.【系统性风险】结合当前大盘环境评估系统性风险敞口
5.【仓位建议】给出调仓建议（减仓/加仓/调换标的）

重要规则：
- 分散化评分基于行业分布和个股权重计算，不可编造
- 不要编造 Beta 或夏普比率等需要长期历史数据计算的指标
- 如果无法计算某个指标，请说明原因而不是给出虚假数字"""

SYSTEM_PROMPT_ADVICE = """你是一位专业的 A 股交易策略师。请严格按以下框架给出建议：

1.【行情研判】基于提供的技术指标和K线数据判断当前多空态势
2.【策略信号参考】参考量化策略引擎的信号，分析其可靠性
3.【入场时机】是否到了合适的入场/离场点位
4.【具体操作】给出明确的操作建议（入场价、止损价、止盈价必须基于数据）
5.【仓位控制】建议仓位比例和风险控制方案

重要规则：
- 入场价、止损价、止盈价必须基于提供的K线和技术指标数据
- 止损位应设在关键支撑位下方，止盈位应设在关键阻力位附近
- 如果当前不适合交易，要明确说"观望"并给出理由"""


@dataclass
class MarketAnalysis:
    """市场分析结果"""
    analysis_id: str
    market_sentiment: str  # BULLISH, BEARISH, NEUTRAL
    hot_sectors: List[str]
    key_insights: List[str]
    market_summary: str
    confidence_score: float
    generated_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result['generated_at'] = self.generated_at.isoformat()
        return result

@dataclass
class StockAnalysis:
    """个股分析结果"""
    analysis_id: str
    symbol: str
    recommendation: str  # BUY, SELL, HOLD
    target_price: Optional[float]
    support_levels: List[float]
    resistance_levels: List[float]
    key_factors: List[str]
    risk_factors: List[str]
    opportunity_score: float
    risk_score: float
    confidence_score: float
    generated_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result['generated_at'] = self.generated_at.isoformat()
        return result

@dataclass
class RiskAssessment:
    """风险评估结果"""
    assessment_id: str
    portfolio_risk_level: str  # LOW, MEDIUM, HIGH
    diversification_score: float
    volatility_score: float
    sector_concentration: Dict[str, float]
    risk_metrics: Dict[str, float]
    recommendations: List[str]
    generated_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result['generated_at'] = self.generated_at.isoformat()
        return result

@dataclass
class TradingAdvice:
    """交易建议"""
    advice_id: str
    symbol: str
    action: str  # BUY, SELL, HOLD
    reasoning: str
    entry_price: Optional[float]
    stop_loss: Optional[float]
    take_profit: Optional[float]
    position_size: Optional[float]
    time_horizon: str  # SHORT, MEDIUM, LONG
    confidence_level: float
    generated_at: datetime

    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result['generated_at'] = self.generated_at.isoformat()
        return result

def _extract_json_from_response(text: str) -> dict:
    """从 AI 响应中提取 JSON（兼容 markdown 代码块包裹的情况）"""
    import re
    # 尝试直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # 尝试提取 ```json ... ``` 或 ``` ... ``` 中的内容
    pattern = r'```(?:json)?\s*\n?(.*?)\n?```'
    match = re.search(pattern, text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass
    # 尝试提取第一个 { ... } 块
    brace_start = text.find('{')
    brace_end = text.rfind('}')
    if brace_start != -1 and brace_end != -1:
        try:
            return json.loads(text[brace_start:brace_end + 1])
        except json.JSONDecodeError:
            pass
    raise json.JSONDecodeError("无法从 AI 响应中提取 JSON", text, 0)


class AIAnalystService:
    """AI分析服务"""

    def __init__(self):
        settings = get_settings()
        api_key = settings.OPENAI_API_KEY or "mock-key"
        base_url = settings.OPENAI_BASE_URL
        kwargs = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url
        self.openai_client = openai.AsyncOpenAI(**kwargs)
        self.model = settings.OPENAI_MODEL or "gpt-3.5-turbo"
        self.cache = {}
        self.cache_ttl = 300  # 缓存TTL(秒)

    async def _get_cached_result(self, cache_key: str) -> Optional[Dict]:
        """获取缓存结果"""
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if time.time() - timestamp < self.cache_ttl:
                return cached_data
            else:
                del self.cache[cache_key]
        return None

    def _set_cache(self, cache_key: str, data: Dict):
        """设置缓存"""
        self.cache[cache_key] = (data, time.time())

    async def _call_openai_api(self, messages: List[Dict], temperature: float = 0.7) -> str:
        """调用OpenAI API"""
        try:
            response = await self.openai_client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=3000
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI API调用失败: {e}")
            raise Exception(f"AI分析服务暂时不可用: {str(e)}")

    async def _fetch_market_data(self, symbols: List[str]) -> Dict[str, Any]:
        """获取真实市场数据（通过 MarketDataService）"""
        from app.services.market_data import MarketDataService

        service = MarketDataService()
        market_data = {}

        # 获取个股行情
        for symbol in symbols:
            try:
                quote = await service.get_stock_quote(symbol)
                market_data[symbol] = {
                    "name": quote.get("name", symbol),
                    "price": quote.get("price", 0),
                    "change": quote.get("change", 0),
                    "change_percent": quote.get("change_percent", 0),
                    "volume": quote.get("volume", 0),
                    "market_cap": quote.get("market_cap", 0),
                    "pe_ratio": quote.get("pe_ratio", 0),
                    "turnover_rate": quote.get("turnover_rate", 0),
                }
            except Exception as e:
                logger.warning(f"获取 {symbol} 行情失败: {e}")
                market_data[symbol] = {"name": symbol, "price": 0, "error": str(e)}

        # 获取市场概览
        try:
            overview = await service.get_market_overview()
            market_data["market_overview"] = {
                "indices": overview.get("indices", {}),
                "market_stats": overview.get("market_stats", {}),
                "sector_performance": overview.get("sector_performance", {}),
            }
        except Exception as e:
            logger.warning(f"获取市场概览失败: {e}")
            market_data["market_overview"] = {"error": str(e)}

        return market_data

    async def _fetch_technical_data(self, symbol: str, days: int = 60) -> Dict[str, Any]:
        """获取技术指标数据 + K线摘要，用于喂给 AI 分析"""
        from app.services.market_data import MarketDataService
        from app.services.strategy_engine import build_indicators
        import pandas as pd
        import numpy as np

        result = {
            "kline_summary": [],
            "indicators": {},
            "kline_stats": {},
        }

        try:
            market_svc = MarketDataService()
            async with market_svc:
                kline_data = await market_svc.get_historical_data(symbol, period="daily")

            if not kline_data or len(kline_data) < 30:
                return result

            df = pd.DataFrame(kline_data)
            df = build_indicators(df)

            # 最近 N 天的 K 线摘要（精简版，节省 token）
            recent = df.tail(days)
            kline_summary = []
            for _, row in recent.iterrows():
                item = {
                    "date": row["date"],
                    "open": round(float(row["open"]), 2),
                    "close": round(float(row["close"]), 2),
                    "high": round(float(row["high"]), 2),
                    "low": round(float(row["low"]), 2),
                    "volume": int(row["volume"]),
                }
                kline_summary.append(item)
            result["kline_summary"] = kline_summary

            # 最新一根 K 线的全套技术指标
            last = df.iloc[-1]
            indicators = {}
            for col in ["ma5", "ma10", "ma20", "ma60", "ma250",
                        "dif", "dea", "macd_hist",
                        "k", "d", "j",
                        "boll_upper", "boll_mid", "boll_lower",
                        "vol_ma20"]:
                val = last.get(col)
                if val is not None and not (isinstance(val, float) and np.isnan(val)):
                    indicators[col] = round(float(val), 2)
            result["indicators"] = indicators

            # K 线统计摘要
            recent_20 = df.tail(20)
            result["kline_stats"] = {
                "20d_high": round(float(recent_20["high"].max()), 2),
                "20d_low": round(float(recent_20["low"].min()), 2),
                "20d_avg_volume": int(recent_20["volume"].mean()),
                "latest_volume": int(last["volume"]),
                "volume_ratio": round(float(last["volume"]) / float(recent_20["volume"].mean()), 2) if float(recent_20["volume"].mean()) > 0 else 0,
                "total_days": len(df),
            }

            # 均线趋势（最近5天的MA20方向）
            if len(df) >= 5:
                ma20_5ago = df["ma20"].iloc[-5]
                ma20_now = df["ma20"].iloc[-1]
                if not np.isnan(ma20_5ago) and not np.isnan(ma20_now):
                    result["kline_stats"]["ma20_trend"] = "上升" if ma20_now > ma20_5ago else "下降" if ma20_now < ma20_5ago else "走平"

        except Exception as e:
            logger.warning(f"获取技术指标失败 {symbol}: {e}")

        return result

    async def _fetch_strategy_signals(self, symbol: str) -> List[Dict[str, Any]]:
        """获取策略引擎的最新信号"""
        from app.services.strategy_engine import check_latest_signals

        all_strategy_ids = [
            "short_ma5_cross", "short_macd_diverge", "short_kdj_oversold",
            "mid_ma20_trend", "mid_boll_break", "mid_vol_price",
            "long_ma_arrange", "long_ma250_support", "long_macd_weekly",
        ]

        try:
            signals = await check_latest_signals(symbol, all_strategy_ids)
            # 精简信号信息，只保留关键字段
            simplified = []
            for sig in signals:
                details = json.loads(sig.get("details", "{}"))
                simplified.append({
                    "type": sig.get("alert_type", ""),
                    "strategy": details.get("strategy_name", ""),
                    "signal": details.get("signal_type", ""),
                    "reason": details.get("reason", ""),
                    "price": details.get("price", 0),
                })
            return simplified
        except Exception as e:
            logger.warning(f"获取策略信号失败 {symbol}: {e}")
            return []

    # ============================================================
    #  大盘趋势分析（增强版）
    # ============================================================

    async def analyze_market_trend(self, symbols: List[str] = None) -> MarketAnalysis:
        """分析市场趋势 - 增加指数K线趋势数据"""
        cache_key = f"market_trend_{hash(str(symbols))}"
        cached_result = await self._get_cached_result(cache_key)
        if cached_result:
            return MarketAnalysis(**cached_result)

        try:
            if not symbols:
                symbols = ["000001.SZ", "399001.SZ", "000300.SH"]

            # 并行获取市场数据 + 上证指数技术指标
            market_data_task = self._fetch_market_data(symbols)
            index_tech_task = self._fetch_technical_data("000001.SH", days=30)

            market_data, index_tech = await asyncio.gather(
                market_data_task, index_tech_task, return_exceptions=True
            )

            if isinstance(market_data, Exception):
                market_data = {}
            if isinstance(index_tech, Exception):
                index_tech = {}

            # 构建增强版 prompt
            prompt = f"""请基于以下市场数据进行综合分析：

## 实时市场数据
{json.dumps(market_data, ensure_ascii=False, indent=2)}

## 上证指数技术指标（最新）
{json.dumps(index_tech.get('indicators', {}), ensure_ascii=False, indent=2)}

## 上证指数近期统计
{json.dumps(index_tech.get('kline_stats', {}), ensure_ascii=False, indent=2)}

## 上证指数近10日K线
{json.dumps(index_tech.get('kline_summary', [])[-10:], ensure_ascii=False, indent=2)}

请提供以下分析：
1. 市场整体情绪（BULLISH/BEARISH/NEUTRAL），给出判断依据
2. 当前热点板块（最多5个）
3. 关键市场洞察（3-5条，每条要有数据支撑）
4. 市场总结（200字以内，包含操作建议）
5. 分析置信度（0-1）

以JSON格式返回：
{{
    "market_sentiment": "BULLISH/BEARISH/NEUTRAL",
    "hot_sectors": ["板块1", "板块2"],
    "key_insights": ["洞察1（含数据依据）", "洞察2"],
    "market_summary": "市场总结，包含仓位建议",
    "confidence_score": 0.85
}}"""

            messages = [
                {"role": "system", "content": SYSTEM_PROMPT_MARKET},
                {"role": "user", "content": prompt}
            ]

            response = await self._call_openai_api(messages)
            logger.info(f"AI 市场分析原始响应: {response[:200]}...")

            try:
                ai_result = _extract_json_from_response(response)
            except json.JSONDecodeError:
                logger.warning(f"AI 响应 JSON 解析失败: {response[:300]}")
                ai_result = {
                    "market_sentiment": "NEUTRAL",
                    "hot_sectors": ["科技", "新能源"],
                    "key_insights": ["市场分析暂时不可用"],
                    "market_summary": "市场数据处理中，请稍后再试",
                    "confidence_score": 0.5
                }

            analysis = MarketAnalysis(
                analysis_id=f"market_{int(time.time())}",
                market_sentiment=ai_result.get("market_sentiment", "NEUTRAL"),
                hot_sectors=ai_result.get("hot_sectors", []),
                key_insights=ai_result.get("key_insights", []),
                market_summary=ai_result.get("market_summary", ""),
                confidence_score=ai_result.get("confidence_score", 0.5),
                generated_at=datetime.now()
            )

            self._set_cache(cache_key, analysis.to_dict())
            return analysis

        except Exception as e:
            logger.error(f"市场趋势分析失败: {e}")
            return MarketAnalysis(
                analysis_id=f"market_error_{int(time.time())}",
                market_sentiment="NEUTRAL",
                hot_sectors=["科技", "医药"],
                key_insights=["市场分析服务暂时不可用，请稍后重试"],
                market_summary="系统正在维护中",
                confidence_score=0.0,
                generated_at=datetime.now()
            )

    # ============================================================
    #  个股分析（增强版：技术指标 + K线 + 策略信号）
    # ============================================================

    async def analyze_stock_opportunity(self, symbol: str, user_context: Dict = None) -> StockAnalysis:
        """分析个股投资机会 - 注入技术指标+K线+策略信号"""
        cache_key = f"stock_{symbol}_{hash(str(user_context))}"
        cached_result = await self._get_cached_result(cache_key)
        if cached_result:
            return StockAnalysis(**cached_result)

        try:
            # 并行获取：实时行情 + 技术指标 + 策略信号
            market_task = self._fetch_market_data([symbol])
            tech_task = self._fetch_technical_data(symbol, days=60)
            signal_task = self._fetch_strategy_signals(symbol)

            stock_data, tech_data, strategy_signals = await asyncio.gather(
                market_task, tech_task, signal_task, return_exceptions=True
            )

            if isinstance(stock_data, Exception):
                stock_data = {}
            if isinstance(tech_data, Exception):
                tech_data = {}
            if isinstance(strategy_signals, Exception):
                strategy_signals = []

            # 构建用户上下文信息
            context_info = ""
            if user_context:
                context_info = f"""
## 用户投资偏好
- 风险承受能力: {user_context.get('risk_tolerance', '中等')}
- 投资期限: {user_context.get('investment_horizon', '中期')}
- 关注板块: {user_context.get('preferred_sectors', [])}
"""

            # 策略信号描述
            signal_info = "无当日策略触发信号"
            if strategy_signals:
                signal_lines = []
                for sig in strategy_signals:
                    signal_lines.append(f"- [{sig['strategy']}] {sig['signal']}信号: {sig['reason']}")
                signal_info = "\n".join(signal_lines)

            prompt = f"""请对股票 {symbol} 进行深度分析：

## 实时行情
{json.dumps(stock_data.get(symbol, {}), ensure_ascii=False, indent=2)}

## 最新技术指标
{json.dumps(tech_data.get('indicators', {}), ensure_ascii=False, indent=2)}

## 近期K线统计
{json.dumps(tech_data.get('kline_stats', {}), ensure_ascii=False, indent=2)}

## 近20日K线数据
{json.dumps(tech_data.get('kline_summary', [])[-20:], ensure_ascii=False, indent=2)}

## 量化策略信号
{signal_info}
{context_info}

请提供以下分析：
1. 投资建议（BUY/SELL/HOLD）及具体理由
2. 目标价位（基于K线数据中的前高/前低/均线位置推算）
3. 支撑位（基于近期低点和均线位置，最多3个）
4. 阻力位（基于近期高点和均线位置，最多3个）
5. 关键利好因素（3-5条，引用具体数据）
6. 风险因素（3-5条）
7. 机会评分（0-1）
8. 风险评分（0-1）
9. 置信度（0-1）

以JSON格式返回：
{{
    "recommendation": "BUY/SELL/HOLD",
    "target_price": 数值或null,
    "support_levels": [价格1, 价格2],
    "resistance_levels": [价格1, 价格2],
    "key_factors": ["因素1（含数据）", "因素2"],
    "risk_factors": ["风险1", "风险2"],
    "opportunity_score": 0.75,
    "risk_score": 0.35,
    "confidence_score": 0.80
}}"""

            messages = [
                {"role": "system", "content": SYSTEM_PROMPT_STOCK},
                {"role": "user", "content": prompt}
            ]

            response = await self._call_openai_api(messages)

            try:
                ai_result = _extract_json_from_response(response)
            except json.JSONDecodeError:
                ai_result = {
                    "recommendation": "HOLD",
                    "target_price": None,
                    "support_levels": [],
                    "resistance_levels": [],
                    "key_factors": ["分析数据处理中"],
                    "risk_factors": ["请稍后重试"],
                    "opportunity_score": 0.5,
                    "risk_score": 0.5,
                    "confidence_score": 0.3
                }

            analysis = StockAnalysis(
                analysis_id=f"stock_{symbol}_{int(time.time())}",
                symbol=symbol,
                recommendation=ai_result.get("recommendation", "HOLD"),
                target_price=ai_result.get("target_price"),
                support_levels=ai_result.get("support_levels", []),
                resistance_levels=ai_result.get("resistance_levels", []),
                key_factors=ai_result.get("key_factors", []),
                risk_factors=ai_result.get("risk_factors", []),
                opportunity_score=ai_result.get("opportunity_score", 0.5),
                risk_score=ai_result.get("risk_score", 0.5),
                confidence_score=ai_result.get("confidence_score", 0.5),
                generated_at=datetime.now()
            )

            self._set_cache(cache_key, analysis.to_dict())
            return analysis

        except Exception as e:
            logger.error(f"个股分析失败 {symbol}: {e}")
            return StockAnalysis(
                analysis_id=f"stock_error_{symbol}_{int(time.time())}",
                symbol=symbol,
                recommendation="HOLD",
                target_price=None,
                support_levels=[],
                resistance_levels=[],
                key_factors=["个股分析服务暂时不可用"],
                risk_factors=["请稍后重试"],
                opportunity_score=0.0,
                risk_score=1.0,
                confidence_score=0.0,
                generated_at=datetime.now()
            )

    # ============================================================
    #  组合风险评估（增强版）
    # ============================================================

    async def assess_portfolio_risk(self, portfolio: Dict[str, float]) -> RiskAssessment:
        """评估投资组合风险 - 增加各持仓的技术指标"""
        cache_key = f"portfolio_{hash(str(portfolio))}"
        cached_result = await self._get_cached_result(cache_key)
        if cached_result:
            return RiskAssessment(**cached_result)

        try:
            symbols = list(portfolio.keys())
            total_value = sum(portfolio.values())
            weights = {symbol: round(value / total_value, 4) for symbol, value in portfolio.items()}

            # 并行获取所有持仓的数据和技术指标
            market_task = self._fetch_market_data(symbols)
            tech_tasks = [self._fetch_technical_data(sym, days=20) for sym in symbols]

            results = await asyncio.gather(
                market_task, *tech_tasks, return_exceptions=True
            )

            portfolio_data = results[0] if not isinstance(results[0], Exception) else {}
            tech_data_map = {}
            for i, sym in enumerate(symbols):
                td = results[i + 1]
                if not isinstance(td, Exception):
                    tech_data_map[sym] = {
                        "indicators": td.get("indicators", {}),
                        "kline_stats": td.get("kline_stats", {}),
                    }

            prompt = f"""请分析以下投资组合的风险：

## 组合持仓（市值）
{json.dumps(portfolio, ensure_ascii=False, indent=2)}

## 组合权重
{json.dumps(weights, ensure_ascii=False, indent=2)}

## 各持仓实时行情
{json.dumps(portfolio_data, ensure_ascii=False, indent=2)}

## 各持仓技术指标
{json.dumps(tech_data_map, ensure_ascii=False, indent=2)}

请提供风险评估：
1. 组合风险等级（LOW/MEDIUM/HIGH）
2. 分散化评分（0-1，基于行业分布和权重集中度评估）
3. 波动性评分（0-1，基于各持仓近期涨跌幅和技术指标评估）
4. 行业集中度分析（估算各行业占比）
5. 关键风险指标（基于实际数据可计算的指标）
6. 风险管理建议（具体可执行的调仓建议）

以JSON格式返回：
{{
    "portfolio_risk_level": "LOW/MEDIUM/HIGH",
    "diversification_score": 0.75,
    "volatility_score": 0.45,
    "sector_concentration": {{"科技": 0.4, "金融": 0.3}},
    "risk_metrics": {{"max_single_weight": 0.3, "avg_turnover_rate": 2.5}},
    "recommendations": ["建议1", "建议2"]
}}"""

            messages = [
                {"role": "system", "content": SYSTEM_PROMPT_RISK},
                {"role": "user", "content": prompt}
            ]

            response = await self._call_openai_api(messages)

            try:
                ai_result = _extract_json_from_response(response)
            except json.JSONDecodeError:
                ai_result = {
                    "portfolio_risk_level": "MEDIUM",
                    "diversification_score": 0.5,
                    "volatility_score": 0.5,
                    "sector_concentration": {},
                    "risk_metrics": {},
                    "recommendations": ["风险评估服务暂时不可用"]
                }

            assessment = RiskAssessment(
                assessment_id=f"risk_{int(time.time())}",
                portfolio_risk_level=ai_result.get("portfolio_risk_level", "MEDIUM"),
                diversification_score=ai_result.get("diversification_score", 0.5),
                volatility_score=ai_result.get("volatility_score", 0.5),
                sector_concentration=ai_result.get("sector_concentration", {}),
                risk_metrics=ai_result.get("risk_metrics", {}),
                recommendations=ai_result.get("recommendations", []),
                generated_at=datetime.now()
            )

            self._set_cache(cache_key, assessment.to_dict())
            return assessment

        except Exception as e:
            logger.error(f"组合风险评估失败: {e}")
            return RiskAssessment(
                assessment_id=f"risk_error_{int(time.time())}",
                portfolio_risk_level="HIGH",
                diversification_score=0.0,
                volatility_score=1.0,
                sector_concentration={},
                risk_metrics={},
                recommendations=["风险评估服务暂时不可用，请稍后重试"],
                generated_at=datetime.now()
            )

    # ============================================================
    #  交易建议（增强版：技术指标 + 策略信号）
    # ============================================================

    async def generate_trading_advice(self, symbol: str, plan_context: Dict) -> TradingAdvice:
        """生成交易建议 - 注入技术指标+策略信号"""
        cache_key = f"advice_{symbol}_{hash(str(plan_context))}"
        cached_result = await self._get_cached_result(cache_key)
        if cached_result:
            return TradingAdvice(**cached_result)

        try:
            # 并行获取数据
            market_task = self._fetch_market_data([symbol])
            tech_task = self._fetch_technical_data(symbol, days=30)
            signal_task = self._fetch_strategy_signals(symbol)

            stock_data, tech_data, strategy_signals = await asyncio.gather(
                market_task, tech_task, signal_task, return_exceptions=True
            )

            if isinstance(stock_data, Exception):
                stock_data = {}
            if isinstance(tech_data, Exception):
                tech_data = {}
            if isinstance(strategy_signals, Exception):
                strategy_signals = []

            signal_info = "无当日策略触发信号"
            if strategy_signals:
                signal_lines = []
                for sig in strategy_signals:
                    signal_lines.append(f"- [{sig['strategy']}] {sig['signal']}信号: {sig['reason']}")
                signal_info = "\n".join(signal_lines)

            prompt = f"""请基于以下信息生成交易建议：

## 股票代码：{symbol}

## 实时行情
{json.dumps(stock_data.get(symbol, {}), ensure_ascii=False, indent=2)}

## 最新技术指标
{json.dumps(tech_data.get('indicators', {}), ensure_ascii=False, indent=2)}

## 近期K线统计
{json.dumps(tech_data.get('kline_stats', {}), ensure_ascii=False, indent=2)}

## 近15日K线
{json.dumps(tech_data.get('kline_summary', [])[-15:], ensure_ascii=False, indent=2)}

## 量化策略信号
{signal_info}

## 用户交易计划上下文
{json.dumps(plan_context, ensure_ascii=False, indent=2)}

请提供具体的交易建议：
1. 交易动作（BUY/SELL/HOLD）
2. 详细理由（引用具体指标数据和策略信号）
3. 建议入场价格（基于支撑位或当前价）
4. 止损价格（基于关键支撑位下方）
5. 止盈价格（基于关键阻力位）
6. 仓位大小建议（比例 0-1）
7. 持有期限（SHORT/MEDIUM/LONG）
8. 置信水平（0-1）

以JSON格式返回：
{{
    "action": "BUY/SELL/HOLD",
    "reasoning": "详细分析理由，引用具体数据",
    "entry_price": 数值或null,
    "stop_loss": 数值或null,
    "take_profit": 数值或null,
    "position_size": 0.1,
    "time_horizon": "SHORT/MEDIUM/LONG",
    "confidence_level": 0.75
}}"""

            messages = [
                {"role": "system", "content": SYSTEM_PROMPT_ADVICE},
                {"role": "user", "content": prompt}
            ]

            response = await self._call_openai_api(messages)

            try:
                ai_result = _extract_json_from_response(response)
            except json.JSONDecodeError:
                ai_result = {
                    "action": "HOLD",
                    "reasoning": "交易建议生成失败，请稍后重试",
                    "entry_price": None,
                    "stop_loss": None,
                    "take_profit": None,
                    "position_size": 0.0,
                    "time_horizon": "MEDIUM",
                    "confidence_level": 0.0
                }

            advice = TradingAdvice(
                advice_id=f"advice_{symbol}_{int(time.time())}",
                symbol=symbol,
                action=ai_result.get("action", "HOLD"),
                reasoning=ai_result.get("reasoning", ""),
                entry_price=ai_result.get("entry_price"),
                stop_loss=ai_result.get("stop_loss"),
                take_profit=ai_result.get("take_profit"),
                position_size=ai_result.get("position_size", 0.0),
                time_horizon=ai_result.get("time_horizon", "MEDIUM"),
                confidence_level=ai_result.get("confidence_level", 0.0),
                generated_at=datetime.now()
            )

            self._set_cache(cache_key, advice.to_dict())
            return advice

        except Exception as e:
            logger.error(f"交易建议生成失败 {symbol}: {e}")
            return TradingAdvice(
                advice_id=f"advice_error_{symbol}_{int(time.time())}",
                symbol=symbol,
                action="HOLD",
                reasoning="交易建议服务暂时不可用，请稍后重试",
                entry_price=None,
                stop_loss=None,
                take_profit=None,
                position_size=0.0,
                time_horizon="MEDIUM",
                confidence_level=0.0,
                generated_at=datetime.now()
            )

# 全局AI分析服务实例
ai_analyst = AIAnalystService()
