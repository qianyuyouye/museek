'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { SearchBar } from '@/components/admin/search-bar'
import { DataTable, Column } from '@/components/admin/data-table'
import { useApi } from '@/lib/use-api'
import { pageWrap, cardCls, btnPrimary, btnGhost } from '@/lib/ui-tokens'

interface LogItem {
  id: number
  createdAt: string
  operatorName: string
  action: string
  targetType: string
  targetId: string
  ip: string
}

const selectCls =
  'px-3.5 py-2.5 bg-white border-[1.5px] border-[var(--border)] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] appearance-none cursor-pointer'

const ACTION_TYPES = ['全部', '歌曲评审', '发行确认', '收益结算', '用户管理']

const dateCls =
  'px-3.5 py-2.5 bg-white border-[1.5px] border-[var(--border)] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] cursor-pointer'

export default function AdminLogsPage() {
  const [keyword, setKeyword] = useState('')
  const [actionType, setActionType] = useState('全部')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const dateParams = `${startDate ? `&startDate=${startDate}` : ''}${endDate ? `&endDate=${endDate}` : ''}`

  const { data, loading } = useApi<{ list: LogItem[]; total: number }>(
    `/api/admin/logs?${actionType !== '全部' ? `actionType=${encodeURIComponent(actionType)}&` : ''}search=${encodeURIComponent(keyword)}${dateParams}`,
    [actionType, keyword, startDate, endDate],
  )

  const filtered = data?.list ?? []

  const columns: Column<LogItem>[] = [
    { key: 'createdAt', title: '时间', render: (v) => <span>{new Date(v as string).toLocaleString('zh-CN')}</span> },
    { key: 'operatorName', title: '操作人', render: (v) => <span>{(v as string) || '系统'}</span> },
    {
      key: 'action',
      title: '操作行为',
      render: (v) => <span style={{ fontWeight: 600 }}>{v as string}</span>,
    },
    { key: 'targetId', title: '对象' },
    { key: 'ip', title: 'IP地址' },
  ]

  return (
    <div className={pageWrap}>
      <PageHeader title="操作日志" subtitle={loading ? '加载中...' : '系统操作审计追踪'} />

      {/* 筛选栏 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text2)] whitespace-nowrap">操作类型</span>
          <select
            className={selectCls}
            value={actionType}
            onChange={(e) => setActionType(e.target.value)}
          >
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text2)] whitespace-nowrap">日期范围</span>
          <input
            type="date"
            className={dateCls}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-[var(--text3)]">—</span>
          <input
            type="date"
            className={dateCls}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <SearchBar
          value={keyword}
          onChange={setKeyword}
          placeholder="请输入操作类型、操作人"
          className="w-[260px]"
        />
        <button className={btnPrimary} onClick={() => { /* 搜索触发已由状态驱动 */ }}>
          搜索
        </button>
        <button
          className={btnGhost}
          onClick={() => { setKeyword(''); setActionType('全部'); setStartDate(''); setEndDate('') }}
        >
          重置
        </button>
      </div>

      {/* 表格 */}
      <div className={cardCls}>
        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={filtered as unknown as Record<string, unknown>[]}
          rowKey={(r) => (r as unknown as LogItem).id}
        />
      </div>
    </div>
  )
}
