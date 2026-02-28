"""
AI分析服务核心模块
实现市场分析、股票分析、风险评估和策略推荐
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
                max_tokens=2000
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"OpenAI API调用失败: {e}")
            raise Exception(f"AI分析服务暂时不可用: {str(e)}")
    
    async def _fetch_market_data(self, symbols: List[str]) -> Dict[str, Any]:
        """获取真实市场数据（通过 MarketDataService + AKShare）"""
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
    
    async def analyze_market_trend(self, symbols: List[str] = None) -> MarketAnalysis:
        """分析市场趋势"""
        cache_key = f"market_trend_{hash(str(symbols))}"
        cached_result = await self._get_cached_result(cache_key)
        if cached_result:
            return MarketAnalysis(**cached_result)
        
        try:
            # 获取市场数据
            if not symbols:
                symbols = ["000001.SZ", "399001.SZ", "000300.SH"]  # 默认关注指数
            
            market_data = await self._fetch_market_data(symbols)
            
            # 构建AI分析提示
            prompt = f"""
作为专业的股票市场分析师，请基于以下市场数据进行综合分析：

市场数据：
{json.dumps(market_data, ensure_ascii=False, indent=2)}

请提供以下分析：
1. 市场整体情绪（BULLISH/BEARISH/NEUTRAL）
2. 当前热点板块（最多5个）
3. 关键市场洞察（3-5条）
4. 市场总结（100字以内）
5. 分析置信度（0-1之间的数值）

请以JSON格式返回，格式如下：
{{
    "market_sentiment": "BULLISH/BEARISH/NEUTRAL",
    "hot_sectors": ["板块1", "板块2", ...],
    "key_insights": ["洞察1", "洞察2", ...],
    "market_summary": "市场总结",
    "confidence_score": 0.85
}}
"""
            
            messages = [
                {"role": "system", "content": "你是一位专业的股票市场分析师，具有丰富的A股市场分析经验。"},
                {"role": "user", "content": prompt}
            ]
            
            response = await self._call_openai_api(messages)
            logger.info(f"AI 市场分析原始响应: {response[:200]}...")
            
            # 解析AI响应
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
            
            # 创建分析结果
            analysis = MarketAnalysis(
                analysis_id=f"market_{int(time.time())}",
                market_sentiment=ai_result.get("market_sentiment", "NEUTRAL"),
                hot_sectors=ai_result.get("hot_sectors", []),
                key_insights=ai_result.get("key_insights", []),
                market_summary=ai_result.get("market_summary", ""),
                confidence_score=ai_result.get("confidence_score", 0.5),
                generated_at=datetime.now()
            )
            
            # 缓存结果
            self._set_cache(cache_key, analysis.to_dict())
            
            return analysis
            
        except Exception as e:
            logger.error(f"市场趋势分析失败: {e}")
            # 返回默认分析结果
            return MarketAnalysis(
                analysis_id=f"market_error_{int(time.time())}",
                market_sentiment="NEUTRAL",
                hot_sectors=["科技", "医药"],
                key_insights=["市场分析服务暂时不可用，请稍后重试"],
                market_summary="系统正在维护中",
                confidence_score=0.0,
                generated_at=datetime.now()
            )
    
    async def analyze_stock_opportunity(self, symbol: str, user_context: Dict = None) -> StockAnalysis:
        """分析个股投资机会"""
        cache_key = f"stock_{symbol}_{hash(str(user_context))}"
        cached_result = await self._get_cached_result(cache_key)
        if cached_result:
            return StockAnalysis(**cached_result)
        
        try:
            # 获取股票数据
            stock_data = await self._fetch_market_data([symbol])
            
            # 构建用户上下文信息
            context_info = ""
            if user_context:
                context_info = f"""
用户投资偏好：
- 风险承受能力: {user_context.get('risk_tolerance', '中等')}
- 投资期限: {user_context.get('investment_horizon', '中期')}
- 关注板块: {user_context.get('preferred_sectors', [])}
"""
            
            prompt = f"""
作为专业的股票分析师，请对股票 {symbol} 进行深度分析：

股票数据：
{json.dumps(stock_data.get(symbol, {}), ensure_ascii=False, indent=2)}

{context_info}

