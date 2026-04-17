'use client'

import { useState } from 'react'
import { useApi } from '@/lib/use-api'

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

// ── Video Detail Content ────────────────────────────────────────

const VIDEO_DETAILS: Record<number, { sections: string[]; duration: string; level: string }> = {
  1: { sections: ['Suno 界面介绍与账号设置', 'Prompt 编写技巧与风格控制', '实战：从零生成一首完整歌曲', '常见问题排查与优化建议'], duration: '45分钟', level: '入门' },
  2: { sections: ['Udio 核心功能解析', '高级参数调节指南', '实战案例：电子音乐创作', '与其他工具对比分析'], duration: '38分钟', level: '进阶' },
  5: { sections: ['汽水音乐实验室概览', '创作流程详解', '实战：流行歌曲生成', '发行对接操作指南'], duration: '32分钟', level: '入门' },
  7: { sections: ['AI 节奏生成原理', '鼓点设计与编排技巧', '实战：不同节奏风格制作', '节奏与旋律融合方法'], duration: '28分钟', level: '进阶' },
  9: { sections: ['提示词结构拆解', '风格标签高级用法', '实战：复杂风格融合创作', '提示词优化与调试技巧'], duration: '52分钟', level: '高级' },
  11: { sections: ['AI 人声合成技术概览', '主流工具对比评测', '实战：人声克隆与调试', '伦理规范与版权注意事项'], duration: '35分钟', level: '进阶' },
}

const ARTICLE_DETAILS: Record<number, { sections: string[]; readTime: string }> = {
  4: { sections: ['混音的基本概念与目标', '均衡器（EQ）使用入门', '压缩与动态处理基础', '空间效果：混响与延迟'], readTime: '15分钟' },
  6: { sections: ['版权的法律定义与保护范围', '音乐版权的归属规则', '常见版权纠纷案例分析', '创作者如何维护自身权益'], readTime: '12分钟' },
  8: { sections: ['十二平均律与音名体系', '大调与小调音阶构成', '常用调式及其情感色彩', '调式在创作中的实际运用'], readTime: '18分钟' },
}

// ── Types ───────────────────────────────────────────────────────

interface CmsItem {
  id: number
  title: string
  type: 'video' | 'article'
  category: string
  cover: string
  status: string
  views: number
}

// ── Waveform SVG ────────────────────────────────────────────────

function WaveformSVG({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 560 64" className="w-full h-16" preserveAspectRatio="none">
      {Array.from({ length: 70 }).map((_, i) => {
        const h = Math.random() * 48 + 8
        return (
          <rect
            key={i}
            x={i * 8}
            y={(64 - h) / 2}
            width={5}
            rx={2.5}
            height={h}
            fill={playing ? '#6366f1' : '#c7d2fe'}
            opacity={playing ? 0.6 + Math.random() * 0.4 : 0.4}
          >
            {playing && (
              <animate
                attributeName="height"
                values={`${h};${Math.random() * 48 + 8};${h}`}
                dur={`${0.4 + Math.random() * 0.6}s`}
                repeatCount="indefinite"
              />
            )}
          </rect>
        )
      })}
    </svg>
  )
}

// ── Detail Modal ────────────────────────────────────────────────

