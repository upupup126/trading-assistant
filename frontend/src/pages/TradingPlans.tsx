import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Calendar, ListChecks } from 'lucide-react'

export default function TradingPlans() {
  const templates = [
    {
      id: 'plan-1',
      name: '趋势跟随计划',
      description: '以指数多头趋势为主，分批建仓，移动止损。',
      horizon: '中期',
    },
    {
      id: 'plan-2',
      name: '超跌反弹计划',
      description: '选择超跌高流动性龙头，3-5日内博弈反弹。',
      horizon: '短期',
    },
    {
      id: 'plan-3',
      name: '价值均衡计划',
      description: '高分红/低估值组合定投，月度再平衡。',
      horizon: '长期',
    },
  ]

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">交易计划</p>
            <h1 className="text-2xl sm:text-3xl font-bold">制定与管理交易计划</h1>
            <p className="text-slate-400 mt-1">创建新计划或快速使用模板，支持后续接入 AI 建议</p>
          </div>
          <div className="flex gap-2">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> 新建计划
            </Button>
            <Button variant="outline" className="border-slate-600 text-slate-200">
              <ListChecks className="w-4 h-4 mr-2" /> 查看全部
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="bg-slate-800 border-slate-700 h-full">
              <CardHeader>
                <CardTitle className="text-lg">{tpl.name}</CardTitle>
                <CardDescription className="text-slate-400">{tpl.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Calendar className="w-4 h-4" />
                  <span>持有周期：{tpl.horizon}</span>
                </div>
                <Badge variant="outline" className="border-blue-500 text-blue-200 bg-blue-500/10">模板</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
