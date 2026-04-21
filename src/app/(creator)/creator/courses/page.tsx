'use client'

import { useEffect, useRef, useState } from 'react'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, textPageTitle } from '@/lib/ui-tokens'

// ── Constants ───────────────────────────────────────────────────

const CATEGORIES = ['全部', 'AI工具教程', '基础乐理', '版权知识', '音乐流派']

const COVER_GRADIENTS: Record<string, string> = {
  '🎹': 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  '🎧': 'linear-gradient(135deg, #2d1b69 0%, #11998e 100%)',
  '🎼': 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  '📖': 'linear-gradient(135deg, #1f1c2c 0%, #928dab 100%)',
  '🥤': 'linear-gradient(135deg, #e44d26 0%, #f7931e 100%)',
  '📜': 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)',
  '🥁': 'linear-gradient(135deg, #141e30 0%, #243b55 100%)',
  '🎵': 'linear-gradient(135deg, #4a00e0 0%, #8e2de2 100%)',
  '💡': 'linear-gradient(135deg, #f12711 0%, #f5af19 100%)',
  '🎤': 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)',
  '🔖': 'linear-gradient(135deg, #373b44 0%, #4286f4 100%)',
  '🚀': 'linear-gradient(135deg, #8360c3 0%, #2ebf91 100%)',
}

const DEFAULT_GRADIENT = 'linear-gradient(135deg, #1a1a2e 0%, #3a3a5e 100%)'

// ── Types ───────────────────────────────────────────────────────

interface CmsItem {
  id: number
  title: string
  type: 'video' | 'article'
  category: string
  cover: string
  status: string
  views: number
  content: string | null
  videoUrl: string | null
  sections: string[] | null
  duration: string | null
  level: string | null
  author: string | null
  tags: string | null
  summary: string | null
}

// ── Detail Modal ────────────────────────────────────────────────

