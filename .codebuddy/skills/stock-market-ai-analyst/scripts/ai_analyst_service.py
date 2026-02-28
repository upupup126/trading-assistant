#!/usr/bin/env python3
"""
股票市场AI分析服务
提供标准化的AI分析接口和工具函数
"""

import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum


class AnalysisType(Enum):
    """分析类型枚举"""
    MARKET_OVERVIEW = "MARKET_OVERVIEW"
    STOCK_ANALYSIS = "STOCK_ANALYSIS"
    RISK_ASSESSMENT = "RISK_ASSESSMENT"
    STRATEGY_ADVICE = "STRATEGY_ADVICE"


class TradingSignal(Enum):
    """交易信号枚举"""
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"
    WAIT = "WAIT"


@dataclass
class MarketAnalysisResult:
    """市场分析结果"""
    analysis_id: str
    market_sentiment: str
    hot_sectors: List[str]
    key_insights: List[str]
    risk_factors: List[str]
    opportunities: List[str]
    confidence_score: float
    timestamp: datetime


@dataclass
class StockAnalysisResult:
    """个股分析结果"""
    analysis_id: str
    symbol: str
    trading_signal: str
    target_price: Optional[float]
    confidence_score: float
    buy_reasons: List[str]
    sell_reasons: List[str]
    risk_factors: List[str]
    support_levels: List[float]
    resistance_levels: List[float]
    expected_return: Optional[float]
    max_risk: Optional[float]
    timestamp: datetime


@dataclass
class RiskAssessmentResult:
    """风险评估结果"""
    assessment_id: str
    overall_risk_level: str
    risk_score: float
    market_risk: float
    liquidity_risk: float
    concentration_risk: float
    volatility_risk: float
    risk_warnings: List[str]
    mitigation_strategies: List[str]
    confidence_score: float
    timestamp: datetime


