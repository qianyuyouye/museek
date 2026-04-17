'use client'

import { useState } from 'react'
import { useApi, apiCall } from '@/lib/use-api'

// ── Types ──────────────────────────────────────────────────────

type NotificationType = 'work' | 'revenue' | 'system'

interface Notification {
  id: number
  type: NotificationType
  title: string
  time: string
  read: boolean
}

// ── Constants ──────────────────────────────────────────────────

const TYPE_LABEL: Record<NotificationType, string> = {
  work: '作品动态',
  revenue: '收益通知',
  system: '系统消息',
}

const TABS: { key: 'all' | NotificationType; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'work', label: '作品动态' },
  { key: 'revenue', label: '收益通知' },
  { key: 'system', label: '系统消息' },
]

// ── Page Component ─────────────────────────────────────────────

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<'all' | NotificationType>('all')

  const typeParam = activeTab === 'all' ? '' : activeTab
  const { data, loading, refetch } = useApi<{ list: Notification[]; total: number; unreadCount: number; typeCounts?: Record<string, number> }>(
    `/api/creator/notifications?type=${typeParam}`,
    [activeTab],
  )

  const notifications = data?.list ?? []
  const unreadCount = data?.unreadCount ?? 0

  // Tab counts from API (always accurate regardless of current filter)
  const apiTypeCounts = data?.typeCounts
  const tabCounts: Record<string, number> = apiTypeCounts ?? {
    all: notifications.length,
    work: notifications.filter((n) => n.type === 'work').length,
    revenue: notifications.filter((n) => n.type === 'revenue').length,
    system: notifications.filter((n) => n.type === 'system').length,
  }

  // When a specific tab is active, the API already returns filtered data
  const filteredNotifications = notifications

  // Mark single as read
  const markAsRead = async (id: number) => {
    await apiCall('/api/creator/notifications', 'PUT', { id })
    refetch()
  }

  // Mark all as read
  const markAllAsRead = async () => {
    await apiCall('/api/creator/notifications', 'PUT', { all: true })
    refetch()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-[var(--text3)]">加载中...</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-bold text-[#1a1a2e]">消息中心</h1>
          {unreadCount > 0 && (
            <span className="text-xs text-[#ef4444] font-medium">
              {unreadCount}条未读<span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444] ml-0.5 align-middle" />
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            className="text-xs text-[#6366f1] hover:text-[#4f46e5] cursor-pointer bg-transparent border-0 transition-colors"
            onClick={markAllAsRead}
          >
            全部标为已读
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 mb-4 border-b border-[#e8edf5]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`pb-2.5 text-sm border-0 bg-transparent cursor-pointer transition-colors relative ${
              activeTab === tab.key
                ? 'text-[#1a1a2e] font-semibold'
                : 'text-[#94a3b8] hover:text-[#64748b]'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span className="ml-1 text-xs text-[#94a3b8]">{tabCounts[tab.key]}</span>
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#6366f1] rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="bg-white rounded-xl border border-[#e8edf5]">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-20 text-[#94a3b8]">
            <span className="text-4xl block mb-3">📭</span>
            <p className="text-sm">暂无消息</p>
          </div>
        ) : (
          filteredNotifications.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-3 px-5 py-4 border-b border-[#f1f5f9] last:border-b-0 cursor-pointer transition-colors hover:bg-[#f8fafc]"
              style={!n.read ? { backgroundColor: 'rgba(108,92,231,0.05)' } : undefined}
              onClick={() => markAsRead(n.id)}
            >
              {/* Unread dot */}
              <div className="pt-1.5 w-3 shrink-0 flex justify-center">
                {!n.read && (
                  <span className="block w-2 h-2 rounded-full bg-[#6366f1]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className={`text-sm leading-relaxed ${!n.read ? 'font-bold text-[#1a1a2e]' : 'text-[#334155]'}`}>
                  {n.title}
                  {!n.read && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444] ml-1 align-middle" />
                  )}
                </div>
                <div className="mt-1 text-xs text-[#94a3b8]">
                  {n.time} | {TYPE_LABEL[n.type]}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
