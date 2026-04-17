'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminTab } from '@/components/admin/admin-tab'
import { DataTable, Column } from '@/components/admin/data-table'
import { useApi, apiCall } from '@/lib/use-api'
import { pageWrap, cardCls, btnPrimary, inputCls, labelCls } from '@/lib/ui-tokens'

// ── Tab definitions ──────────────────────────────────────────────

const TABS = [
  { key: 'scores', label: '⚖️ 评分规则' },
  { key: 'commission', label: '💰 分成比例' },
  { key: 'templates', label: '💬 评语模板' },
  { key: 'platforms', label: '🌐 平台管理' },
  { key: 'options', label: '🎛 选项管理' },
]

// ── Settings types ──────────────────────────────────────────────

interface SettingsApiItem {
  key: string
  value: unknown
}

interface SettingsData {
  weights: { label: string; value: number }[]
  threshold: { minScore: number; recommendLevel: string }
  commissionRules: CommissionRule[]
  templates: string[]
  platforms: PlatformItem[]
  aiTools: string[]
  genres: string[]
}

function parseSettingsData(raw: SettingsApiItem[] | null): SettingsData | null {
  if (!raw) return null
  const map = new Map(raw.map((r) => [r.key, r.value]))

  const scoringWeights = map.get('scoring_weights') as Record<string, number> | undefined
  const DIMENSION_LABELS: Record<string, string> = {
    technique: '技术熟练度',
    creativity: '创意立意',
    commercial: '商业传播潜力',
  }
  const weights = scoringWeights
    ? Object.entries(scoringWeights).map(([k, v]) => ({ label: DIMENSION_LABELS[k] ?? k, value: v }))
    : [
        { label: '技术熟练度', value: 30 },
        { label: '创意立意', value: 40 },
        { label: '商业传播潜力', value: 30 },
      ]

  const autoThreshold = map.get('auto_archive_threshold') as number | undefined
  const threshold = { minScore: autoThreshold ?? 80, recommendLevel: '建议修改后发行' }

  const revenueRules = map.get('revenue_rules') as CommissionRule[] | undefined
  const commissionRules = revenueRules ?? []

  const templates = (map.get('review_templates') as string[]) ?? []
  const platformConfigs = map.get('platform_configs') as PlatformItem[] | undefined
  const platforms = platformConfigs ?? []
  const aiTools = (map.get('ai_tools') as string[]) ?? []
  const genres = (map.get('genres') as string[]) ?? []

  return { weights, threshold, commissionRules, templates, platforms, aiTools, genres }
}

// ── Main component ───────────────────────────────────────────────

export default function AdminSettingsPage() {
  const [tab, setTab] = useState('scores')
  const [toast, setToast] = useState('')

  const { data: rawData, loading, refetch } = useApi<SettingsApiItem[]>('/api/admin/settings')
  const data = parseSettingsData(rawData)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleSave(data: Partial<SettingsData>) {
    // 后端期望 { settings: [{ key, value }] } 数组格式
    const settingsArray = Object.entries(data).map(([key, value]) => ({ key, value }))
    const res = await apiCall('/api/admin/settings', 'PUT', { settings: settingsArray })
    if (res.ok) {
      showToast('设置已保存')
      refetch()
    } else {
      showToast(res.message ?? '保存失败')
    }
  }

  return (
    <div className={pageWrap}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-white border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader title="系统设置" subtitle={loading ? '加载中...' : '配置平台运营参数'} />

      <div>
        <AdminTab tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div className={cardCls}>
        {tab === 'scores' && <ScoresTab showToast={showToast} onSave={handleSave} initialData={data} />}
        {tab === 'commission' && <CommissionTab showToast={showToast} initialData={data} />}
        {tab === 'templates' && <TemplatesTab showToast={showToast} onSave={handleSave} initialData={data} />}
        {tab === 'platforms' && <PlatformsTab initialData={data} />}
        {tab === 'options' && <OptionsTab initialData={data} />}
      </div>
    </div>
  )
}

// ── ① 评分规则 ──────────────────────────────────────────────────