function DetailModal({ item, onClose }: { item: CmsItem; onClose: () => void }) {
  const [playing, setPlaying] = useState(false)
  const isVideo = item.type === 'video'
  const videoDetail = VIDEO_DETAILS[item.id]
  const articleDetail = ARTICLE_DETAILS[item.id]
  const sections = isVideo ? (videoDetail?.sections ?? ['工具介绍', 'Prompt 技巧', '实战案例', '问题排查']) : (articleDetail?.sections ?? ['核心概念', '应用场景'])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[640px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cover */}
        <div
          className="relative h-[200px] rounded-t-2xl flex items-center justify-center"
          style={{ background: COVER_GRADIENTS[item.cover] || DEFAULT_GRADIENT }}
        >
          <span className="text-[80px] drop-shadow-lg">{item.cover}</span>
          <button
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center cursor-pointer hover:bg-white/30 transition border-0 text-lg"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="p-6">
          {/* Title */}
          <h2 className="text-xl font-bold text-[#1a1a2e] mb-3">{item.title}</h2>

          {/* Meta */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#ede9fe] text-[#6366f1]">
              {item.category}
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#fef3c7] text-[#d97706]">
              {isVideo ? '📹 视频课程' : '📖 图文科普'}
            </span>
            <span className="text-xs text-[#94a3b8]">
              👁 {item.views.toLocaleString()} 次浏览
            </span>
          </div>

          {/* Video Player Area */}
          {isVideo && (
            <div className="mb-5 bg-[#f8fafc] rounded-xl p-4 border border-[#e2e8f0]">
              <div className="flex items-center gap-3 mb-3">
                <button
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white flex items-center justify-center cursor-pointer border-0 shadow-md hover:shadow-lg transition text-lg"
                  onClick={() => setPlaying(!playing)}
                >
                  {playing ? '⏸' : '▶'}
                </button>
                <span className="text-sm text-[#64748b]">
                  {playing ? '正在播放...' : '点击播放'}
                </span>
              </div>
              <WaveformSVG playing={playing} />
            </div>
          )}

          {/* Content Sections */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-[#334155] mb-3">
              {isVideo ? '课程内容' : '文章大纲'}
            </h3>
            <div className="space-y-2">
              {sections.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#ede9fe] text-[#6366f1] text-xs flex items-center justify-center shrink-0 mt-0.5 font-medium">
                    {i + 1}
                  </span>
                  <span className="text-sm text-[#475569]">{s}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Duration / Level */}
          <div className="flex items-center gap-4 pt-4 border-t border-[#f1f5f9]">
            {isVideo && videoDetail && (
              <>
                <span className="text-xs text-[#94a3b8]">⏱ 时长：{videoDetail.duration}</span>
                <span className="text-xs text-[#94a3b8]">📊 难度：{videoDetail.level}</span>
              </>
            )}
            {!isVideo && articleDetail && (
              <span className="text-xs text-[#94a3b8]">⏱ 阅读时长：{articleDetail.readTime}</span>
            )}
            {isVideo && !videoDetail && (
              <>
                <span className="text-xs text-[#94a3b8]">⏱ 时长：30分钟</span>
                <span className="text-xs text-[#94a3b8]">📊 难度：入门</span>
              </>
            )}
            {!isVideo && !articleDetail && (
              <span className="text-xs text-[#94a3b8]">⏱ 阅读时长：10分钟</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Course Card ─────────────────────────────────────────────────

function CourseCard({ item, onClick }: { item: CmsItem; onClick: () => void }) {
  return (
    <div
      className="rounded-xl overflow-hidden bg-white border border-[#e8edf5] shadow-[0_2px_8px_rgba(0,0,0,0.06)] cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(99,102,241,0.12)] group"
      onClick={onClick}
    >
      {/* Cover */}
      <div
        className="relative h-[140px] flex items-center justify-center overflow-hidden"
        style={{ background: COVER_GRADIENTS[item.cover] || DEFAULT_GRADIENT }}
      >
        <span className="text-[56px] drop-shadow-md group-hover:scale-110 transition-transform duration-300">
          {item.cover}
        </span>
        {/* Category badge */}
        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-medium bg-black/30 backdrop-blur-sm text-white">
          {item.category}
        </span>
      </div>

      {/* Info */}
      <div className="p-3.5">
        <h3 className="text-[13px] font-semibold text-[#1a1a2e] leading-snug mb-2 line-clamp-2">
          {item.title}
        </h3>
        <div className="flex items-center justify-between text-[11px] text-[#94a3b8]">
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
  const { data, loading } = useApi<{ list: CmsItem[]; total: number }>(`/api/content?category=${encodeURIComponent(categoryParam)}`)

  const filteredItems = data?.list ?? []

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
        <div>
          <h1 className="text-xl font-bold text-[#1a1a2e]">课程中心</h1>
          <p className="text-xs text-[#94a3b8] mt-1">发现优质AI音乐课程与科普内容</p>
        </div>
        <span className="text-xs text-[#94a3b8]">
          共 {filteredItems.length} 个内容
        </span>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`px-4 py-[7px] rounded-full text-[13px] font-medium border-0 cursor-pointer transition-all ${
              activeCategory === cat
                ? 'bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white shadow-[0_2px_8px_rgba(99,102,241,0.3)]'
                : 'bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]'
            }`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-4 gap-5">
        {filteredItems.map((item) => (
          <CourseCard
            key={item.id}
            item={item}
            onClick={() => setSelectedItem(item)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className="text-center py-20 text-[#94a3b8]">
          <span className="text-4xl block mb-3">📭</span>
          <p className="text-sm">该分类暂无内容</p>
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
