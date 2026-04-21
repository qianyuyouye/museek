'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, textPageTitle } from '@/lib/ui-tokens'

// ── Types ──────────────────────────────────────────────────────

type NotificationType = 'work' | 'revenue' | 'system'

interface Notification {
  id: number
  type: NotificationType
  title: string
  content: string | null
  linkUrl: string | null
  createdAt: string
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
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'all' | NotificationType>('all')

  const typeParam = activeTab === 'all' ? '' : activeTab
  const { data, loading, refetch } = useApi<{ list: Notification[]; total: number; unreadCount: number; typeCounts?: Record<string, number> }>(
    `/api/creator/notifications?type=${typeParam}`,
    [activeTab],
  )

  const notifications = data?.list ?? []
  const unreadCount = data?.unreadCount ?? 0

  const apiTypeCounts = data?.typeCounts
  const tabCounts: Record<string, number> = apiTypeCounts ?? {
    all: notifications.length,
    work: notifications.filter((n) => n.type === 'work').length,
    revenue: notifications.filter((n) => n.type === 'revenue').length,
    system: notifications.filter((n) => n.type === 'system').length,
  }

  const filteredNotifications = notifications

  const markAsRead = async (id: number) => {
    await apiCall('/api/creator/notifications', 'PUT', { id })
    refetch()
  }

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
    <div className={pageWrap}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h1 className={textPageTitle}>消息中心</h1>
          {unreadCount > 0 && (
            <span className="text-xs text-[var(--red)] font-medium">
              {unreadCount}条未读
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--red)] ml-0.5 align-middle" />
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            className="text-xs text-[var(--accent)] hover:text-[var(--accent2)] cursor-pointer bg-transparent border-0 transition-colors"
            onClick={markAllAsRead}
          >
            全部标为已读
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-[var(--border)]">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`pb-2.5 text-sm border-0 bg-transparent cursor-pointer transition-colors relative ${
              activeTab === tab.key
                ? 'text-[var(--text)] font-semibold'
                : 'text-[var(--text3)] hover:text-[var(--text2)]'
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span className="ml-1 text-xs text-[var(--text3)]">{tabCounts[tab.key]}</span>
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent)] rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="bg-white rounded-xl border border-[var(--border)] shadow-[0_1px_4px_rgba(99,102,241,0.06)]">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-20 text-[var(--text3)]">
            <span className="text-4xl block mb-3">📭</span>
            <p className="text-sm">暂无消息</p>
          </div>
        ) : (
          filteredNotifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 px-5 py-4 border-b border-[var(--border)] last:border-b-0 cursor-pointer transition-colors hover:bg-[var(--bg4)] ${
                !n.read ? 'bg-[var(--accent-glow)]' : ''
              }`}
              onClick={() => {
                void markAsRead(n.id)
                if (n.linkUrl) router.push(n.linkUrl)
              }}
            >
              {/* Unread dot */}
              <div className="pt-1.5 w-3 shrink-0 flex justify-center">
                {!n.read && <span className="block w-2 h-2 rounded-full bg-[var(--accent)]" />}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm leading-relaxed ${
                    !n.read ? 'font-bold text-[var(--text)]' : 'text-[var(--text2)]'
                  }`}
                >
                  {n.title}
                  {!n.read && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--red)] ml-1 align-middle" />
                  )}
                </div>
                {n.content && (
                  <div className="text-xs text-[var(--text3)] mt-0.5 line-clamp-1">{n.content}</div>
                )}
                <div className="mt-1 text-xs text-[var(--text3)]">
                  {new Date(n.createdAt).toLocaleString('zh-CN', { hour12: false })} | {TYPE_LABEL[n.type]}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
