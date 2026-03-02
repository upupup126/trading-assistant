"""
市场数据服务
负责获取股票行情、技术指标等市场数据
使用腾讯/新浪金融 HTTP API 获取真实 A 股数据（海外服务器可用）
K 线历史数据持久化到 PostgreSQL，增量更新
"""

import asyncio
import logging
import re
import json
from collections import defaultdict
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional, Any
import aiohttp
import asyncpg
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# 数据库连接池（模块级，首次调用时初始化）
_db_pool: Optional[asyncpg.Pool] = None


async def get_db_pool() -> asyncpg.Pool:
    """获取或创建数据库连接池"""
    global _db_pool
    if _db_pool is None or _db_pool._closed:
        db_url = settings.database_url
        # asyncpg 需要 postgresql:// 而非 postgres://
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        _db_pool = await asyncpg.create_pool(db_url, min_size=2, max_size=10)
        await _ensure_kline_table(_db_pool)
    return _db_pool


async def _ensure_kline_table(pool: asyncpg.Pool):
    """确保 K 线日数据表存在"""
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS stock_kline_daily (
                symbol VARCHAR(20) NOT NULL,
                trade_date DATE NOT NULL,
                open DECIMAL(12,4) NOT NULL,
                close DECIMAL(12,4) NOT NULL,
                high DECIMAL(12,4) NOT NULL,
                low DECIMAL(12,4) NOT NULL,
                volume BIGINT NOT NULL DEFAULT 0,
                PRIMARY KEY (symbol, trade_date)
            );
            CREATE INDEX IF NOT EXISTS idx_kline_symbol ON stock_kline_daily(symbol);
            CREATE INDEX IF NOT EXISTS idx_kline_date ON stock_kline_daily(trade_date);
        """)


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
        # 已经是腾讯格式 (sh/sz 开头 + 纯数字)
        if re.match(r'^(sh|sz)\d{6}$', symbol, re.IGNORECASE):
            return symbol.lower()
        if "." in symbol:
            code, exchange = symbol.split(".")
            if exchange.upper() in ("SZ", "SZE"):
                return f"sz{code}"
            elif exchange.upper() in ("SH", "SSE"):
                return f"sh{code}"
        code = symbol.replace(".SS", "").replace(".SZ", "").replace(".SH", "")
        if code.startswith(("6", "5", "9", "11")):
            return f"sh{code}"
        return f"sz{code}"

    def _parse_tencent_quote(self, raw: str, original_symbol: str) -> Optional[Dict[str, Any]]:
        """解析腾讯行情数据"""
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
            volume = int(parts[6]) if parts[6] else 0
            change = float(parts[31]) if parts[31] else 0
            change_pct = float(parts[32]) if parts[32] else 0
            high = float(parts[33]) if parts[33] else 0
            low = float(parts[34]) if parts[34] else 0
            amount = float(parts[37]) if parts[37] else 0
            turnover = float(parts[38]) if parts[38] else 0
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

    # ======================== K 线数据核心逻辑 ========================

    async def _fetch_daily_kline_from_api(self, symbol: str, count: int = 365) -> List[Dict[str, Any]]:
        """从腾讯 API 拉取日K数据"""
        tc_code = self._to_tencent_code(symbol)
        kline_url = f"http://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={tc_code},day,,,{count},qfq"

        session = self.session or aiohttp.ClientSession(headers=self._headers)
        close_session = self.session is None

        rows = []
        try:
            async with session.get(kline_url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                raw = await resp.read()
                text = raw.decode("utf-8", errors="replace")

            data_obj = json.loads(text)
            kdata = data_obj.get("data", {})
            for _key, val in kdata.items():
                day_list = val.get("day") or val.get("qfqday") or []
                for row in day_list:
                    if len(row) >= 6:
                        rows.append({
                            "date": row[0],
                            "open": float(row[1]),
                            "close": float(row[2]),
                            "high": float(row[3]),
                            "low": float(row[4]),
                            "volume": int(float(row[5])),
                        })
                break
        except Exception as e:
            logger.warning(f"ifzq K线接口失败: {e}，回退到 flashdata")
            try:
                url = f"http://data.gtimg.cn/flashdata/hushen/latest/daily/{tc_code}.js"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    raw = await resp.read()
                    text = raw.decode("gbk", errors="replace")

                lines = re.findall(r"(\d{6}\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+[\d.]+)", text)
                for line in lines:
                    parts = line.split()
                    if len(parts) >= 6:
                        ymd = parts[0]
                        year = 2000 + int(ymd[:2])
                        month = int(ymd[2:4])
                        day = int(ymd[4:6])
                        rows.append({
                            "date": f"{year:04d}-{month:02d}-{day:02d}",
                            "open": float(parts[1]),
                            "close": float(parts[2]),
                            "high": float(parts[3]),
                            "low": float(parts[4]),
                            "volume": int(float(parts[5])),
                        })
            except Exception as e2:
                logger.error(f"flashdata K线接口也失败: {e2}")
        finally:
            if close_session:
                await session.close()

        return rows

    async def _sync_daily_kline_to_db(self, symbol: str) -> None:
        """增量同步日K数据到数据库：只拉取缺失的新数据"""
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            # 查询数据库中该 symbol 最新日期
            latest = await conn.fetchval(
                "SELECT MAX(trade_date) FROM stock_kline_daily WHERE symbol=$1",
                symbol
            )

        if latest is None:
            # 首次：拉取全量（最多365天）
            api_data = await self._fetch_daily_kline_from_api(symbol, 365)
        else:
            # 增量：只需拉最近30天，过滤出新的
            api_data = await self._fetch_daily_kline_from_api(symbol, 60)
            api_data = [d for d in api_data if d["date"] > latest.isoformat()]

        if not api_data:
            return

        # 批量写入
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO stock_kline_daily (symbol, trade_date, open, close, high, low, volume)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (symbol, trade_date) DO NOTHING
                """,
                [
                    (symbol, d["date"], d["open"], d["close"], d["high"], d["low"], d["volume"])
                    for d in api_data
                ]
            )
        logger.info(f"同步 {symbol} 日K数据 {len(api_data)} 条")

    async def _get_daily_kline_from_db(self, symbol: str, limit: int = 365) -> List[Dict[str, Any]]:
        """从数据库读取日K数据"""
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT trade_date, open, close, high, low, volume
                FROM stock_kline_daily
                WHERE symbol=$1
                ORDER BY trade_date DESC
                LIMIT $2
                """,
                symbol, limit
            )
        # 转为正序
        result = []
        for r in reversed(rows):
            result.append({
                "date": r["trade_date"].isoformat(),
                "open": float(r["open"]),
                "close": float(r["close"]),
                "high": float(r["high"]),
                "low": float(r["low"]),
                "volume": int(r["volume"]),
            })
        return result

    @staticmethod
    def _aggregate_kline(daily_data: List[Dict[str, Any]], period: str) -> List[Dict[str, Any]]:
        """将日K数据聚合为周K/月K/年K"""
        if not daily_data:
            return []

        def get_group_key(d: str) -> str:
            dt = date.fromisoformat(d)
            if period == "weekly":
                # ISO 周：年-周号
                iso = dt.isocalendar()
                return f"{iso[0]}-W{iso[1]:02d}"
            elif period == "monthly":
                return d[:7]  # YYYY-MM
            elif period == "yearly":
                return d[:4]  # YYYY
            return d

        groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        group_order: List[str] = []
        for item in daily_data:
            key = get_group_key(item["date"])
            if key not in groups:
                group_order.append(key)
            groups[key].append(item)

        result = []
        for key in group_order:
            items = groups[key]
            result.append({
                "date": items[0]["date"],  # 该周期第一天
                "open": items[0]["open"],
                "close": items[-1]["close"],
                "high": max(i["high"] for i in items),
                "low": min(i["low"] for i in items),
                "volume": sum(i["volume"] for i in items),
            })
        return result

    async def get_historical_data(self, symbol: str, period: str = "daily") -> List[Dict[str, Any]]:
        """获取历史K线数据
        period: daily(日K), weekly(周K), monthly(月K), yearly(年K)
        """
        cache_key = self._get_cache_key(symbol, f"hist_{period}")
        if cache_key in self.cache:
            data, ts = self.cache[cache_key]
            if self._is_cache_valid(ts):
                return data

        # 1. 增量同步日K到数据库
        try:
            await self._sync_daily_kline_to_db(symbol)
        except Exception as e:
            logger.warning(f"数据库同步失败，回退到纯 API: {e}")
            # 回退：直接从 API 获取
            daily_data = await self._fetch_daily_kline_from_api(symbol, 365)
            if period == "daily":
                self.cache[cache_key] = (daily_data, datetime.now())
                return daily_data
            result = self._aggregate_kline(daily_data, period)
            self.cache[cache_key] = (result, datetime.now())
            return result

        # 2. 从数据库读取日K（足够长以支持年K聚合）
        daily_data = await self._get_daily_kline_from_db(symbol, 365)

        # 3. 按 period 聚合
        if period == "daily":
            result = daily_data
        elif period in ("weekly", "monthly", "yearly"):
            result = self._aggregate_kline(daily_data, period)
        else:
            result = daily_data

        self.cache[cache_key] = (result, datetime.now())
        return result

    # ======================== 其他市场数据接口 ========================

    async def get_market_overview(self) -> Dict[str, Any]:
        """获取市场概览 - 真实数据"""
        cache_key = "market_overview"
        if cache_key in self.cache:
            data, ts = self.cache[cache_key]
            if self._is_cache_valid(ts):
                return data

        market_data = {}

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

        advancing = 0
        declining = 0
        unchanged = 0
        total_volume = sum(d.get("volume", 0) for d in market_data.values())

        try:
            url = "https://hq.sinajs.cn/list=sh000001"
            session = self.session or aiohttp.ClientSession(headers=self._headers)
            close_session = self.session is None

            try:
                stat_url = "http://qt.gtimg.cn/q=sh000001"
                async with session.get(stat_url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    raw_stat = await resp.read()
                    stat_text = raw_stat.decode("gbk", errors="replace")
                    match = re.search(r'="(.+?)"', stat_text)
                    if match:
                        sp = match.group(1).split("~")
            finally:
                if close_session:
                    await session.close()
        except Exception as e:
            logger.warning(f"涨跌统计获取失败: {e}")

        sector_performance = {}
        try:
            url = "https://vip.stock.finance.sina.com.cn/q/view/newSinaHy.php"
            session = self.session or aiohttp.ClientSession(headers=self._headers)
            close_session = self.session is None

            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    raw = await resp.read()
                    text = raw.decode("gbk", errors="replace")

                    sectors = re.findall(
                        r'"new_\w+":"new_\w+,([^,]+),(\d+),[^,]*,[^,]*,([-\d.]+)',
                        text
                    )

                    if sectors:
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

                        advancing = total_adv
                        declining = total_dec
                        unchanged = max(0, 5000 - advancing - declining)

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
            url = f"https://suggest3.sinajs.cn/suggest/type=11,12,203,204&key={query}&name=suggestdata"
            session = self.session or aiohttp.ClientSession(headers=self._headers)
            close_session = self.session is None

            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    raw = await resp.read()
                    text = raw.decode("gbk", errors="replace")
            finally:
                if close_session:
                    await session.close()

            match = re.search(r'"(.+?)"', text)
            if not match or not match.group(1):
                return []

            results = []
            items = match.group(1).split(";")
            for item in items[:limit]:
                parts = item.split(",")
                if len(parts) >= 4:
                    raw_code = parts[3]
                    name = parts[4] if len(parts) > 4 else parts[1]
                    # 新浪返回的 code 可能带 sh/sz 前缀（如 sz300450），需提取纯数字
                    pure_code = re.sub(r'^(sh|sz)', '', raw_code, flags=re.IGNORECASE)
                    if pure_code.startswith("6") or pure_code.startswith("5") or pure_code.startswith("9"):
                        suffix = ".SH"
                    else:
                        suffix = ".SZ"
                    results.append({
                        "symbol": f"{pure_code}{suffix}",
                        "name": name,
                    })

            return results
        except Exception as e:
            logger.error(f"股票搜索失败: {e}")
            raise Exception(f"股票搜索失败: {str(e)}")


    # ======================== 分时数据 ========================

    def _is_trading_time(self) -> bool:
        """判断当前是否为A股交易时间（北京时间 9:30-11:30, 13:00-15:00，工作日）"""
        from datetime import timezone, timedelta as td
        now_utc = datetime.now(timezone.utc)
        beijing_tz = timezone(td(hours=8))
        now_bj = now_utc.astimezone(beijing_tz)
        # 周末非交易日
        if now_bj.weekday() >= 5:
            return False
        t = now_bj.hour * 100 + now_bj.minute
        return (930 <= t <= 1130) or (1300 <= t <= 1500)

    async def get_minute_data(self, symbol: str) -> Dict[str, Any]:
        """获取分时走势数据
        使用腾讯新版分时数据接口 web.ifzq.gtimg.cn
        """
        cache_key = self._get_cache_key(symbol, "minute")
        if cache_key in self.cache:
            data, ts = self.cache[cache_key]
            if self._is_cache_valid(ts):
                return data

        tc_code = self._to_tencent_code(symbol)
        session = self.session or aiohttp.ClientSession(headers=self._headers)
        close_session = self.session is None

        try:
            url = f"https://web.ifzq.gtimg.cn/appstock/app/minute/query?code={tc_code}"
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                json_data = await resp.json(content_type=None)

            stock_data = json_data.get("data", {}).get(tc_code, {})
            data_section = stock_data.get("data", {})
            qt_arr = stock_data.get("qt", {}).get(tc_code, [])

            # 解析日期: YYYYMMDD -> YYYY-MM-DD
            raw_date = str(data_section.get("date", ""))
            if len(raw_date) == 8:
                trade_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:8]}"
            else:
                trade_date = raw_date

            # 昨收价: qt数组第4个元素
            prev_close = 0.0
            if len(qt_arr) > 4:
                try:
                    prev_close = float(qt_arr[4])
                except (ValueError, TypeError):
                    pass

            # 解析分时数据: "HHMM price volume amount"
            minutes = []
            raw_minutes = data_section.get("data", [])
            for item in raw_minutes:
                parts = item.split()
                if len(parts) >= 3:
                    try:
                        time_str = parts[0]
                        price = float(parts[1])
                        vol = int(float(parts[2]))
                        minutes.append({
                            "time": f"{time_str[:2]}:{time_str[2:]}",
                            "price": price,
                            "volume": vol,
                        })
                    except (ValueError, IndexError):
                        continue

            result = {
                "symbol": symbol,
                "trade_date": trade_date,
                "prev_close": prev_close,
                "is_trading": self._is_trading_time(),
                "minutes": minutes,
            }
            self.cache[cache_key] = (result, datetime.now())
            return result
        except Exception as e:
            logger.error(f"获取分时数据失败 {symbol}: {e}")
            raise Exception(f"获取分时数据失败: {str(e)}")
        finally:
            if close_session:
                await session.close()

    # ======================== 概念板块热点轮动 ========================

    async def get_concept_sector_hotspot(self, days: int = 5) -> Dict[str, Any]:
        """获取概念板块热点轮动数据（东方财富API）
        返回最近 N 天每天的概念板块涨幅排名 Top 9
        """
        cache_key = f"concept_hotspot_{days}"
        if cache_key in self.cache:
            data, ts = self.cache[cache_key]
            if self._is_cache_valid(ts):
                return data

        session = self.session or aiohttp.ClientSession(headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://data.eastmoney.com",
        })
        close_session = self.session is None

        try:
            # 第一步：获取概念板块列表及今日涨幅
            list_url = (
                "https://push2.eastmoney.com/api/qt/clist/get?"
                "pn=1&pz=100&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281"
                "&fltt=2&invt=2&fid=f3&fs=m:90+t:3&fields=f2,f3,f12,f14"
            )
            async with session.get(list_url, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                data_obj = await resp.json()

            sector_list = data_obj.get("data", {}).get("diff", [])
            if not sector_list:
                raise Exception("未获取到概念板块列表")

            # 获取板块代码列表（取涨幅前50个来查历史）
            sector_codes = []
            for item in sector_list[:50]:
                code = item.get("f12", "")
                name = item.get("f14", "")
                if code and name:
                    sector_codes.append({"code": code, "name": name})

            # 第二步：获取每个板块最近N天的涨幅（使用东方财富K线接口）
            daily_rankings: Dict[str, list] = {}  # date -> [(name, change_pct)]

            # 批量获取板块日K数据
            tasks = []
            for sector in sector_codes:
                tasks.append(self._fetch_sector_daily_kline(session, sector["code"], sector["name"], days + 5))

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in results:
                if isinstance(result, Exception):
                    continue
                if not result:
                    continue
                name, kline_data = result
                for item in kline_data:
                    d = item["date"]
                    pct = item["change_pct"]
                    if d not in daily_rankings:
                        daily_rankings[d] = []
                    daily_rankings[d].append({"name": name, "change_pct": pct})

            # 按日期排序，取最近N天
            sorted_dates = sorted(daily_rankings.keys(), reverse=True)[:days]
            sorted_dates.reverse()  # 正序：旧->新

            hotspot_data = []
            for d in sorted_dates:
                items = daily_rankings[d]
                items.sort(key=lambda x: x["change_pct"], reverse=True)
                hotspot_data.append({
                    "date": d,
                    "rankings": items[:9],  # Top 9
                })

            result = {
                "days": days,
                "data": hotspot_data,
                "timestamp": datetime.now().isoformat(),
            }
            self.cache[cache_key] = (result, datetime.now())
            return result
        except Exception as e:
            logger.error(f"获取概念板块热点数据失败: {e}")
            raise Exception(f"获取概念板块热点数据失败: {str(e)}")
        finally:
            if close_session:
                await session.close()

    async def _fetch_sector_daily_kline(
        self, session: aiohttp.ClientSession, code: str, name: str, count: int
    ) -> Optional[tuple]:
        """获取单个概念板块的日K数据"""
        try:
            url = (
                f"https://push2his.eastmoney.com/api/qt/stock/kline/get?"
                f"secid=90.{code}&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57&"
                f"klt=101&fqt=0&end=20500101&lmt={count}&ut=bd1d9ddb04089700cf9c27f6f7426281"
            )
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                data_obj = await resp.json()

            klines = data_obj.get("data", {}).get("klines", [])
            result = []
            prev_close = None
            for kline_str in klines:
                parts = kline_str.split(",")
                if len(parts) >= 4:
                    d = parts[0]  # 日期
                    close = float(parts[2])  # 收盘价
                    if prev_close and prev_close != 0:
                        change_pct = round((close - prev_close) / prev_close * 100, 2)
                        result.append({"date": d, "change_pct": change_pct})
                    prev_close = close
            return (name, result)
        except Exception:
            return None


# 全局市场数据服务实例
market_data_service = MarketDataService()
