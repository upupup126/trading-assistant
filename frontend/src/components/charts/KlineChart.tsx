import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAIStore } from '@/stores/aiStore'
import { StockHistoryItem } from '@/lib/api'
import { Loader2, CandlestickChart, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import MinuteChart from './MinuteChart'

interface KlineChartProps {
  symbol: string
  title?: string
}

const PERIOD_OPTIONS = [
  { value: 'minute', label: '分时' },
  { value: 'daily', label: '日K' },
  { value: 'weekly', label: '周K' },
  { value: 'monthly', label: '月K' },
  { value: 'yearly', label: '年K' },
]

// A股标准：红涨绿跌
const UP_COLOR = '#ef4444'
const DOWN_COLOR = '#22c55e'
const GRID_COLOR = '#1e293b'
const AXIS_COLOR = '#475569'
const TEXT_COLOR = '#94a3b8'
const MA_COLORS: Record<number, string> = {
  5: '#f59e0b',
  10: '#3b82f6',
  20: '#a855f7',
}
const VOL_MA_COLORS: Record<number, string> = {
  5: '#f59e0b',
  10: '#3b82f6',
}

const MIN_VISIBLE = 15
const MAX_VISIBLE = 300
const DEFAULT_VISIBLE = 80

interface ChartMetrics {
  canvasW: number
  mainH: number
  volH: number
  marginL: number
  marginR: number
  marginT: number
  gapH: number
  candleW: number
  candleGap: number
  priceMin: number
  priceMax: number
  volMax: number
  infoW: number
  totalW: number
}

function calcMA(data: StockHistoryItem[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else {
      let sum = 0
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j].close
      }
      result.push(sum / period)
    }
  }
  return result
}

function calcVolMA(data: StockHistoryItem[], period: number): (number | null)[] {
  const result: (number | null)[] = []
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(null)
    } else {
      let sum = 0
      for (let j = i - period + 1; j <= i; j++) {
        sum += data[j].volume
      }
      result.push(sum / period)
    }
  }
  return result
}

function computeMetrics(data: StockHistoryItem[], width: number): ChartMetrics {
  const infoW = 160
  const marginL = 60
  const marginR = 8
  const marginT = 12
  const mainH = 260
  const volH = 65
  const gapH = 8
  const totalW = width

  const canvasW = totalW - marginL - marginR - infoW
  const count = data.length || 1
  const totalCandleArea = canvasW / count
  const candleGap = Math.max(totalCandleArea * 0.2, 1)
  const candleW = Math.max(totalCandleArea - candleGap, 2)

  const prices = data.flatMap((d) => [d.high, d.low])
  const vols = data.map((d) => d.volume)
  const rawMin = prices.length ? Math.min(...prices) : 0
  const rawMax = prices.length ? Math.max(...prices) : 100
  const priceRange = rawMax - rawMin || 1
  const priceMin = rawMin - priceRange * 0.05
  const priceMax = rawMax + priceRange * 0.05
  const volMax = vols.length ? Math.max(...vols) * 1.15 : 1

  return { canvasW, mainH, volH, marginL, marginR, marginT, gapH, candleW, candleGap, priceMin, priceMax, volMax, infoW, totalW }
}

function priceToY(price: number, m: ChartMetrics): number {
  return m.marginT + m.mainH - ((price - m.priceMin) / (m.priceMax - m.priceMin)) * m.mainH
}

function volToY(vol: number, m: ChartMetrics): number {
  const volTop = m.marginT + m.mainH + m.gapH
  return volTop + m.volH - (vol / m.volMax) * m.volH
}

function candleX(index: number, m: ChartMetrics): number {
  return m.marginL + index * (m.candleW + m.candleGap) + m.candleGap / 2
}

function formatPrice(v: number): string {
  return v.toFixed(2)
}

function formatVol(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'
  if (v >= 1e4) return (v / 1e4).toFixed(0) + '万'
  return v.toFixed(0)
}

function niceStep(range: number, targetTicks: number): number {
  const rough = range / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / mag
  let nice: number
  if (norm <= 1.5) nice = 1
  else if (norm <= 3) nice = 2
  else if (norm <= 7) nice = 5
  else nice = 10
  return nice * mag
}