class StockMarketAIAnalyst:
    """股票市场AI分析师"""
    
    def __init__(self, ai_client, model: str = "gpt-4", temperature: float = 0.3):
        """
        初始化AI分析师
        
        Args:
            ai_client: AI客户端实例
            model: 使用的AI模型
            temperature: 生成温度参数
        """
        self.ai_client = ai_client
        self.model = model
        self.temperature = temperature
        self.analysis_history = []
    
    async def analyze_market_sentiment(self, market_data: Dict[str, Any]) -> MarketAnalysisResult:
        """
        分析市场情绪和整体状况
        
        Args:
            market_data: 市场数据字典
            
        Returns:
            MarketAnalysisResult: 市场分析结果
        """
        start_time = time.time()
        
        # 构建分析提示
        prompt = self._build_market_analysis_prompt(market_data)
        
        # 调用AI分析
        response = await self.ai_client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model=self.model,
            temperature=self.temperature,
            max_tokens=2000
        )
        
        # 解析结果
        analysis_result = self._parse_market_analysis_response(response)
        
        # 记录分析历史
        processing_time = (time.time() - start_time) * 1000
        self._log_analysis(AnalysisType.MARKET_OVERVIEW, market_data, analysis_result, processing_time)
        
        return analysis_result
    
    async def analyze_stock(self, stock_data: Dict[str, Any]) -> StockAnalysisResult:
        """
        分析个股投资价值和交易机会
        
        Args:
            stock_data: 个股数据字典
            
        Returns:
            StockAnalysisResult: 个股分析结果
        """
        start_time = time.time()
        
        # 构建分析提示
        prompt = self._build_stock_analysis_prompt(stock_data)
        
        # 调用AI分析
        response = await self.ai_client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model=self.model,
            temperature=self.temperature,
            max_tokens=2500
        )
        
        # 解析结果
        analysis_result = self._parse_stock_analysis_response(response, stock_data["symbol"])
        
        # 记录分析历史
        processing_time = (time.time() - start_time) * 1000
        self._log_analysis(AnalysisType.STOCK_ANALYSIS, stock_data, analysis_result, processing_time)
        
        return analysis_result
    
    async def assess_risk(self, portfolio_data: Dict[str, Any]) -> RiskAssessmentResult:
        """
        评估投资组合风险
        
        Args:
            portfolio_data: 投资组合数据
            
        Returns:
            RiskAssessmentResult: 风险评估结果
        """
        start_time = time.time()
        
        # 构建风险评估提示
        prompt = self._build_risk_assessment_prompt(portfolio_data)
        
        # 调用AI分析
        response = await self.ai_client.chat_completion(
            messages=[{"role": "user", "content": prompt}],
            model=self.model,
            temperature=self.temperature,
            max_tokens=2000
        )
        
        # 解析结果
        assessment_result = self._parse_risk_assessment_response(response)
        
        # 记录分析历史
        processing_time = (time.time() - start_time) * 1000
        self._log_analysis(AnalysisType.RISK_ASSESSMENT, portfolio_data, assessment_result, processing_time)
        
        return assessment_result
    
    def _build_market_analysis_prompt(self, market_data: Dict[str, Any]) -> str:
        """构建市场分析提示"""
        return f"""
你是一位专业的股票市场分析师，请基于以下信息分析当前市场情况：

**市场数据：**
- 日期：{market_data.get('date', datetime.now().strftime('%Y-%m-%d'))}
- 主要指数表现：{json.dumps(market_data.get('indices', {}), ensure_ascii=False)}
- 成交量情况：{json.dumps(market_data.get('volume', {}), ensure_ascii=False)}
- 涨跌家数：{json.dumps(market_data.get('advance_decline', {}), ensure_ascii=False)}

**新闻热点：**
{json.dumps(market_data.get('news_headlines', []), ensure_ascii=False)}

**分析要求：**
1. 评估整体市场情绪（看涨/看跌/中性/震荡）
2. 识别当前热点板块和题材
3. 分析市场主要驱动因素
4. 评估短期市场风险
5. 提供投资建议和注意事项

**输出格式：**
请以JSON格式返回分析结果，包含以下字段：
{{
  "market_sentiment": "市场情绪评级",
  "hot_sectors": ["热点板块1", "热点板块2"],
  "key_insights": ["关键洞察1", "关键洞察2", "关键洞察3"],
  "risk_factors": ["风险因素1", "风险因素2"],
  "opportunities": ["投资机会1", "投资机会2"],
  "confidence_score": 0.85
}}

重要提示：本分析仅供参考，不构成投资建议。股市有风险，投资需谨慎。
"""
    
    def _build_stock_analysis_prompt(self, stock_data: Dict[str, Any]) -> str:
        """构建个股分析提示"""
        return f"""
作为专业股票分析师，请对股票 {stock_data.get('symbol')} ({stock_data.get('name', '')}) 进行全面分析：

**基础信息：**
- 当前价格：{stock_data.get('current_price')}
- 市值：{stock_data.get('market_cap')}
- 所属行业：{stock_data.get('sector')}

**技术指标：**
{json.dumps(stock_data.get('technical_indicators', {}), ensure_ascii=False)}

**基本面数据：**
{json.dumps(stock_data.get('fundamental_data', {}), ensure_ascii=False)}

**近期新闻：**
{json.dumps(stock_data.get('recent_news', []), ensure_ascii=False)}

**用户背景：**
- 风险承受能力：{stock_data.get('risk_tolerance', 'MEDIUM')}
- 投资期限：{stock_data.get('investment_horizon', '中期')}

**输出要求：**
返回结构化的JSON分析报告：
{{
  "trading_signal": "BUY/SELL/HOLD",
  "target_price": 目标价格,
  "confidence_score": 0.75,
  "buy_reasons": ["买入理由1", "买入理由2"],
  "sell_reasons": ["卖出理由1", "卖出理由2"],
  "risk_factors": ["风险提示1", "风险提示2"],
  "support_levels": [支撑位1, 支撑位2],
  "resistance_levels": [阻力位1, 阻力位2],
  "expected_return": 预期收益率,
  "max_risk": 最大风险,
  "holding_period": "建议持有期"
}}

重要提示：本分析仅供参考，不构成投资建议。请根据自身情况做出投资决策。
"""
    
    def _build_risk_assessment_prompt(self, portfolio_data: Dict[str, Any]) -> str:
        """构建风险评估提示"""
        return f"""
请对以下投资组合进行全面风险评估：

**投资组合：**
{json.dumps(portfolio_data.get('holdings', []), ensure_ascii=False)}

**市场环境：**
- 当前市场状态：{portfolio_data.get('market_conditions', '正常')}
- 波动率水平：{portfolio_data.get('volatility_level', '中等')}

**用户风险偏好：**
- 风险承受能力：{portfolio_data.get('risk_tolerance', 'MEDIUM')}
- 最大可接受损失：{portfolio_data.get('max_acceptable_loss', '10%')}

**输出格式：**
{{
  "overall_risk_level": "LOW/MEDIUM/HIGH/EXTREME",
  "risk_score": 65,
  "market_risk": 70,
  "liquidity_risk": 60,
  "concentration_risk": 80,
  "volatility_risk": 55,
  "risk_warnings": ["风险提示1", "风险提示2"],
  "mitigation_strategies": ["缓解策略1", "缓解策略2"],
  "confidence_score": 0.8
}}

重要提示：风险评估基于历史数据和当前市场条件，实际风险可能有所不同。
"""
    
    def _parse_market_analysis_response(self, response: str) -> MarketAnalysisResult:
        """解析市场分析响应"""
        try:
            # 提取JSON部分
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            json_str = response[json_start:json_end]
            
            data = json.loads(json_str)
            
            return MarketAnalysisResult(
                analysis_id=f"market_{int(time.time())}",
                market_sentiment=data.get('market_sentiment', 'NEUTRAL'),
                hot_sectors=data.get('hot_sectors', []),
                key_insights=data.get('key_insights', []),
                risk_factors=data.get('risk_factors', []),
                opportunities=data.get('opportunities', []),
                confidence_score=data.get('confidence_score', 0.5),
                timestamp=datetime.now()
            )
        except Exception as e:
            # 返回默认结果
            return MarketAnalysisResult(
                analysis_id=f"market_{int(time.time())}",
                market_sentiment="NEUTRAL",
                hot_sectors=[],
                key_insights=["AI分析解析失败，请重试"],
                risk_factors=["数据解析错误"],
                opportunities=[],
                confidence_score=0.1,
                timestamp=datetime.now()
            )
    
    def _parse_stock_analysis_response(self, response: str, symbol: str) -> StockAnalysisResult:
        """解析个股分析响应"""
        try:
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            json_str = response[json_start:json_end]
            
            data = json.loads(json_str)
            
            return StockAnalysisResult(
                analysis_id=f"stock_{symbol}_{int(time.time())}",
                symbol=symbol,
                trading_signal=data.get('trading_signal', 'HOLD'),
                target_price=data.get('target_price'),
                confidence_score=data.get('confidence_score', 0.5),
                buy_reasons=data.get('buy_reasons', []),
                sell_reasons=data.get('sell_reasons', []),
                risk_factors=data.get('risk_factors', []),
                support_levels=data.get('support_levels', []),
                resistance_levels=data.get('resistance_levels', []),
                expected_return=data.get('expected_return'),
                max_risk=data.get('max_risk'),
                timestamp=datetime.now()
            )
        except Exception as e:
            return StockAnalysisResult(
                analysis_id=f"stock_{symbol}_{int(time.time())}",
                symbol=symbol,
                trading_signal="HOLD",
                target_price=None,
                confidence_score=0.1,
                buy_reasons=[],
                sell_reasons=["AI分析解析失败"],
                risk_factors=["数据解析错误"],
                support_levels=[],
                resistance_levels=[],
                expected_return=None,
                max_risk=None,
                timestamp=datetime.now()
            )
    
    def _parse_risk_assessment_response(self, response: str) -> RiskAssessmentResult:
        """解析风险评估响应"""
        try:
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            json_str = response[json_start:json_end]
            
            data = json.loads(json_str)
            
            return RiskAssessmentResult(
                assessment_id=f"risk_{int(time.time())}",
                overall_risk_level=data.get('overall_risk_level', 'MEDIUM'),
                risk_score=data.get('risk_score', 50.0),
                market_risk=data.get('market_risk', 50.0),
                liquidity_risk=data.get('liquidity_risk', 50.0),
                concentration_risk=data.get('concentration_risk', 50.0),
                volatility_risk=data.get('volatility_risk', 50.0),
                risk_warnings=data.get('risk_warnings', []),
                mitigation_strategies=data.get('mitigation_strategies', []),
                confidence_score=data.get('confidence_score', 0.5),
                timestamp=datetime.now()
            )
        except Exception as e:
            return RiskAssessmentResult(
                assessment_id=f"risk_{int(time.time())}",
                overall_risk_level="MEDIUM",
                risk_score=50.0,
                market_risk=50.0,
                liquidity_risk=50.0,
                concentration_risk=50.0,
                volatility_risk=50.0,
                risk_warnings=["风险评估解析失败"],
                mitigation_strategies=["请重新进行风险评估"],
                confidence_score=0.1,
                timestamp=datetime.now()
            )
    
    def _log_analysis(self, analysis_type: AnalysisType, input_data: Dict, result: Any, processing_time: float):
        """记录分析历史"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "analysis_type": analysis_type.value,
            "processing_time_ms": processing_time,
            "input_data_size": len(str(input_data)),
            "result_id": getattr(result, 'analysis_id', getattr(result, 'assessment_id', 'unknown')),
            "confidence_score": result.confidence_score
        }
        
        self.analysis_history.append(log_entry)
        
        # 保持历史记录不超过1000条
        if len(self.analysis_history) > 1000:
            self.analysis_history = self.analysis_history[-1000:]
    
    def get_analysis_statistics(self) -> Dict[str, Any]:
        """获取分析统计信息"""
        if not self.analysis_history:
            return {"total_analyses": 0}
        
        total_analyses = len(self.analysis_history)
        avg_processing_time = sum(entry["processing_time_ms"] for entry in self.analysis_history) / total_analyses
        avg_confidence = sum(entry["confidence_score"] for entry in self.analysis_history) / total_analyses
        
        analysis_types = {}
        for entry in self.analysis_history:
            analysis_type = entry["analysis_type"]
            analysis_types[analysis_type] = analysis_types.get(analysis_type, 0) + 1
        
        return {
            "total_analyses": total_analyses,
            "avg_processing_time_ms": round(avg_processing_time, 2),
            "avg_confidence_score": round(avg_confidence, 3),
            "analysis_types": analysis_types,
            "last_analysis": self.analysis_history[-1]["timestamp"]
        }


# 工具函数
def validate_analysis_result(result: Union[MarketAnalysisResult, StockAnalysisResult, RiskAssessmentResult]) -> bool:
    """验证分析结果的有效性"""
    if result.confidence_score < 0.3:
        return False
    
    if isinstance(result, StockAnalysisResult):
        if not result.trading_signal or result.trading_signal not in ['BUY', 'SELL', 'HOLD', 'WAIT']:
            return False
    
    if isinstance(result, RiskAssessmentResult):
        if result.risk_score < 0 or result.risk_score > 100:
            return False
    
    return True


def format_analysis_for_display(result: Union[MarketAnalysisResult, StockAnalysisResult, RiskAssessmentResult]) -> Dict[str, Any]:
    """格式化分析结果用于显示"""
    base_info = {
        "timestamp": result.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "confidence_score": f"{result.confidence_score:.1%}"
    }
    
    if isinstance(result, MarketAnalysisResult):
        return {
            **base_info,
            "type": "市场分析",
            "sentiment": result.market_sentiment,
            "hot_sectors": result.hot_sectors,
            "insights": result.key_insights[:3],  # 只显示前3条
            "risk_count": len(result.risk_factors),
            "opportunity_count": len(result.opportunities)
        }
    
    elif isinstance(result, StockAnalysisResult):
        return {
            **base_info,
            "type": "个股分析",
            "symbol": result.symbol,
            "signal": result.trading_signal,
            "target_price": result.target_price,
            "expected_return": f"{result.expected_return:.1%}" if result.expected_return else "N/A",
            "risk_level": "高" if result.max_risk and result.max_risk > 0.2 else "中" if result.max_risk and result.max_risk > 0.1 else "低"
        }
    
    elif isinstance(result, RiskAssessmentResult):
        return {
            **base_info,
            "type": "风险评估",
            "overall_risk": result.overall_risk_level,
            "risk_score": f"{result.risk_score:.0f}/100",
            "main_risks": [risk for risk in [
                ("市场风险", result.market_risk),
                ("流动性风险", result.liquidity_risk),
                ("集中度风险", result.concentration_risk),
                ("波动性风险", result.volatility_risk)
            ] if risk[1] > 70],
            "warning_count": len(result.risk_warnings)
        }
    
    return base_info


if __name__ == "__main__":
    # 示例用法
    print("股票市场AI分析服务已加载")
    print("主要功能：")
    print("1. 市场情绪分析 - analyze_market_sentiment()")
    print("2. 个股价值分析 - analyze_stock()")
    print("3. 风险评估 - assess_risk()")
    print("4. 分析结果验证 - validate_analysis_result()")
    print("5. 结果格式化显示 - format_analysis_for_display()")