import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, Plus, Clock3 } from 'lucide-react'

export default function Alerts() {
  const alerts = [
    { id: 'a1', title: '上证指数 跌破 4100', type: '价格预警', status: '已启用' },
    { id: 'a2', title: '贵州茅台 日内涨幅 > 3%', type: '价格预警', status: '已启用' },
    { id: 'a3', title: '新能源板块 5日涨幅 < -5%', type: '板块监控', status: '暂停' },
  ]

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">智能提醒</p>
            <h1 className="text-2xl sm:text-3xl font-bold">价格与事件提醒</h1>
            <p className="text-slate-400 mt-1">示例列表，可扩展到消息推送、短信/邮件等</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> 新建提醒
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.map((item) => (
            <Card key={item.id} className="bg-slate-800 border-slate-700">
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-400" />
                      {item.title}
                    </CardTitle>
                    <CardDescription className="text-slate-400">{item.type}</CardDescription>
                  </div>
                  <Badge className={item.status === '已启用' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' : 'bg-slate-600 text-white'}>
                    {item.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <Clock3 className="w-4 h-4" />
                  <span>最近更新：5 分钟前</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-slate-600 text-slate-200">编辑</Button>
                  <Button size="sm" variant="outline" className="border-slate-600 text-slate-200">暂停</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