function ScoresTab({ onSave, initialData }: { showToast: (msg: string) => void; onSave: (s: Partial<SettingsData>) => void; initialData: SettingsData | null }) {
  const [weights, setWeights] = useState(
    initialData?.weights ?? [
      { label: '技术熟练度', value: 30 },
      { label: '创意立意', value: 40 },
      { label: '商业传播潜力', value: 30 },
    ]
  )
  const [thresholdMinScore, setThresholdMinScore] = useState(initialData?.threshold?.minScore ?? 80)
  const [thresholdRecommendLevel, setThresholdRecommendLevel] = useState(initialData?.threshold?.recommendLevel ?? '建议修改后发行')

  useEffect(() => {
    if (initialData) {
      setWeights(initialData.weights)
      setThresholdMinScore(initialData.threshold.minScore)
      setThresholdRecommendLevel(initialData.threshold.recommendLevel)
    }
  }, [initialData])

  return (
    <div>
      <h3 className="text-[15px] font-semibold mb-4">评分维度权重</h3>
      {weights.map((d, i) => (
        <div
          key={d.label}
          className="flex items-center gap-3 mb-3"
        >
          <span className="w-32 text-sm">{d.label}</span>
          <input
            type="range"
            min="0"
            max="100"
            value={d.value}
            onChange={(e) => {
              const next = [...weights]
              next[i] = { ...next[i], value: Number(e.target.value) }
              setWeights(next)
            }}
            style={{ flex: 1, accentColor: 'var(--accent)' }}
          />
          <span className="w-12 text-right font-semibold text-sm">
            {d.value}%
          </span>
        </div>
      ))}

      <div
        className="mt-5 p-4 rounded-lg"
        style={{ background: '#f0f4fb' }}
      >
        <h4 className="text-sm font-semibold mb-2.5">自动入库阈值</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>最低分数</label>
            <input className={inputCls} type="number" value={thresholdMinScore} onChange={(e) => setThresholdMinScore(Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>要求推荐等级</label>
            <select className={inputCls} value={thresholdRecommendLevel} onChange={(e) => setThresholdRecommendLevel(e.target.value)}>
              <option>强烈推荐发行</option>
              <option>建议修改后发行</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button className={btnPrimary} onClick={() => onSave({ weights, threshold: { minScore: thresholdMinScore, recommendLevel: thresholdRecommendLevel } })}>
          保存配置
        </button>
      </div>
    </div>
  )
}

// ── ② 分成比例规则 ──────────────────────────────────────────────

interface CommissionRule {
  name: string
  student: string
  platform: string
  condition: string
  active: boolean
  [key: string]: unknown
}

const COMMISSION_DATA: CommissionRule[] = [
  { name: '默认规则', student: '70%', platform: '30%', condition: '所有创作者', active: true },
  { name: '高分激励', student: '80%', platform: '20%', condition: '评分≥90', active: true },
  { name: '量产奖励', student: '75%', platform: '25%', condition: '累计发行≥10首', active: true },
]

function CommissionTab({ showToast, initialData }: { showToast: (msg: string) => void; initialData: SettingsData | null }) {
  const rules = initialData?.commissionRules ?? COMMISSION_DATA
  const columns: Column<CommissionRule>[] = [
    {
      key: 'name',
      title: '规则名称',
      render: (v) => <span style={{ fontWeight: 500 }}>{v as string}</span>,
    },
    { key: 'student', title: '创作者比例' },
    { key: 'platform', title: '平台比例' },
    { key: 'condition', title: '触发条件' },
    {
      key: 'active',
      title: '状态',
      render: (v) =>
        v ? (
          <span style={{ color: 'var(--green2)' }}>启用</span>
        ) : (
          <span style={{ color: 'var(--text3)' }}>停用</span>
        ),
    },
  ]

  return (
    <div>
      <h3 className="text-[15px] font-semibold mb-4">分成比例规则</h3>
      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={rules as unknown as Record<string, unknown>[]}
        rowKey={(r) => (r as unknown as CommissionRule).name}
      />
      <div className="mt-4">
        <button className={btnPrimary} onClick={() => showToast('已添加新规则')}>
          + 添加规则
        </button>
      </div>
    </div>
  )
}

// ── ③ 评语模板 ──────────────────────────────────────────────────

const DEFAULT_TEMPLATES = [
  '编曲结构完整',
  '旋律记忆点强',
  '人声融合度高',
  '歌词有深度',
  '建议优化混音',
  '建议调整BPM',
  'Prompt技巧有进步',
  '建议丰富流派元素',
]

function TemplatesTab({ showToast, onSave, initialData }: { showToast: (msg: string) => void; onSave: (s: Partial<SettingsData>) => void; initialData: SettingsData | null }) {
  const [templates, setTemplates] = useState(initialData?.templates ?? DEFAULT_TEMPLATES)
  const [newTemplate, setNewTemplate] = useState('')

  useEffect(() => {
    if (initialData) {
      setTemplates(initialData.templates)
    }
  }, [initialData])

  function handleDelete(t: string) {
    const next = templates.filter((x) => x !== t)
    setTemplates(next)
    onSave({ templates: next })
    showToast(`已删除模板「${t}」`)
  }

  function handleAdd() {
    const val = newTemplate.trim()
    if (!val) return
    const next = [...templates, val]
    setTemplates(next)
    setNewTemplate('')
    onSave({ templates: next })
    showToast('已添加')
  }

  return (
    <div>
      <h3 className="text-[15px] font-semibold mb-4">快捷评语模板</h3>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <div
            key={t}
            className="px-3.5 py-1.5 rounded-full border border-[var(--border)] text-sm flex items-center gap-2"
          >
            {t}
            <button
              onClick={() => handleDelete(t)}
              className="bg-transparent border-0 text-[var(--red)] cursor-pointer text-sm"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          className={inputCls}
          style={{ flex: 1 }}
          placeholder="输入新评语模板..."
          value={newTemplate}
          onChange={(e) => setNewTemplate(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
        />
        <button className={btnPrimary} onClick={handleAdd}>
          添加
        </button>
      </div>
    </div>
  )
}

// ── ④ 平台管理 ──────────────────────────────────────────────────

interface PlatformItem {
  name: string
  region: string
  status: boolean
  mapping: boolean
  [key: string]: unknown
}

const PLATFORM_DATA: PlatformItem[] = [
  { name: 'QQ音乐', region: '中国', status: true, mapping: true },
  { name: '网易云音乐', region: '中国', status: true, mapping: true },
  { name: '酷狗音乐', region: '中国', status: true, mapping: false },
  { name: 'Spotify', region: '全球', status: true, mapping: true },
  { name: 'Apple Music', region: '全球', status: true, mapping: false },
]

function PlatformsTab({ initialData }: { initialData: SettingsData | null }) {
  const platformData = initialData?.platforms ?? PLATFORM_DATA
  const columns: Column<PlatformItem>[] = [
    { key: 'name', title: '平台名称' },
    { key: 'region', title: '地区' },
    {
      key: 'status',
      title: '状态',
      render: (v) =>
        v ? (
          <span style={{ color: 'var(--green2)' }}>启用</span>
        ) : (
          <span style={{ color: 'var(--text3)' }}>停用</span>
        ),
    },
    {
      key: 'mapping',
      title: '报表字段映射',
      render: (v) => (v ? '✅ 已配置' : '⚠️ 待配置'),
    },
  ]

  return (
    <div>
      <h3 className="text-[15px] font-semibold mb-4">合作流媒体平台</h3>
      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={platformData as unknown as Record<string, unknown>[]}
        rowKey={(r) => (r as unknown as PlatformItem).name}
      />
    </div>
  )
}

// ── ⑤ 选项管理 ──────────────────────────────────────────────────

const AI_TOOLS = ['汽水创作实验室', 'Suno', 'Udio', 'TME Studio', 'AIVA', 'Boomy', 'Soundraw']
const GENRES = ['Pop', 'Rock', 'R&B', 'Hip-Hop', '电子', '古典', '民谣', '爵士', '蓝调', '金属']

function OptionsTab({ initialData }: { initialData: SettingsData | null }) {
  const aiToolsList = initialData?.aiTools ?? AI_TOOLS
  const genresList = initialData?.genres ?? GENRES
  const tagStyle = {
    padding: '4px 14px',
    borderRadius: 20,
    border: '1px solid var(--border)',
    fontSize: 13,
  }

  return (
    <div>
      <h3 className="text-[15px] font-semibold mb-4">AI工具选项</h3>
      <div className="flex flex-wrap gap-2 mb-5">
        {aiToolsList.map((t) => (
          <span key={t} style={tagStyle}>
            {t}
          </span>
        ))}
      </div>
      <h3 className="text-[15px] font-semibold mb-4">流派选项</h3>
      <div className="flex flex-wrap gap-2">
        {genresList.map((t) => (
          <span key={t} style={tagStyle}>
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}
