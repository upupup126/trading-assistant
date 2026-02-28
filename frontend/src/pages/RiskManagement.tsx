import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Shield, Activity, AlertTriangle } from 'lucide-react'

export default function RiskManagement() {
  const metrics = [
    { label: '组合风险等级', value: 'MEDIUM', color: 'bg-amber-500/20 text-amber-200 border border-amber-500/30' },
    { label: '分散度评分', value: '0.62', color: 'bg-blue-500/20 text-blue-200 border border-blue-500/30' },
    { label: '波动率评分', value: '0.44', color: 'bg-purple-500/20 text-purple-200 border border-purple-500/30' },
  ]

  const alerts = [
    '仓位集中于单一行业，请关注系统性风险',
    '个别持仓连续放量下跌，建议设定动态止损',
    '市场情绪中性偏弱，控制杠杆与回撤',
  ]

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">风险控制</p>
            <h1 className="text-2xl sm:text-3xl font-bold">监控组合风险与敞口</h1>
            <p className="text-slate-400 mt-1">后续可接入 AI 风险评估与预警推送</p>
          </div>
          <Badge className="bg-emerald-600 hover:bg-emerald-700">实时监控</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <Card key={m.label} className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-slate-400">{m.label}</CardDescription>
                <CardTitle className="text-2xl text-white">{m.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={m.color}>监控中</Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-emerald-400" /> 风险提示
            </CardTitle>
            <CardDescription className="text-slate-400">示例提示，后续可接 AI 风险模型</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((tip, idx) => (
              <div key={idx} className="flex items-start gap-2 text-slate-200">
                <AlertTriangle className="w-4 h-4 mt-1 text-amber-400" />
                <span>{tip}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