请提供以下分析：
1. 投资建议（BUY/SELL/HOLD）
2. 目标价位（如果有）
3. 支撑位（最多3个价位）
4. 阻力位（最多3个价位）
5. 关键利好因素（3-5条）
6. 风险因素（3-5条）
7. 机会评分（0-1）
8. 风险评分（0-1）
9. 分析置信度（0-1）

请以JSON格式返回：
{{
    "recommendation": "BUY/SELL/HOLD",
    "target_price": 价格数值或null,
    "support_levels": [价格1, 价格2, ...],
    "resistance_levels": [价格1, 价格2, ...],
    "key_factors": ["因素1", "因素2", ...],
    "risk_factors": ["风险1", "风险2", ...],
    "opportunity_score": 0.75,
    "risk_score": 0.35,
    "confidence_score": 0.80
}}
"""
            
            messages = [
                {"role": "system", "content": "你是一位专业的股票分析师，擅长A股市场个股分析和投资建议。"},
                {"role": "user", "content": prompt}
            ]
            
            response = await self._call_openai_api(messages)
            
            # 解析AI响应
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
            
            # 缓存结果
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
    
    async def assess_portfolio_risk(self, portfolio: Dict[str, float]) -> RiskAssessment:
        """评估投资组合风险"""
        cache_key = f"portfolio_{hash(str(portfolio))}"
        cached_result = await self._get_cached_result(cache_key)
        if cached_result:
            return RiskAssessment(**cached_result)
        
        try:
            # 获取组合中所有股票的数据
            symbols = list(portfolio.keys())
            portfolio_data = await self._fetch_market_data(symbols)
            
            # 计算组合权重
            total_value = sum(portfolio.values())
            weights = {symbol: value/total_value for symbol, value in portfolio.items()}
            
            prompt = f"""
作为专业的投资组合风险管理师，请分析以下投资组合：

组合持仓：
{json.dumps(portfolio, ensure_ascii=False, indent=2)}

组合权重：
{json.dumps(weights, ensure_ascii=False, indent=2)}

市场数据：
{json.dumps(portfolio_data, ensure_ascii=False, indent=2)}

请提供风险评估：
1. 组合风险等级（LOW/MEDIUM/HIGH）
2. 分散化评分（0-1，1表示完全分散）
3. 波动性评分（0-1，1表示高波动）
4. 行业集中度分析
5. 关键风险指标
6. 风险管理建议

请以JSON格式返回：
{{
    "portfolio_risk_level": "LOW/MEDIUM/HIGH",
    "diversification_score": 0.75,
    "volatility_score": 0.45,
    "sector_concentration": {{"科技": 0.4, "金融": 0.3, ...}},
    "risk_metrics": {{"beta": 1.2, "sharpe_ratio": 0.8, ...}},
    "recommendations": ["建议1", "建议2", ...]
}}
"""
            
            messages = [
                {"role": "system", "content": "你是一位专业的投资组合风险管理师，擅长A股市场风险评估。"},
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
    
    async def generate_trading_advice(self, symbol: str, plan_context: Dict) -> TradingAdvice:
        """生成交易建议"""
        cache_key = f"advice_{symbol}_{hash(str(plan_context))}"
        cached_result = await self._get_cached_result(cache_key)
        if cached_result:
            return TradingAdvice(**cached_result)
        
        try:
            # 获取股票数据
            stock_data = await self._fetch_market_data([symbol])
            
            prompt = f"""
作为专业的交易策略师，请基于以下信息生成交易建议：

股票代码：{symbol}
股票数据：{json.dumps(stock_data.get(symbol, {}), ensure_ascii=False, indent=2)}

交易计划上下文：
{json.dumps(plan_context, ensure_ascii=False, indent=2)}

请提供具体的交易建议：
1. 交易动作（BUY/SELL/HOLD）
2. 详细理由分析
3. 建议入场价格
4. 止损价格
5. 止盈价格
6. 仓位大小建议（比例）
7. 持有期限（SHORT/MEDIUM/LONG）
8. 置信水平（0-1）

请以JSON格式返回：
{{
    "action": "BUY/SELL/HOLD",
    "reasoning": "详细分析理由",
    "entry_price": 价格数值或null,
    "stop_loss": 价格数值或null,
    "take_profit": 价格数值或null,
    "position_size": 0.1,
    "time_horizon": "SHORT/MEDIUM/LONG",
    "confidence_level": 0.75
}}
"""
            
            messages = [
                {"role": "system", "content": "你是一位专业的交易策略师，擅长A股市场交易策略制定。"},
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