import React, { useMemo, useRef, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import type { BacktestKlineItem } from '@/lib/api'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'

interface BacktestChartProps {
  klineData: BacktestKlineItem[]
  height?: number
}

export default function BacktestChart({ klineData, height = 560 }: BacktestChartProps) {
  const chartRef = useRef<ReactECharts>(null)

  const handleZoom = useCallback((direction: 'in' | 'out' | 'reset') => {
    const instance = chartRef.current?.getEchartsInstance()
    if (!instance) return
    const option = instance.getOption() as any
    const dz = option.dataZoom?.[0]
    if (!dz) return
    const currentStart = dz.start ?? 0
    const currentEnd = dz.end ?? 100
    const range = currentEnd - currentStart
    let newStart: number, newEnd: number
    if (direction === 'reset') {
      newStart = 0
      newEnd = 100
    } else if (direction === 'in') {
      const step = Math.max(range * 0.2, 2)
      newStart = Math.min(currentStart + step, currentEnd - 2)
      newEnd = Math.max(currentEnd - step, currentStart + 2)
    } else {
      const step = Math.max(range * 0.3, 3)
      newStart = Math.max(currentStart - step, 0)
      newEnd = Math.min(currentEnd + step, 100)
    }
    instance.dispatchAction({ type: 'dataZoom', start: newStart, end: newEnd })
  }, [])

  const option = useMemo(() => {
    if (!klineData || klineData.length === 0) return {}

    const dates = klineData.map(d => d.date)
    const ohlc = klineData.map(d => [d.open, d.close, d.low, d.high])
    const volumes = klineData.map(d => d.volume)
    const ma5 = klineData.map(d => d.ma5 ?? null)
    const ma10 = klineData.map(d => d.ma10 ?? null)
    const ma20 = klineData.map(d => d.ma20 ?? null)
    const ma60 = klineData.map(d => d.ma60 ?? null)

    // 买卖点标记
    const buyPoints: any[] = []
    const sellPoints: any[] = []
    klineData.forEach((d, i) => {
      if (d.signal === 1) {
        buyPoints.push({
          coord: [i, d.low],
          value: `买 ${d.close}`,
          itemStyle: { color: '#ef4444' },
        })
      } else if (d.signal === -1) {
        sellPoints.push({
          coord: [i, d.high],
          value: `卖 ${d.close}`,
          itemStyle: { color: '#22c55e' },
        })
      }
    })

    // 成交量颜色
    const volumeColors = klineData.map(d => (d.close >= d.open ? '#ef4444' : '#22c55e'))

    return {
      animation: false,
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: '#334155',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return ''
          const idx = params[0].dataIndex
          const d = klineData[idx]
          if (!d) return ''
          const change = d.close - d.open
          const changePct = ((change / d.open) * 100).toFixed(2)
          const color = change >= 0 ? '#ef4444' : '#22c55e'
          let signalText = ''
          if (d.signal === 1) signalText = '<br/><span style="color:#ef4444;font-weight:bold">★ 买入信号</span>'
          if (d.signal === -1) signalText = '<br/><span style="color:#22c55e;font-weight:bold">★ 卖出信号</span>'

          return `
            <div style="font-size:12px">
              <div style="font-weight:bold;margin-bottom:4px">${d.date}</div>
              <div>开盘: <span style="color:${color}">${d.open}</span></div>
              <div>收盘: <span style="color:${color}">${d.close}</span></div>
              <div>最高: ${d.high}</div>
              <div>最低: ${d.low}</div>
              <div>涨跌: <span style="color:${color}">${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePct}%)</span></div>
              <div>成交量: ${(d.volume / 10000).toFixed(0)}万</div>
              ${d.ma5 ? `<div style="color:#f59e0b">MA5: ${d.ma5}</div>` : ''}
              ${d.ma10 ? `<div style="color:#8b5cf6">MA10: ${d.ma10}</div>` : ''}
              ${d.ma20 ? `<div style="color:#3b82f6">MA20: ${d.ma20}</div>` : ''}
              ${d.ma60 ? `<div style="color:#ec4899">MA60: ${d.ma60}</div>` : ''}
              ${signalText}
            </div>
          `
        },
      },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
      },
      grid: [
        { left: '8%', right: '4%', top: '6%', height: '55%' },
        { left: '8%', right: '4%', top: '68%', height: '18%' },
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          gridIndex: 0,
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: { color: '#94a3b8', fontSize: 10 },
          splitLine: { show: false },
          boundaryGap: true,
          axisPointer: { show: true },
        },
        {
          type: 'category',
          data: dates,
          gridIndex: 1,
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: { show: false },
          splitLine: { show: false },
          boundaryGap: true,
          axisPointer: { show: true },
        },
      ],
      yAxis: [
        {
          type: 'value',
          gridIndex: 0,
          scale: true,
          splitArea: { show: false },
          splitLine: { lineStyle: { color: '#1e293b' } },
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: { color: '#94a3b8', fontSize: 10 },
        },
        {
          type: 'value',
          gridIndex: 1,
          scale: true,
          splitNumber: 2,
          splitArea: { show: false },
          splitLine: { lineStyle: { color: '#1e293b' } },
          axisLine: { lineStyle: { color: '#475569' } },
          axisLabel: {
            color: '#94a3b8',
            fontSize: 10,
            formatter: (v: number) => `${(v / 10000).toFixed(0)}万`,
          },
        },
      ],
      dataZoom: [
        {
          type: 'slider',
          xAxisIndex: [0, 1],
          top: '90%',
          height: 20,
          borderColor: '#334155',
          backgroundColor: '#0f172a',
          fillerColor: 'rgba(59, 130, 246, 0.15)',
          handleStyle: { color: '#3b82f6' },
          textStyle: { color: '#94a3b8' },
          start: Math.max(0, 100 - Math.min(100, (120 / dates.length) * 100)),
          end: 100,
        },
      ],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: ohlc,
          itemStyle: {
            color: '#ef4444',
            color0: '#22c55e',
            borderColor: '#ef4444',
            borderColor0: '#22c55e',
          },
          markPoint: {
            data: [
              ...buyPoints.map(p => ({
                ...p,
                symbol: 'triangle',
                symbolSize: 12,
                symbolRotate: 0,
                label: {
                  show: true,
                  position: 'bottom',
                  formatter: '买',
                  color: '#ef4444',
                  fontSize: 10,
                  fontWeight: 'bold',
                },
              })),
              ...sellPoints.map(p => ({
                ...p,
                symbol: 'triangle',
                symbolSize: 12,
                symbolRotate: 180,
                label: {
                  show: true,
                  position: 'top',
                  formatter: '卖',
                  color: '#22c55e',
                  fontSize: 10,
                  fontWeight: 'bold',
                },
              })),
            ],
          },
        },
        {
          name: 'MA5',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: ma5,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: '#f59e0b' },
        },
        {
          name: 'MA10',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: ma10,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: '#8b5cf6' },
        },
        {
          name: 'MA20',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: ma20,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: '#3b82f6' },
        },
        {
          name: 'MA60',
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: ma60,
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 1, color: '#ec4899' },
        },
        {
          name: '成交量',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumes,
          itemStyle: {
            color: (params: any) => volumeColors[params.dataIndex] || '#475569',
          },
        },
      ],
    }
  }, [klineData])

  if (!klineData || klineData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        暂无K线数据
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="absolute top-2 right-4 z-10 flex items-center gap-1">
        <button
          onClick={() => handleZoom('in')}
          className="p-1.5 rounded bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
          title="放大"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom('out')}
          className="p-1.5 rounded bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
          title="缩小"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom('reset')}
          className="p-1.5 rounded bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white transition-colors"
          title="重置视图"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: `${height}px`, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge
        lazyUpdate
      />
    </div>
  )
}
