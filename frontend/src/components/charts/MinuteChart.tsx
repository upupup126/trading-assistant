import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAIStore } from '@/stores/aiStore'
import { Loader2, LineChart } from 'lucide-react'

interface MinuteChartProps {
  symbol: string
  title?: string
}

const UP_COLOR = '#ef4444'
const DOWN_COLOR = '#22c55e'
const FLAT_COLOR = '#3b82f6'
const GRID_COLOR = '#1e293b'
const AXIS_COLOR = '#475569'
const TEXT_COLOR = '#94a3b8'
const AVG_COLOR = '#f59e0b'

function formatPrice(v: number): string {
  return v.toFixed(2)
}

function formatVol(v: number): string {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + '亿'
  if (v >= 1e4) return (v / 1e4).toFixed(0) + '万'
  return v.toFixed(0)
}

export default function MinuteChart({ symbol, title }: MinuteChartProps) {
  const { minuteData, loadingStates, getMinuteData } = useAIStore()
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(800)

  const loadingKey = `minuteData_${symbol}`
  const isLoading = loadingStates[loadingKey]
  const data = minuteData[symbol]

  useEffect(() => {
    if (symbol) {
      getMinuteData(symbol).catch(() => {})
    }
  }, [symbol])

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

  const minutes = data?.minutes || []
  const prevClose = data?.prev_close || 0

  // 计算均价线
  const avgPrices = useMemo(() => {
    if (minutes.length === 0) return []
    let totalAmount = 0
    let totalVol = 0
    return minutes.map((m) => {
      totalAmount += m.price * m.volume
      totalVol += m.volume
      return totalVol > 0 ? totalAmount / totalVol : m.price
    })
  }, [minutes])

  // 计算布局
  const marginL = 60
  const marginR = 10
  const marginT = 12
  const mainH = 220
  const volH = 50
  const gapH = 6
  const infoW = 140
  const totalH = marginT + mainH + gapH + volH + 24

  const canvasW = containerWidth - marginL - marginR - infoW
  const count = minutes.length || 1

  // 价格范围（以昨收为中心对称）
  const { priceMin, priceMax, maxChangePct } = useMemo(() => {
    if (minutes.length === 0 || prevClose === 0) {
      return { priceMin: 0, priceMax: 100, maxChangePct: 0 }
    }
    let maxDiff = 0
    for (const m of minutes) {
      maxDiff = Math.max(maxDiff, Math.abs(m.price - prevClose))
    }
    maxDiff = Math.max(maxDiff, prevClose * 0.01) // 至少 1%
    const padding = maxDiff * 0.1
    return {
      priceMin: prevClose - maxDiff - padding,
      priceMax: prevClose + maxDiff + padding,
      maxChangePct: ((maxDiff + padding) / prevClose) * 100,
    }
  }, [minutes, prevClose])

  const volMax = useMemo(() => {
    if (minutes.length === 0) return 1
    return Math.max(...minutes.map((m) => m.volume)) * 1.15 || 1
  }, [minutes])

  const priceToY = (price: number) => {
    return marginT + mainH - ((price - priceMin) / (priceMax - priceMin)) * mainH
  }

  const volToY = (vol: number) => {
    const volTop = marginT + mainH + gapH
    return volTop + volH - (vol / volMax) * volH
  }

  const xForIdx = (i: number) => {
    return marginL + (i / Math.max(count - 1, 1)) * canvasW
  }

  // 价格折线路径
  const pricePath = useMemo(() => {
    if (minutes.length === 0) return ''
    return minutes
      .map((m, i) => `${i === 0 ? 'M' : 'L'}${xForIdx(i)},${priceToY(m.price)}`)
      .join('')
  }, [minutes, priceMin, priceMax, canvasW])

  // 均价折线路径
  const avgPath = useMemo(() => {
    if (avgPrices.length === 0) return ''
    return avgPrices
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${xForIdx(i)},${priceToY(v)}`)
      .join('')
  }, [avgPrices, priceMin, priceMax, canvasW])

  // 填充区域
  const fillPath = useMemo(() => {
    if (minutes.length === 0) return ''
    const baseline = priceToY(prevClose)
    let d = `M${xForIdx(0)},${baseline}`
    for (let i = 0; i < minutes.length; i++) {
      d += `L${xForIdx(i)},${priceToY(minutes[i].price)}`
    }
    d += `L${xForIdx(minutes.length - 1)},${baseline}Z`
    return d
  }, [minutes, prevClose, priceMin, priceMax, canvasW])

  // 价格网格线
  const priceGridLines = useMemo(() => {
    const lines: { y: number; price: number; pct: number }[] = []
    const steps = 4
    for (let i = 0; i <= steps; i++) {
      const price = priceMin + ((priceMax - priceMin) / steps) * i
      const pct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0
      lines.push({ y: priceToY(price), price, pct })
    }
    return lines
  }, [priceMin, priceMax, prevClose])

  // 时间标签
  const timeLabels = useMemo(() => {
    const labels = ['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00']
    // A股交易分钟总数 = 240
    const totalMinutes = 240
    return labels.map((t) => {
      const [h, m] = t.split(':').map(Number)
      let minuteIndex: number
      if (h < 12) {
        minuteIndex = (h - 9) * 60 + m - 30
      } else {
        minuteIndex = 120 + (h - 13) * 60 + m
      }
      const x = marginL + (minuteIndex / totalMinutes) * canvasW
      return { x, label: t }
    })
  }, [canvasW])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || minutes.length === 0) return
      const rect = svgRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left - marginL
      if (x < 0 || x > canvasW) {
        setHoverIdx(null)
        return
      }
      const idx = Math.round((x / canvasW) * (minutes.length - 1))
      setHoverIdx(idx >= 0 && idx < minutes.length ? idx : null)
    },
    [minutes, canvasW]
  )

  const handleMouseLeave = useCallback(() => setHoverIdx(null), [])

  const displayIdx = hoverIdx !== null ? hoverIdx : minutes.length - 1
  const displayItem = minutes.length > 0 ? minutes[displayIdx] : null
  const displayChange = displayItem && prevClose ? displayItem.price - prevClose : 0
  const displayChangePct = displayItem && prevClose ? (displayChange / prevClose) * 100 : 0

  return (
    <Card className="trading-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center text-base">
            <LineChart className="w-4 h-4 mr-2 text-blue-400" />
            {title || `${symbol} 分时走势`}
          </CardTitle>
          {data && (
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">
                {data.trade_date} {data.is_trading ? '(交易中)' : '(已收盘)'}
              </span>
            </div>
          )}
        </div>
        {/* 图例 */}
        {minutes.length > 0 && (
          <div className="flex items-center gap-4 text-xs mt-1">
            <span style={{ color: FLAT_COLOR }}>— 价格</span>
            <span style={{ color: AVG_COLOR }}>— 均价</span>
            <span className="text-slate-500">昨收: {formatPrice(prevClose)}</span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-[310px]">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            <span className="ml-2 text-slate-400">加载分时数据...</span>
          </div>
        ) : minutes.length === 0 ? (
          <div className="flex items-center justify-center h-[310px] text-slate-500">
            暂无分时数据
          </div>
        ) : (
          <div ref={containerRef} className="w-full flex">
            <div className="flex-1 min-w-0">
              <svg
                ref={svgRef}
                width={containerWidth - infoW}
                height={totalH}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="select-none"
              >
                <rect width={containerWidth - infoW} height={totalH} fill="transparent" />

                {/* 价格区域网格线 */}
                {priceGridLines.map((line, i) => (
                  <g key={`pg-${i}`}>
                    <line
                      x1={marginL}
                      y1={line.y}
                      x2={containerWidth - infoW - marginR}
                      y2={line.y}
                      stroke={GRID_COLOR}
                      strokeWidth={1}
                    />
                    <text x={marginL - 6} y={line.y + 3} textAnchor="end" fill={TEXT_COLOR} fontSize={10} fontFamily="monospace">
                      {formatPrice(line.price)}
                    </text>
                    <text x={containerWidth - infoW - marginR + 4} y={line.y + 3} textAnchor="start" fill={line.pct >= 0 ? UP_COLOR : DOWN_COLOR} fontSize={9} fontFamily="monospace">
                      {line.pct >= 0 ? '+' : ''}{line.pct.toFixed(2)}%
                    </text>
                  </g>
                ))}

                {/* 昨收基准线 */}
                <line
                  x1={marginL}
                  y1={priceToY(prevClose)}
                  x2={containerWidth - infoW - marginR}
                  y2={priceToY(prevClose)}
                  stroke={AXIS_COLOR}
                  strokeWidth={1}
                  strokeDasharray="4 2"
                />

                {/* 价格区域边框 */}
                <rect x={marginL} y={marginT} width={canvasW} height={mainH} fill="none" stroke={AXIS_COLOR} strokeWidth={0.5} />
                {/* 成交量区域边框 */}
                <rect x={marginL} y={marginT + mainH + gapH} width={canvasW} height={volH} fill="none" stroke={AXIS_COLOR} strokeWidth={0.5} />

                {/* 填充区域 */}
                <defs>
                  <linearGradient id="minuteFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={FLAT_COLOR} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={FLAT_COLOR} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <path d={fillPath} fill="url(#minuteFill)" />

                {/* 价格折线 */}
                <path d={pricePath} fill="none" stroke={FLAT_COLOR} strokeWidth={1.5} />
                {/* 均价折线 */}
                <path d={avgPath} fill="none" stroke={AVG_COLOR} strokeWidth={1} opacity={0.8} />

                {/* 成交量柱状图 */}
                {minutes.map((m, i) => {
                  const isUp = i === 0 ? m.price >= prevClose : m.price >= minutes[i - 1].price
                  const barW = Math.max(canvasW / count - 0.5, 1)
                  const x = xForIdx(i) - barW / 2
                  const vTop = volToY(m.volume)
                  const vBot = marginT + mainH + gapH + volH
                  return (
                    <rect
                      key={i}
                      x={x}
                      y={vTop}
                      width={barW}
                      height={Math.max(vBot - vTop, 0.5)}
                      fill={isUp ? UP_COLOR : DOWN_COLOR}
                      opacity={0.5}
                    />
                  )
                })}

                {/* 时间标签 */}
                {timeLabels.map((t, i) => (
                  <text
                    key={`tl-${i}`}
                    x={t.x}
                    y={totalH - 2}
                    textAnchor="middle"
                    fill={TEXT_COLOR}
                    fontSize={9}
                    fontFamily="monospace"
                  >
                    {t.label}
                  </text>
                ))}

                {/* 十字准星 */}
                {hoverIdx !== null && hoverIdx < minutes.length && (
                  <>
                    <line
                      x1={xForIdx(hoverIdx)}
                      y1={marginT}
                      x2={xForIdx(hoverIdx)}
                      y2={marginT + mainH + gapH + volH}
                      stroke="#ffffff30"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                    <line
                      x1={marginL}
                      y1={priceToY(minutes[hoverIdx].price)}
                      x2={containerWidth - infoW - marginR}
                      y2={priceToY(minutes[hoverIdx].price)}
                      stroke="#ffffff30"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={xForIdx(hoverIdx)}
                      cy={priceToY(minutes[hoverIdx].price)}
                      r={3}
                      fill={FLAT_COLOR}
                      stroke="white"
                      strokeWidth={1}
                    />
                  </>
                )}
              </svg>
            </div>

            {/* 右侧信息面板 */}
            <div className="flex-shrink-0 border-l border-slate-700 pl-3 pr-1" style={{ width: infoW }}>
              {displayItem && (
                <div className="text-xs space-y-1.5 pt-2">
                  <div className="text-slate-500 text-[10px] mb-1">{displayItem.time}</div>
                  <InfoRow label="价格" value={formatPrice(displayItem.price)} color={displayChange >= 0 ? UP_COLOR : DOWN_COLOR} />
                  <InfoRow label="均价" value={avgPrices[displayIdx] !== undefined ? formatPrice(avgPrices[displayIdx]) : '--'} color={AVG_COLOR} />
                  <div className="border-t border-slate-700 my-1" />
                  <InfoRow
                    label="涨跌"
                    value={`${displayChange >= 0 ? '+' : ''}${formatPrice(displayChange)}`}
                    color={displayChange >= 0 ? UP_COLOR : DOWN_COLOR}
                  />
                  <InfoRow
                    label="涨幅"
                    value={`${displayChangePct >= 0 ? '+' : ''}${displayChangePct.toFixed(2)}%`}
                    color={displayChangePct >= 0 ? UP_COLOR : DOWN_COLOR}
                  />
                  <div className="border-t border-slate-700 my-1" />
                  <InfoRow label="成交量" value={formatVol(displayItem.volume)} color={TEXT_COLOR} />
                  <div className="border-t border-slate-700 my-1" />
                  <InfoRow label="昨收" value={formatPrice(prevClose)} color={TEXT_COLOR} />
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