export default function KlineChart({ symbol, title }: KlineChartProps) {
  const { stockHistories, loadingStates, getStockHistory } = useAIStore()
  const [period, setPeriod] = useState('daily')
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  const historyKey = `${symbol}_${period}`
  const loadingKey = `stockHistory_${symbol}_${period}`
  const isLoading = loadingStates[loadingKey]
  const historyData = stockHistories[historyKey]

  useEffect(() => {
    if (symbol && period !== 'minute') {
      getStockHistory(symbol, period).catch(() => {})
    }
  }, [symbol, period])

  // 切换周期时重置缩放
  useEffect(() => {
    setVisibleCount(DEFAULT_VISIBLE)
    setHoverIdx(null)
  }, [period])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    setContainerWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const allData = historyData?.data || []
  // 根据缩放级别截取可见数据（取最后 N 根）
  const data = useMemo(() => {
    const count = Math.min(visibleCount, allData.length)
    return allData.slice(-count)
  }, [allData, visibleCount])

  const m = useMemo(() => computeMetrics(data, containerWidth), [data, containerWidth])
  const totalH = m.marginT + m.mainH + m.gapH + m.volH + 28

  const ma5 = useMemo(() => calcMA(data, 5), [data])
  const ma10 = useMemo(() => calcMA(data, 10), [data])
  const ma20 = useMemo(() => calcMA(data, 20), [data])
  const volMa5 = useMemo(() => calcVolMA(data, 5), [data])
  const volMa10 = useMemo(() => calcVolMA(data, 10), [data])

  // 缩放操作
  const handleZoomIn = useCallback(() => {
    setVisibleCount((prev) => Math.max(MIN_VISIBLE, Math.floor(prev * 0.7)))
  }, [])

  const handleZoomOut = useCallback(() => {
    setVisibleCount((prev) => Math.min(MAX_VISIBLE, allData.length, Math.floor(prev * 1.4)))
  }, [allData.length])

  const handleZoomReset = useCallback(() => {
    setVisibleCount(Math.min(DEFAULT_VISIBLE, allData.length))
  }, [allData.length])

  // 鼠标滚轮缩放
  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault()
      if (e.deltaY < 0) {
        // 向上滚=放大
        setVisibleCount((prev) => Math.max(MIN_VISIBLE, Math.floor(prev * 0.9)))
      } else {
        // 向下滚=缩小
        setVisibleCount((prev) => Math.min(MAX_VISIBLE, allData.length, Math.floor(prev * 1.1)))
      }
    },
    [allData.length]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || data.length === 0) return
      const rect = svgRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left - m.marginL
      if (x < 0 || x > m.canvasW) {
        setHoverIdx(null)
        return
      }
      const idx = Math.floor(x / (m.candleW + m.candleGap))
      setHoverIdx(idx >= 0 && idx < data.length ? idx : null)
    },
    [data, m]
  )

  const handleMouseLeave = useCallback(() => setHoverIdx(null), [])

  const priceGridLines = useMemo(() => {
    const lines: { y: number; label: string }[] = []
    const range = m.priceMax - m.priceMin
    const step = niceStep(range, 5)
    const start = Math.ceil(m.priceMin / step) * step
    for (let v = start; v <= m.priceMax; v += step) {
      lines.push({ y: priceToY(v, m), label: formatPrice(v) })
    }
    return lines
  }, [m])

  const maPath = useCallback(
    (maData: (number | null)[]) => {
      let d = ''
      let started = false
      for (let i = 0; i < maData.length; i++) {
        const v = maData[i]
        if (v === null) continue
        const x = candleX(i, m) + m.candleW / 2
        const y = priceToY(v, m)
        if (!started) {
          d += `M${x},${y}`
          started = true
        } else {
          d += `L${x},${y}`
        }
      }
      return d
    },
    [m]
  )

  const volMaPath = useCallback(
    (maData: (number | null)[]) => {
      let d = ''
      let started = false
      for (let i = 0; i < maData.length; i++) {
        const v = maData[i]
        if (v === null) continue
        const x = candleX(i, m) + m.candleW / 2
        const y = volToY(v, m)
        if (!started) {
          d += `M${x},${y}`
          started = true
        } else {
          d += `L${x},${y}`
        }
      }
      return d
    },
    [m]
  )

  const displayIdx = hoverIdx !== null ? hoverIdx : data.length - 1
  const displayItem = data.length > 0 ? data[displayIdx] : null
  const prevItem = displayIdx > 0 ? data[displayIdx - 1] : null
  const changeVal = displayItem && prevItem ? displayItem.close - prevItem.close : displayItem ? displayItem.close - displayItem.open : 0
  const changePct = displayItem && prevItem ? ((displayItem.close - prevItem.close) / prevItem.close) * 100 : displayItem ? ((displayItem.close - displayItem.open) / displayItem.open) * 100 : 0

  // 分时模式：渲染 MinuteChart
  if (period === 'minute') {
    return (
      <div>
        <div className="flex items-center gap-1 mb-2">
          {PERIOD_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={period === opt.value ? 'default' : 'outline'}
              className={
                period === opt.value
                  ? 'bg-blue-600 hover:bg-blue-700 h-7 text-xs'
                  : 'border-slate-600 text-slate-400 hover:bg-slate-700 h-7 text-xs'
              }
              onClick={() => setPeriod(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <MinuteChart symbol={symbol} title={title} />
      </div>
    )
  }

  return (
    <Card className="trading-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-white flex items-center text-base">
            <CandlestickChart className="w-4 h-4 mr-2 text-blue-400" />
            {title || `${symbol} K线图`}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* 周期切换 */}
            <div className="flex gap-1">
              {PERIOD_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={period === opt.value ? 'default' : 'outline'}
                  className={
                    period === opt.value
                      ? 'bg-blue-600 hover:bg-blue-700 h-7 text-xs'
                      : 'border-slate-600 text-slate-400 hover:bg-slate-700 h-7 text-xs'
                  }
                  onClick={() => setPeriod(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
            {/* 缩放按钮 */}
            <div className="flex gap-0.5 ml-1 border-l border-slate-600 pl-2">
              <Button
                size="sm"
                variant="outline"
                className="border-slate-600 text-slate-400 hover:bg-slate-700 h-7 w-7 p-0"
                onClick={handleZoomIn}
                title="放大（减少K线数量）"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-600 text-slate-400 hover:bg-slate-700 h-7 w-7 p-0"
                onClick={handleZoomOut}
                title="缩小（增加K线数量）"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-slate-600 text-slate-400 hover:bg-slate-700 h-7 w-7 p-0"
                onClick={handleZoomReset}
                title="重置缩放"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
        {/* MA 均线图例 */}
        {data.length > 0 && (
          <div className="flex items-center gap-3 text-xs mt-1">
            <span style={{ color: MA_COLORS[5] }}>
              MA5: {ma5[displayIdx] !== null ? formatPrice(ma5[displayIdx]!) : '--'}
            </span>
            <span style={{ color: MA_COLORS[10] }}>
              MA10: {ma10[displayIdx] !== null ? formatPrice(ma10[displayIdx]!) : '--'}
            </span>
            <span style={{ color: MA_COLORS[20] }}>
              MA20: {ma20[displayIdx] !== null ? formatPrice(ma20[displayIdx]!) : '--'}
            </span>
            <span className="text-slate-500 text-[10px] ml-auto">
              共{allData.length}根 / 显示{data.length}根
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-[360px]">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            <span className="ml-2 text-slate-400">加载K线数据...</span>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-[360px] text-slate-500">
            暂无K线数据
          </div>
        ) : (
          <div ref={containerRef} className="w-full flex">
            {/* 主图区域 */}
            <div className="flex-1 min-w-0">
              <svg
                ref={svgRef}
                width={m.totalW - m.infoW}
                height={totalH}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onWheel={handleWheel}
                className="select-none"
              >
                <rect width={m.totalW - m.infoW} height={totalH} fill="transparent" />

                {/* 价格区域网格线 */}
                {priceGridLines.map((line, i) => (
                  <g key={`pg-${i}`}>
                    <line
                      x1={m.marginL}
                      y1={line.y}
                      x2={m.totalW - m.infoW - m.marginR}
                      y2={line.y}
                      stroke={GRID_COLOR}
                      strokeWidth={1}
                    />
                    <text
                      x={m.marginL - 6}
                      y={line.y + 3}
                      textAnchor="end"
                      fill={TEXT_COLOR}
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      {line.label}
                    </text>
                  </g>
                ))}

                {/* 价格区域边框 */}
                <rect
                  x={m.marginL}
                  y={m.marginT}
                  width={m.canvasW}
                  height={m.mainH}
                  fill="none"
                  stroke={AXIS_COLOR}
                  strokeWidth={0.5}
                />

                {/* 成交量区域边框 */}
                <rect
                  x={m.marginL}
                  y={m.marginT + m.mainH + m.gapH}
                  width={m.canvasW}
                  height={m.volH}
                  fill="none"
                  stroke={AXIS_COLOR}
                  strokeWidth={0.5}
                />

                {/* 蜡烛图 */}
                {data.map((d: StockHistoryItem, i: number) => {
                  const isUp = d.close >= d.open
                  const color = isUp ? UP_COLOR : DOWN_COLOR
                  const x = candleX(i, m)
                  const cx = x + m.candleW / 2

                  const bodyTop = priceToY(Math.max(d.open, d.close), m)
                  const bodyBot = priceToY(Math.min(d.open, d.close), m)
                  const bodyH = Math.max(bodyBot - bodyTop, 1)
                  const wickTop = priceToY(d.high, m)
                  const wickBot = priceToY(d.low, m)

                  const vTop = volToY(d.volume, m)
                  const vBot = m.marginT + m.mainH + m.gapH + m.volH

                  return (
                    <g key={i}>
                      <line x1={cx} y1={wickTop} x2={cx} y2={wickBot} stroke={color} strokeWidth={1} />
                      <rect
                        x={x}
                        y={bodyTop}
                        width={m.candleW}
                        height={bodyH}
                        fill={color}
                        stroke={color}
                        strokeWidth={1}
                      />
                      <rect
                        x={x}
                        y={vTop}
                        width={m.candleW}
                        height={Math.max(vBot - vTop, 0.5)}
                        fill={color}
                        opacity={0.5}
                      />
                    </g>
                  )
                })}

                {/* MA 均线 */}
                <path d={maPath(ma5)} fill="none" stroke={MA_COLORS[5]} strokeWidth={1} opacity={0.9} />
                <path d={maPath(ma10)} fill="none" stroke={MA_COLORS[10]} strokeWidth={1} opacity={0.9} />
                <path d={maPath(ma20)} fill="none" stroke={MA_COLORS[20]} strokeWidth={1} opacity={0.9} />

                {/* 成交量 MA 均线 */}
                <path d={volMaPath(volMa5)} fill="none" stroke={VOL_MA_COLORS[5]} strokeWidth={1} opacity={0.7} />
                <path d={volMaPath(volMa10)} fill="none" stroke={VOL_MA_COLORS[10]} strokeWidth={1} opacity={0.7} />

                {/* X 轴日期标签 */}
                {data.map((d: StockHistoryItem, i: number) => {
                  const interval = Math.max(Math.floor(data.length / 6), 1)
                  if (i % interval !== 0 && i !== data.length - 1) return null
                  const x = candleX(i, m) + m.candleW / 2
                  const y = totalH - 2
                  return (
                    <text
                      key={`xl-${i}`}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      fill={TEXT_COLOR}
                      fontSize={9}
                      fontFamily="monospace"
                    >
                      {period === 'yearly' ? d.date.slice(0, 4) : d.date.slice(5)}
                    </text>
                  )
                })}

                {/* 成交量 Y 轴标签 */}
                <text
                  x={m.marginL - 6}
                  y={m.marginT + m.mainH + m.gapH + 12}
                  textAnchor="end"
                  fill={TEXT_COLOR}
                  fontSize={9}
                >
                  {formatVol(m.volMax / 1.15)}
                </text>

                {/* 十字准星 */}
                {hoverIdx !== null && hoverIdx < data.length && (
                  <>
                    <line
                      x1={candleX(hoverIdx, m) + m.candleW / 2}
                      y1={m.marginT}
                      x2={candleX(hoverIdx, m) + m.candleW / 2}
                      y2={m.marginT + m.mainH + m.gapH + m.volH}
                      stroke="#ffffff30"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                    <line
                      x1={m.marginL}
                      y1={priceToY(data[hoverIdx].close, m)}
                      x2={m.totalW - m.infoW - m.marginR}
                      y2={priceToY(data[hoverIdx].close, m)}
                      stroke="#ffffff30"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                    <rect
                      x={m.totalW - m.infoW - m.marginR}
                      y={priceToY(data[hoverIdx].close, m) - 9}
                      width={52}
                      height={18}
                      rx={3}
                      fill={data[hoverIdx].close >= data[hoverIdx].open ? UP_COLOR : DOWN_COLOR}
                    />
                    <text
                      x={m.totalW - m.infoW - m.marginR + 26}
                      y={priceToY(data[hoverIdx].close, m) + 3}
                      textAnchor="middle"
                      fill="white"
                      fontSize={10}
                      fontFamily="monospace"
                    >
                      {formatPrice(data[hoverIdx].close)}
                    </text>
                    <rect
                      x={candleX(hoverIdx, m) + m.candleW / 2 - 30}
                      y={m.marginT + m.mainH + m.gapH + m.volH + 2}
                      width={60}
                      height={16}
                      rx={3}
                      fill="#334155"
                    />
                    <text
                      x={candleX(hoverIdx, m) + m.candleW / 2}
                      y={m.marginT + m.mainH + m.gapH + m.volH + 13}
                      textAnchor="middle"
                      fill="white"
                      fontSize={9}
                      fontFamily="monospace"
                    >
                      {data[hoverIdx].date.slice(period === 'yearly' ? 0 : 5)}
                    </text>
                  </>
                )}
              </svg>
            </div>

            {/* 右侧固定信息面板 */}
            <div className="flex-shrink-0 border-l border-slate-700 pl-3 pr-1" style={{ width: m.infoW }}>
              {displayItem && (
                <div className="text-xs space-y-1.5 pt-2">
                  <div className="text-slate-500 text-[10px] mb-1">{displayItem.date}</div>
                  <InfoRow label="开盘" value={formatPrice(displayItem.open)} color={displayItem.open >= (prevItem?.close ?? displayItem.open) ? UP_COLOR : DOWN_COLOR} />
                  <InfoRow label="收盘" value={formatPrice(displayItem.close)} color={displayItem.close >= displayItem.open ? UP_COLOR : DOWN_COLOR} />
                  <InfoRow label="最高" value={formatPrice(displayItem.high)} color={UP_COLOR} />
                  <InfoRow label="最低" value={formatPrice(displayItem.low)} color={DOWN_COLOR} />
                  <div className="border-t border-slate-700 my-1" />
                  <InfoRow
                    label="涨跌"
                    value={`${changeVal >= 0 ? '+' : ''}${formatPrice(changeVal)}`}
                    color={changeVal >= 0 ? UP_COLOR : DOWN_COLOR}
                  />
                  <InfoRow
                    label="涨幅"
                    value={`${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%`}
                    color={changePct >= 0 ? UP_COLOR : DOWN_COLOR}
                  />
                  <InfoRow
                    label="振幅"
                    value={`${(((displayItem.high - displayItem.low) / (prevItem?.close ?? displayItem.open)) * 100).toFixed(2)}%`}
                    color={TEXT_COLOR}
                  />
                  <div className="border-t border-slate-700 my-1" />
                  <InfoRow label="成交量" value={formatVol(displayItem.volume)} color={TEXT_COLOR} />
                  <div className="border-t border-slate-700 my-1" />
                  <div className="space-y-0.5">
                    <div className="text-slate-500 text-[10px]">成交量MA</div>
                    <InfoRow label="MA5" value={volMa5[displayIdx] !== null ? formatVol(volMa5[displayIdx]!) : '--'} color={VOL_MA_COLORS[5]} />
                    <InfoRow label="MA10" value={volMa10[displayIdx] !== null ? formatVol(volMa10[displayIdx]!) : '--'} color={VOL_MA_COLORS[10]} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InfoRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono" style={{ color }}>{value}</span>
    </div>
  )
}
