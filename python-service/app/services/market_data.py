"""
市场数据服务
负责获取股票行情、技术指标等市场数据
使用腾讯/新浪金融 HTTP API 获取真实 A 股数据（海外服务器可用）
"""

import asyncio
import logging
import re
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import aiohttp
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class MarketDataService:
    """市场数据服务 - 基于腾讯/新浪金融 API"""

    def __init__(self):
        self.session = None
        self.cache = {}
        self.cache_ttl = 60  # 1分钟缓存
        self._headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://finance.sina.com.cn",
        }

    async def __aenter__(self):
        self.session = aiohttp.ClientSession(headers=self._headers)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def _get_cache_key(self, symbol: str, data_type: str) -> str:
        return f"{symbol}_{data_type}_{datetime.now().strftime('%Y%m%d_%H%M')}"

    def _is_cache_valid(self, timestamp: datetime) -> bool:
        return (datetime.now() - timestamp).seconds < self.cache_ttl

    def _to_tencent_code(self, symbol: str) -> str:
        """转换股票代码为腾讯格式: 000001.SZ -> sz000001, 600519.SH -> sh600519"""
        if "." in symbol:
            code, exchange = symbol.split(".")
            if exchange.upper() in ("SZ", "SZE"):
                return f"sz{code}"
            elif exchange.upper() in ("SH", "SSE"):
                return f"sh{code}"
        # 根据代码前缀猜测
        code = symbol.replace(".SS", "").replace(".SZ", "").replace(".SH", "")
        if code.startswith(("6", "5", "9", "11")):
            return f"sh{code}"
        return f"sz{code}"

    def _parse_tencent_quote(self, raw: str, original_symbol: str) -> Optional[Dict[str, Any]]:
        """解析腾讯行情数据
        格式: v_shXXXXXX="市场~名称~代码~最新价~昨收~今开~成交量~..."
        """
        match = re.search(r'="(.+?)"', raw)
        if not match:
            return None

        parts = match.group(1).split("~")
        if len(parts) < 40:
            return None

        try:
            latest_price = float(parts[3]) if parts[3] else 0
            prev_close = float(parts[4]) if parts[4] else 0
            open_price = float(parts[5]) if parts[5] else 0
            volume = int(parts[6]) if parts[6] else 0  # 手
            change = float(parts[31]) if parts[31] else 0
            change_pct = float(parts[32]) if parts[32] else 0
            high = float(parts[33]) if parts[33] else 0
            low = float(parts[34]) if parts[34] else 0
            amount = float(parts[37]) if parts[37] else 0  # 元
            turnover = float(parts[38]) if parts[38] else 0  # %
            pe = float(parts[39]) if parts[39] else 0
            market_cap_yi = float(parts[45]) if len(parts) > 45 and parts[45] else 0

            return {
                "symbol": original_symbol,
                "name": parts[1],
                "price": latest_price,
                "prev_close": prev_close,
                "open": open_price,
                "high": high,
                "low": low,
                "volume": volume,
                "change": change,
                "change_percent": change_pct,
                "amount": amount,
                "turnover_rate": turnover,
                "pe_ratio": pe,
                "market_cap": int(market_cap_yi * 1e8) if market_cap_yi else 0,
                "timestamp": datetime.now().isoformat(),
            }
        except (ValueError, IndexError) as e:
            logger.warning(f"解析腾讯行情失败 {original_symbol}: {e}")
            return None

    async def _fetch_tencent_quotes(self, tencent_codes: List[str]) -> str:
        """批量获取腾讯行情原始文本"""
        codes_str = ",".join(tencent_codes)
        url = f"http://qt.gtimg.cn/q={codes_str}"

        session = self.session or aiohttp.ClientSession(headers=self._headers)
        close_session = self.session is None

        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                # 腾讯 API 返回 GBK 编码
                raw = await resp.read()
                return raw.decode("gbk", errors="replace")
        finally:
            if close_session:
                await session.close()

    async def get_stock_quote(self, symbol: str) -> Dict[str, Any]:
        """获取股票实时行情"""
        cache_key = self._get_cache_key(symbol, "quote")
        if cache_key in self.cache:
            data, ts = self.cache[cache_key]
            if self._is_cache_valid(ts):
                return data

        tc_code = self._to_tencent_code(symbol)
        raw = await self._fetch_tencent_quotes([tc_code])

        quote = self._parse_tencent_quote(raw, symbol)
        if not quote:
            raise Exception(f"未获取到股票 {symbol} 的行情数据")

        self.cache[cache_key] = (quote, datetime.now())
        return quote

    async def get_historical_data(self, symbol: str, period: str = "1mo") -> List[Dict[str, Any]]:
        """获取历史 K 线数据（新浪 API）"""
        cache_key = self._get_cache_key(symbol, f"hist_{period}")
        if cache_key in self.cache:
            data, ts = self.cache[cache_key]
            if self._is_cache_valid(ts):
                return data

        tc_code = self._to_tencent_code(symbol)
        # 新浪历史 K 线 API
        # 使用腾讯日 K 接口: http://data.gtimg.cn/flashdata/hushen/latest/daily/CODE.js
        days_map = {"1d": 1, "5d": 5, "1mo": 30, "3mo": 90, "6mo": 180, "1y": 365}
        days = days_map.get(period, 30)

        url = f"http://data.gtimg.cn/flashdata/hushen/latest/daily/{tc_code}.js"
        session = self.session or aiohttp.ClientSession(headers=self._headers)
        close_session = self.session is None

        try:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                raw = await resp.read()
                text = raw.decode("gbk", errors="replace")
        finally:
            if close_session:
                await session.close()

        # 解析: 每行格式 "YYMMDD 开盘 收盘 最高 最低 成交量\n"
        lines = re.findall(r"(\d{6}\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+)", text)
        historical = []
        for line in lines[-days:]:
            parts = line.split()
            if len(parts) >= 6:
                ymd = parts[0]
                year = 2000 + int(ymd[:2])
                month = int(ymd[2:4])
                day = int(ymd[4:6])
                historical.append({
                    "date": f"{year:04d}-{month:02d}-{day:02d}",
                    "open": float(parts[1]),
                    "close": float(parts[2]),
                    "high": float(parts[3]),
                    "low": float(parts[4]),
                    "volume": int(float(parts[5])),
                })

        self.cache[cache_key] = (historical, datetime.now())
        return historical

    async def get_market_overview(self) -> Dict[str, Any]:
        """获取市场概览 - 真实数据"""
        cache_key = "market_overview"
        if cache_key in self.cache:
            data, ts = self.cache[cache_key]
            if self._is_cache_valid(ts):
                return data

        market_data = {}

        # ===== 1. 获取主要指数实时行情（腾讯 API）=====
        indices_config = {
            "sh000001": ("上证指数", "000001.SH"),
            "sz399001": ("深证成指", "399001.SZ"),
            "sz399006": ("创业板指", "399006.SZ"),
            "sh000300": ("沪深300", "000300.SH"),
        }

        tc_codes = list(indices_config.keys())
        try:
            raw = await self._fetch_tencent_quotes(tc_codes)

            for tc_code, (name, _sym) in indices_config.items():
                # 每个指数数据以 v_XXXX=" 开头
                pattern = f'v_{tc_code}="(.+?)"'
                match = re.search(pattern, raw)
                if match:
                    parts = match.group(1).split("~")
                    if len(parts) >= 35:
                        market_data[name] = {
                            "price": float(parts[3]) if parts[3] else 0,
                            "change": float(parts[31]) if parts[31] else 0,
                            "change_percent": float(parts[32]) if parts[32] else 0,
                            "volume": int(parts[6]) if parts[6] else 0,
                        }
                    else:
                        market_data[name] = {"price": 0, "change": 0, "change_percent": 0, "volume": 0}
                else:
                    market_data[name] = {"price": 0, "change": 0, "change_percent": 0, "volume": 0}
        except Exception as e:
            logger.error(f"获取指数行情失败: {e}")
            for _, (name, _) in indices_config.items():
                market_data[name] = {"price": 0, "change": 0, "change_percent": 0, "volume": 0}

        # ===== 2. 获取 A 股涨跌统计（新浪 API）=====
        advancing = 0
        declining = 0
        unchanged = 0
        total_volume = sum(d.get("volume", 0) for d in market_data.values())

        try:
            # 新浪市场统计 API
            url = "https://hq.sinajs.cn/list=sh000001"
            session = self.session or aiohttp.ClientSession(headers=self._headers)
            close_session = self.session is None

            try:
                # 用腾讯的成交家数（更准确）
                # 上证指数的 parts 中: parts[46] 上涨家数, parts[47] 下跌家数 (不一定有)
                # 使用新浪涨跌统计接口
                stat_url = "http://qt.gtimg.cn/q=sh000001"
                async with session.get(stat_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    raw_stat = await resp.read()
                    stat_text = raw_stat.decode("gbk", errors="replace")

                    match = re.search(r'="(.+?)"', stat_text)
                    if match:
                        sp = match.group(1).split("~")
                        # 尝试解析 上涨/下跌 家数
                        # 腾讯格式中没有直接的涨跌家数
                        # 我们从已有指数涨跌幅来估算或使用另一接口
            finally:
                if close_session:
                    await session.close()

            # 使用东方财富涨跌统计 (可能在海外被阻止)
            # 退而求其次，使用简单估算：基于各指数涨跌幅判断
            # 更好的方式: 直接解析新浪接口
        except Exception as e:
            logger.warning(f"涨跌统计获取失败: {e}")

        # ===== 3. 获取行业板块涨跌数据（新浪 API）=====
        sector_performance = {}
        try:
            url = "https://vip.stock.finance.sina.com.cn/q/view/newSinaHy.php"
            session = self.session or aiohttp.ClientSession(headers=self._headers)
            close_session = self.session is None

            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    raw = await resp.read()
                    text = raw.decode("gbk", errors="replace")

                    # 解析新浪行业板块数据
                    # 格式: "new_xxx":"new_xxx,行业名称,股票数,均价,涨跌额,涨跌幅,...,领涨股"
                    sectors = re.findall(
                        r'"new_\w+":"new_\w+,([^,]+),(\d+),[^,]*,[^,]*,([-\d.]+)',
                        text
                    )

                    if sectors:
                        # 按涨跌幅排序
                        sector_list = []
                        total_adv = 0
                        total_dec = 0
                        for name, count, pct in sectors:
                            pct_f = float(pct)
                            sector_list.append((name, pct_f, int(count)))
                            if pct_f > 0:
                                total_adv += int(count)
                            elif pct_f < 0:
                                total_dec += int(count)

                        # 估算涨跌家数
                        advancing = total_adv
                        declining = total_dec
                        unchanged = max(0, 5000 - advancing - declining)

                        # 按涨跌幅排序，取前10
                        sector_list.sort(key=lambda x: x[1], reverse=True)
                        for name, pct, _count in sector_list[:10]:
                            sector_performance[name] = round(pct / 100, 4)
            finally:
                if close_session:
                    await session.close()
        except Exception as e:
            logger.error(f"获取行业板块数据失败: {e}")

        overview = {
            "indices": market_data,
            "market_stats": {
                "total_volume": total_volume,
                "advancing_stocks": advancing,
                "declining_stocks": declining,
                "unchanged_stocks": unchanged,
            },
            "sector_performance": sector_performance,
            "timestamp": datetime.now().isoformat(),
        }

        self.cache[cache_key] = (overview, datetime.now())
        return overview

    async def search_stocks(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """搜索股票 - 使用新浪搜索 API"""
        try:
            url = f"https://suggest3.sinajs.cn/suggest/type=11,12&key={query}&name=suggestdata"
            session = self.session or aiohttp.ClientSession(headers=self._headers)
            close_session = self.session is None

            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    raw = await resp.read()
                    text = raw.decode("gbk", errors="replace")
            finally:
                if close_session:
                    await session.close()

            # 格式: var suggestdata="代码,简称,显示名,1,代码;..."
            match = re.search(r'"(.+?)"', text)
            if not match or not match.group(1):
                return []

            results = []
            items = match.group(1).split(";")
            for item in items[:limit]:
                parts = item.split(",")
                if len(parts) >= 4:
                    code = parts[3]  # 股票代码
                    name = parts[4] if len(parts) > 4 else parts[1]
                    suffix = ".SH" if code.startswith("6") else ".SZ"
                    results.append({
                        "symbol": f"{code}{suffix}",
                        "name": name,
                    })

            return results
        except Exception as e:
            logger.error(f"股票搜索失败: {e}")
            raise Exception(f"股票搜索失败: {str(e)}")


# 全局市场数据服务实例
market_data_service = MarketDataService()
