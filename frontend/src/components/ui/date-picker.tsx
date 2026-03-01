import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react'

interface DatePickerProps {
  value: string // 'YYYY-MM-DD' or ''
  onChange: (value: string) => void
  placeholder?: string
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export function DatePicker({ value, onChange, placeholder = '选择日期' }: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 })

  const parsed = value ? new Date(value) : new Date()
  const [viewYear, setViewYear] = useState(parsed.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed.getMonth())

  useEffect(() => {
    if (value) {
      const d = new Date(value)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    }
  }, [value])

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const panelHeight = 340
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow >= panelHeight
      ? rect.bottom + 4
      : rect.top - panelHeight - 4
    setPanelPos({
      top: Math.max(4, top),
      left: Math.max(4, Math.min(rect.left, window.innerWidth - 288)),
    })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    const onScroll = () => updatePosition()
    const onResize = () => updatePosition()
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        panelRef.current && !panelRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth)

  const selectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    onChange(`${viewYear}-${m}-${d}`)
    setOpen(false)
  }

  const selectedDay = value ? (() => {
    const parts = value.split('-')
    if (parseInt(parts[0]) === viewYear && parseInt(parts[1]) === viewMonth + 1) {
      return parseInt(parts[2])
    }
    return -1
  })() : -1

  const today = new Date()
  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth ? today.getDate() : -1

  const displayText = value || ''

  return (
    <div className="relative flex-1">
      <div
        ref={triggerRef}
        className="flex items-center h-9 w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1 text-sm text-white shadow-sm cursor-pointer hover:border-slate-500 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <Calendar className="w-4 h-4 text-blue-400 mr-2 flex-shrink-0" />
        {displayText ? (
          <span>{displayText}</span>
        ) : (
          <span className="text-slate-500">{placeholder}</span>
        )}
        {displayText && (
          <button
            className="ml-auto text-slate-400 hover:text-white p-0.5"
            onClick={e => { e.stopPropagation(); onChange(''); }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && createPortal(
        <div
          ref={panelRef}
          className="fixed w-[280px] bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-3"
          style={{ top: panelPos.top, left: panelPos.left, zIndex: 99999 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={prevMonth}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-white">
              {viewYear}年 {MONTHS[viewMonth]}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-0 mb-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-xs text-slate-500 py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const isSelected = day === selectedDay
              const isToday = day === todayDay
              return (
                <button
                  key={day}
                  onClick={() => selectDay(day)}
                  className={`h-8 w-full rounded text-xs font-medium transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : isToday
                      ? 'bg-slate-700 text-blue-400 ring-1 ring-blue-500/50'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mt-2 pt-2 border-t border-slate-700">
            <button
              className="flex-1 text-xs text-slate-400 hover:text-white py-1 rounded hover:bg-slate-700 transition-colors"
              onClick={() => {
                const t = new Date()
                const m = String(t.getMonth() + 1).padStart(2, '0')
                const d = String(t.getDate()).padStart(2, '0')
                onChange(`${t.getFullYear()}-${m}-${d}`)
                setOpen(false)
              }}
            >
              今天
            </button>
            <button
              className="flex-1 text-xs text-slate-400 hover:text-white py-1 rounded hover:bg-slate-700 transition-colors"
              onClick={() => { onChange(''); setOpen(false) }}
            >
              清除
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
