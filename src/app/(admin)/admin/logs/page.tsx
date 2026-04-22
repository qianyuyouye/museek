'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { SearchBar } from '@/components/ui/search-bar'
import { DataTable, Column } from '@/components/ui/data-table'
import { useApi } from '@/lib/use-api'
import { pageWrap, cardCls, btnPrimary, btnGhost } from '@/lib/ui-tokens'
import { formatDateTime } from '@/lib/format'

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

  // 英文 action → 中文映射；未命中的保持原样（兼容历史中文 action）
  const ACTION_LABEL: Record<string, string> = {
    create_group: '创建用户组',
    update_group: '更新用户组',
    delete_group: '删除用户组',
    regenerate_invite: '重新生成邀请码',
    toggle_group_status: '切换组状态',
    create_assignment: '创建作业',
    update_assignment: '更新作业',
    update_form_fields: '配置作业表单',
    create_reviewer: '创建评审账号',
    update_admin: '更新管理员',
    create_admin: '创建管理员',
    delete_admin: '删除管理员',
    create_role: '创建角色',
    update_role: '更新角色',
    delete_role: '删除角色',
    reset_password: '重置密码',
    toggle_user_status: '切换账号状态',
    update_student: '更新学员',
    notify_student: '推送提醒',
    approve_realname: '审核实名通过',
    reject_realname: '驳回实名',
    song_publish: '确认发行',
    song_reject: '退回歌曲',
    song_archive: '归档歌曲',
    song_restore: '恢复归档',
    song_review_done: '评审归档',
    assign_isrc: '绑定 ISRC',
    upsert_distribution: '更新发行渠道',
    sync_distributions: '触发对账同步',
    confirm_distribution: '确认上架',
    mark_distribution_exception: '标记异常',
    import_revenue_csv: '导入收益报表',
    bind_mapping: '绑定映射',
    confirm_mapping: '确认映射',
    reject_mapping: '标记无关',
    settlement_confirm: '确认结算',
    settlement_export: '导出结算',
    settlement_pay: '标记打款',
    update_system_setting: '更新系统设置',
    update_content: '更新内容',
    create_content: '新建内容',
    publish_content: '发布内容',
    unpublish_content: '下架内容',
    delete_content: '删除内容',
    songs_batch_download: '批量下载',
  }
  const translateAction = (v: string) => ACTION_LABEL[v] ?? v

  const columns: Column<LogItem>[] = [
    { key: 'createdAt', title: '时间', render: (v) => <span>{formatDateTime(v as string)}</span> },
    { key: 'operatorName', title: '操作人', render: (v) => <span>{(v as string) || '系统'}</span> },
    {
      key: 'action',
      title: '操作行为',
      render: (v) => <span style={{ fontWeight: 600 }}>{translateAction(v as string)}</span>,
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
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
        />
      </div>
    </div>
  )
}