function DetailModal({ item, onClose }: { item: CmsItem; onClose: () => void }) {
  const isVideo = item.type === 'video'
  const sections = Array.isArray(item.sections) && item.sections.length > 0 ? item.sections : null

  const videoRef = useRef<HTMLVideoElement>(null)
  const articleRef = useRef<HTMLDivElement>(null)
  const openedAtRef = useRef(Date.now())
  const tickRef = useRef(Date.now())
  const maxProgressRef = useRef(0)

  useEffect(() => {
    openedAtRef.current = Date.now()
    tickRef.current = Date.now()
    maxProgressRef.current = 0
    let cancelled = false

    // 初次 upsert 建记录
    apiCall('/api/learning', 'POST', { contentId: item.id, progress: 1 }).catch(() => {})

    // 每 30s 上报时长增量 + 当前进度
    const interval = setInterval(() => {
      if (cancelled) return
      const now = Date.now()
      const delta = Math.floor((now - tickRef.current) / 1000)
      if (delta <= 0) return
      tickRef.current = now
      apiCall('/api/learning', 'POST', {
        contentId: item.id,
        durationDelta: delta,
        progress: maxProgressRef.current > 0 ? maxProgressRef.current : undefined,
      }).catch(() => {})
    }, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
      const now = Date.now()
      const delta = Math.floor((now - tickRef.current) / 1000)
      const totalStayed = Math.floor((now - openedAtRef.current) / 1000)
      const finalProgress = maxProgressRef.current
      // 视频：播到 >=90% 视为完成；图文：滚到 >=90% 视为完成；兜底：停留 >=30s 视为完成
      const completed = finalProgress >= 90 || (totalStayed >= 30 && finalProgress === 0)
      apiCall('/api/learning', 'POST', {
        contentId: item.id,
        durationDelta: delta > 0 ? delta : 0,
        progress: completed ? 100 : finalProgress || undefined,
        completed,
      }).catch(() => {})
    }
  }, [item.id])

  // Video: 每 5s 取一次 currentTime/duration
  useEffect(() => {
    if (!isVideo) return
    const v = videoRef.current
    if (!v) return
    function onTime() {
      if (!v || !v.duration || !isFinite(v.duration)) return
      const pct = Math.min(100, Math.round((v.currentTime / v.duration) * 100))
      if (pct > maxProgressRef.current) maxProgressRef.current = pct
    }
    v.addEventListener('timeupdate', onTime)
    return () => v.removeEventListener('timeupdate', onTime)
  }, [isVideo])

  // Article: 滚动百分比
  useEffect(() => {
    if (isVideo) return
    const el = articleRef.current
    if (!el) return
    function onScroll() {
      if (!el) return
      const scrollTop = el.scrollTop
      const scrollHeight = el.scrollHeight - el.clientHeight
      if (scrollHeight <= 0) {
        maxProgressRef.current = 100
        return
      }
      const pct = Math.min(100, Math.round((scrollTop / scrollHeight) * 100))
      if (pct > maxProgressRef.current) maxProgressRef.current = pct
    }
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  }, [isVideo])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-[720px] max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover */}
        <div
          className="relative h-[180px] rounded-t-xl flex items-center justify-center shrink-0"
          style={{ background: COVER_GRADIENTS[item.cover] || DEFAULT_GRADIENT }}
        >
          <span className="text-[72px] drop-shadow-lg">{item.cover}</span>
          <button
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center cursor-pointer hover:bg-white/30 transition border-0 text-lg"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div ref={articleRef} className="p-6 overflow-y-auto flex-1">
          <h2 className="text-xl font-bold text-[var(--text)] mb-3">{item.title}</h2>

          {/* Meta */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#ede9fe] text-[var(--accent)]">
              {item.category}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#fef3c7] text-[var(--orange)]">
              {isVideo ? '📹 视频课程' : '📖 图文科普'}
            </span>
            {item.level && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#e0f7fa] text-[var(--green)]">
                📊 {item.level}
              </span>
            )}
            {item.author && (
              <span className="text-xs text-[var(--text3)]">👤 {item.author}</span>
            )}
            <span className="text-xs text-[var(--text3)]">
              👁 {item.views.toLocaleString()} 次浏览
            </span>
          </div>

          {/* Summary */}
          {item.summary && (
            <p className="text-sm text-[var(--text2)] mb-4 leading-relaxed bg-[#fafbff] px-4 py-3 rounded-lg border border-[var(--border)]">
              {item.summary}
            </p>
          )}

          {/* Video Player */}
          {isVideo && item.videoUrl && (
            <div className="mb-5 bg-black rounded-xl overflow-hidden">
              <video
                ref={videoRef}
                src={item.videoUrl}
                controls
                className="w-full h-auto max-h-[380px]"
              >
                您的浏览器不支持 video 标签
              </video>
            </div>
          )}
          {isVideo && !item.videoUrl && (
            <div className="mb-5 p-6 bg-[#fef9ec] rounded-xl border border-[var(--orange)] text-sm text-[var(--text2)] text-center">
              ⚠️ 本课程暂无视频资源
            </div>
          )}

          {/* Sections outline */}
          {sections && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-[var(--text2)] mb-3">
                {isVideo ? '课程内容' : '文章大纲'}
              </h3>
              <div className="space-y-2">
                {sections.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#ede9fe] text-[var(--accent)] text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">
                      {i + 1}
                    </span>
                    <span className="text-sm text-[var(--text2)]">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Article body */}
          {item.content && (
            <div
              className="prose prose-sm max-w-none text-[var(--text)] mb-5"
              dangerouslySetInnerHTML={{ __html: item.content }}
            />
          )}

          {/* Tags */}
          {item.tags && (
            <div className="flex flex-wrap gap-2 mb-4">
              {item.tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
                .map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded text-[11px] bg-[var(--bg4)] text-[var(--text3)] border border-[var(--border)]"
                  >
                    #{t}
                  </span>
                ))}
            </div>
          )}

          {/* Footer meta */}
          {(item.duration || item.level) && (
            <div className="flex items-center gap-4 pt-4 border-t border-[var(--border)]">
              {item.duration && (
                <span className="text-xs text-[var(--text3)]">
                  ⏱ {isVideo ? '时长' : '阅读时长'}：{item.duration}
                </span>
              )}
              {item.level && isVideo && (
                <span className="text-xs text-[var(--text3)]">📊 难度：{item.level}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Course Card ─────────────────────────────────────────────────

function CourseCard({ item, onClick }: { item: CmsItem; onClick: () => void }) {
  return (
    <div
      className="rounded-xl overflow-hidden bg-white border border-[var(--border)] shadow-[0_2px_8px_rgba(0,0,0,0.06)] cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(99,102,241,0.12)] group"
      onClick={onClick}
    >
      <div
        className="relative h-[140px] flex items-center justify-center overflow-hidden"
        style={{ background: COVER_GRADIENTS[item.cover] || DEFAULT_GRADIENT }}
      >
        <span className="text-[56px] drop-shadow-md group-hover:scale-110 transition-transform duration-300">
          {item.cover}
        </span>
        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-medium bg-black/30 backdrop-blur-sm text-white">
          {item.category}
        </span>
        {item.level && (
          <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-medium bg-white/20 backdrop-blur-sm text-white">
            {item.level}
          </span>
        )}
      </div>
      <div className="p-3.5">
        <h3 className="text-[13px] font-semibold text-[var(--text)] leading-snug mb-2 line-clamp-2">
          {item.title}
        </h3>
        {item.summary && (
          <p className="text-[11.5px] text-[var(--text3)] line-clamp-2 mb-2 leading-relaxed">
            {item.summary}
          </p>
        )}
        <div className="flex items-center justify-between text-[11px] text-[var(--text3)]">
          <span>{item.type === 'video' ? '📹 视频课程' : '📖 图文科普'}</span>
          <span>👁 {item.views.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────

export default function CreatorCoursesPage() {
  const [activeCategory, setActiveCategory] = useState('全部')
  const [selectedItem, setSelectedItem] = useState<CmsItem | null>(null)

  const categoryParam = activeCategory === '全部' ? '' : activeCategory
  const { data, loading } = useApi<{ list: CmsItem[]; total: number }>(
    `/api/content?category=${encodeURIComponent(categoryParam)}`
  )

  const filteredItems = data?.list ?? []

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-[var(--text3)]">加载中...</div>
      </div>
    )
  }

  return (
    <div className={pageWrap}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className={textPageTitle}>课程中心</h1>
          <p className="text-xs text-[var(--text3)] mt-1">发现优质AI音乐课程与科普内容</p>
        </div>
        <span className="text-xs text-[var(--text3)]">共 {filteredItems.length} 个内容</span>
      </div>

      <div className="flex items-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`px-4 py-[7px] rounded-full text-[13px] font-medium border-0 cursor-pointer transition-all ${
              activeCategory === cat
                ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white shadow-[0_2px_8px_rgba(99,102,241,0.3)]'
                : 'bg-[var(--bg4)] text-[var(--text2)] hover:bg-[var(--border)]'
            }`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-5">
        {filteredItems.map((item) => (
          <CourseCard key={item.id} item={item} onClick={() => setSelectedItem(item)} />
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-20 text-[var(--text3)]">
          <span className="text-4xl block mb-3">📭</span>
          <p className="text-sm">该分类暂无内容</p>
        </div>
      )}

      {selectedItem && <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  )
}
