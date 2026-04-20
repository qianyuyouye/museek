'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/admin/page-header'
import { AdminTab } from '@/components/admin/admin-tab'
import { AdminModal } from '@/components/admin/admin-modal'
import { DataTable, Column } from '@/components/admin/data-table'
import { useApi, apiCall } from '@/lib/use-api'
import { useConfirm } from '@/components/admin/confirm-dialog'
import { pageWrap, cardCls, btnPrimary, btnGhost, inputCls, labelCls } from '@/lib/ui-tokens'

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

  const revenueRulesRaw = map.get('revenue_rules')
  const commissionRules = Array.isArray(revenueRulesRaw)
    ? (revenueRulesRaw as unknown[])
        .filter(
          (r): r is CommissionRule =>
            !!r &&
            typeof r === 'object' &&
            typeof (r as Record<string, unknown>).creatorRatio === 'number' &&
            typeof (r as Record<string, unknown>).conditionType === 'string',
        )
    : []

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
    // 前端 SettingsData 字段名 → 后端 PRESET_KEYS 字段名映射
    const KEY_MAP: Record<string, string> = {
      weights: 'scoring_weights',
      threshold: 'auto_archive_threshold',
      commissionRules: 'revenue_rules',
      templates: 'review_templates',
      platforms: 'platform_configs',
      aiTools: 'ai_tools',
      genres: 'genres',
    }
    const LABEL_TO_KEY: Record<string, string> = {
      '技术熟练度': 'technique',
      '创意立意': 'creativity',
      '商业传播潜力': 'commercial',
    }

    const settingsArray = Object.entries(data).map(([k, v]) => {
      let value: unknown = v
      // weights: [{label,value}] → {technique,creativity,commercial}
      if (k === 'weights' && Array.isArray(v)) {
        value = (v as { label: string; value: number }[]).reduce((acc, w) => {
          acc[LABEL_TO_KEY[w.label] ?? w.label] = w.value
          return acc
        }, {} as Record<string, number>)
      }
      // threshold: {minScore, recommendLevel} → number
      if (k === 'threshold' && v && typeof v === 'object' && 'minScore' in v) {
        value = (v as { minScore: number }).minScore
      }
      return { key: KEY_MAP[k] ?? k, value }
    })

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
        {tab === 'commission' && <CommissionTab showToast={showToast} onSave={handleSave} initialData={data} />}
        {tab === 'templates' && <TemplatesTab showToast={showToast} onSave={handleSave} initialData={data} />}
        {tab === 'platforms' && <PlatformsTab showToast={showToast} onSave={handleSave} initialData={data} />}
        {tab === 'options' && <OptionsTab showToast={showToast} onSave={handleSave} initialData={data} />}
      </div>
    </div>
  )
}

// ── ① 评分规则 ──────────────────────────────────────────────────

function ScoresTab({ showToast, onSave, initialData }: { showToast: (msg: string) => void; onSave: (s: Partial<SettingsData>) => void; initialData: SettingsData | null }) {
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
              const raw = Math.max(0, Math.min(100, Number(e.target.value)))
              const next = [...weights]
              // delta 均分给另两项：主动项 +X，其余两项各 -X/2；任一项触 0 后把剩余 delta 全给另一项
              const active = next[i].value
              const otherIdx = next.map((_, j) => j).filter((j) => j !== i)
              let delta = raw - active
              // 先尝试每项减一半
              let half = delta / 2
              let v0 = next[otherIdx[0]].value - half
              let v1 = next[otherIdx[1]].value - half
              // 防越界：有项小于 0 → 把溢出转嫁给另一项；两项都溢出 → 限制主动项
              if (v0 < 0) { v1 += v0; v0 = 0 }
              if (v1 < 0) { v0 += v1; v1 = 0 }
              if (v0 < 0 || v1 < 0) {
                // 另两项都已到 0，主动项不能再增加
                delta = (next[otherIdx[0]].value + next[otherIdx[1]].value)
                v0 = 0; v1 = 0
              }
              // 取整并修正总和误差
              v0 = Math.round(v0); v1 = Math.round(v1)
              const activeNew = 100 - v0 - v1
              next[i] = { ...next[i], value: Math.max(0, Math.min(100, activeNew)) }
              next[otherIdx[0]] = { ...next[otherIdx[0]], value: v0 }
              next[otherIdx[1]] = { ...next[otherIdx[1]], value: v1 }
              setWeights(next)
            }}
            className="score-weight-slider"
            style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
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
        <button
          className={btnPrimary}
          onClick={() => {
            const total = weights.reduce((sum, w) => sum + w.value, 0)
            if (total !== 100) {
              showToast(`三个维度权重合计为 ${total}%，必须正好等于 100% 才能保存`)
              return
            }
            onSave({ weights, threshold: { minScore: thresholdMinScore, recommendLevel: thresholdRecommendLevel } })
          }}
        >
          保存配置
        </button>
      </div>
    </div>
  )
}

// ── ② 分成比例规则 ──────────────────────────────────────────────

type CommissionConditionType = 'default' | 'min_song_score' | 'min_published_count'

interface CommissionRule {
  name: string
  creatorRatio: number
  platformRatio: number
  conditionType: CommissionConditionType
  conditionValue: number | null
  priority: number
  enabled: boolean
  [key: string]: unknown
}

const CONDITION_OPTIONS: { value: CommissionConditionType; label: string; needsValue: boolean; valueLabel: string }[] = [
  { value: 'default', label: '默认（兜底规则）', needsValue: false, valueLabel: '' },
  { value: 'min_song_score', label: '作品评分 ≥', needsValue: true, valueLabel: '最低分数（0-100）' },
  { value: 'min_published_count', label: '创作者累计已发行 ≥', needsValue: true, valueLabel: '最少作品数' },
]

const COMMISSION_FALLBACK: CommissionRule[] = [
  { name: '高分激励', creatorRatio: 0.8, platformRatio: 0.2, conditionType: 'min_song_score', conditionValue: 90, priority: 1, enabled: true },
  { name: '量产奖励', creatorRatio: 0.75, platformRatio: 0.25, conditionType: 'min_published_count', conditionValue: 10, priority: 2, enabled: true },
  { name: '默认规则', creatorRatio: 0.7, platformRatio: 0.3, conditionType: 'default', conditionValue: null, priority: 99, enabled: true },
]

function conditionLabel(rule: CommissionRule): string {
  const opt = CONDITION_OPTIONS.find((o) => o.value === rule.conditionType)
  if (!opt) return rule.conditionType
  if (!opt.needsValue) return opt.label
  return `${opt.label} ${rule.conditionValue ?? '-'}`
}

function ratioPercent(v: number): string {
  return `${Math.round(v * 1000) / 10}%`
}

function CommissionTab({
  showToast,
  onSave,
  initialData,
}: {
  showToast: (msg: string) => void
  onSave: (s: Partial<SettingsData>) => void
  initialData: SettingsData | null
}) {
  const confirm = useConfirm()
  const [rules, setRules] = useState<CommissionRule[]>(
    initialData?.commissionRules && initialData.commissionRules.length > 0
      ? initialData.commissionRules
      : COMMISSION_FALLBACK,
  )
  const [editing, setEditing] = useState<{ rule: CommissionRule; index: number } | null>(null)

  useEffect(() => {
    if (initialData) {
      setRules(
        initialData.commissionRules && initialData.commissionRules.length > 0
          ? initialData.commissionRules
          : COMMISSION_FALLBACK,
      )
    }
  }, [initialData])

  function openNew() {
    setEditing({
      rule: {
        name: '',
        creatorRatio: 0.7,
        platformRatio: 0.3,
        conditionType: 'default',
        conditionValue: null,
        priority: rules.length > 0 ? Math.max(...rules.map((r) => r.priority)) + 1 : 1,
        enabled: true,
      },
      index: -1,
    })
  }

  function openEdit(rule: CommissionRule, index: number) {
    setEditing({ rule: { ...rule }, index })
  }

  function persist(next: CommissionRule[]) {
    const sorted = [...next].sort((a, b) => a.priority - b.priority)
    setRules(sorted)
    onSave({ commissionRules: sorted })
  }

  function saveRule() {
    if (!editing) return
    const r = editing.rule
    if (!r.name.trim()) {
      showToast('规则名称不能为空')
      return
    }
    if (r.creatorRatio < 0 || r.creatorRatio > 1 || r.platformRatio < 0 || r.platformRatio > 1) {
      showToast('比例必须在 0-1 之间')
      return
    }
    if (Math.abs(r.creatorRatio + r.platformRatio - 1) > 0.001) {
      showToast('创作者比例 + 平台比例必须等于 100%')
      return
    }
    const opt = CONDITION_OPTIONS.find((o) => o.value === r.conditionType)
    if (opt?.needsValue && (r.conditionValue == null || !isFinite(r.conditionValue))) {
      showToast('此条件需要填写数值')
      return
    }

    const next = [...rules]
    if (editing.index >= 0) next[editing.index] = r
    else {
      if (next.some((x) => x.name === r.name)) {
        showToast('规则名已存在')
        return
      }
      next.push(r)
    }
    persist(next)
    setEditing(null)
  }

  async function removeRule(index: number) {
    const ok = await confirm({
      title: '删除规则',
      message: `确认删除「${rules[index]?.name ?? '该规则'}」？此操作不可撤销。`,
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    persist(rules.filter((_, i) => i !== index))
  }

  const columns: Column<CommissionRule>[] = [
    { key: 'priority', title: '优先级', render: (v) => <span className="font-mono">{v as number}</span> },
    { key: 'name', title: '规则名称', render: (v) => <span style={{ fontWeight: 500 }}>{v as string}</span> },
    { key: 'creatorRatio', title: '创作者', render: (v) => ratioPercent(v as number) },
    { key: 'platformRatio', title: '平台', render: (v) => ratioPercent(v as number) },
    { key: 'conditionType', title: '触发条件', render: (_v, row) => conditionLabel(row as unknown as CommissionRule) },
    {
      key: 'enabled',
      title: '状态',
      render: (v) =>
        v ? (
          <span style={{ color: 'var(--green2)' }}>启用</span>
        ) : (
          <span style={{ color: 'var(--text3)' }}>停用</span>
        ),
    },
    {
      key: 'name',
      title: '操作',
      render: (_v, row) => {
        const rule = row as unknown as CommissionRule
        const index = rules.findIndex((r) => r.name === rule.name)
        return (
          <div className="flex gap-2">
            <button
              className="text-xs text-[var(--accent)] bg-transparent border-0 cursor-pointer"
              onClick={() => openEdit(rule, index)}
            >
              编辑
            </button>
            <button
              className="text-xs text-[var(--red)] bg-transparent border-0 cursor-pointer"
              onClick={() => removeRule(index)}
            >
              删除
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <h3 className="text-[15px] font-semibold mb-4">分成比例规则</h3>
      <div className="text-xs text-[var(--text3)] mb-3">
        收益生成结算时按优先级从小到大扫描，命中第一条规则即选用其比例。必须保留至少一条 conditionType=default 的兜底规则。
      </div>
      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={rules as unknown as Record<string, unknown>[]}
        rowKey={(r) => (r as unknown as CommissionRule).name}
      />
      <div className="mt-4">
        <button className={btnPrimary} onClick={openNew}>
          + 添加规则
        </button>
      </div>

      <AdminModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && editing.index >= 0 ? '编辑规则' : '新增规则'}
        width={460}
      >
        {editing && (
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>规则名称</label>
              <input
                className={inputCls}
                value={editing.rule.name}
                onChange={(e) => setEditing({ ...editing, rule: { ...editing.rule, name: e.target.value } })}
                disabled={editing.index >= 0}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>创作者比例</label>
                <input
                  className={inputCls}
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={editing.rule.creatorRatio}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    const creator = isNaN(v) ? 0 : Math.min(1, Math.max(0, v))
                    setEditing({
                      ...editing,
                      rule: {
                        ...editing.rule,
                        creatorRatio: creator,
                        platformRatio: +(1 - creator).toFixed(2),
                      },
                    })
                  }}
                />
                <div className="text-xs text-[var(--text3)] mt-1">{ratioPercent(editing.rule.creatorRatio)}</div>
              </div>
              <div>
                <label className={labelCls}>平台比例（自动 = 1 − 创作者）</label>
                <input
                  className={`${inputCls} bg-[var(--bg4)] cursor-not-allowed`}
                  value={editing.rule.platformRatio.toFixed(2)}
                  disabled
                />
                <div className="text-xs text-[var(--text3)] mt-1">{ratioPercent(editing.rule.platformRatio)}</div>
              </div>
            </div>
            <div>
              <label className={labelCls}>触发条件</label>
              <select
                className={inputCls}
                value={editing.rule.conditionType}
                onChange={(e) => {
                  const ct = e.target.value as CommissionConditionType
                  const opt = CONDITION_OPTIONS.find((o) => o.value === ct)
                  setEditing({
                    ...editing,
                    rule: {
                      ...editing.rule,
                      conditionType: ct,
                      conditionValue: opt?.needsValue ? editing.rule.conditionValue ?? 0 : null,
                    },
                  })
                }}
              >
                {CONDITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {(() => {
              const opt = CONDITION_OPTIONS.find((o) => o.value === editing.rule.conditionType)
              if (!opt?.needsValue) return null
              return (
                <div>
                  <label className={labelCls}>{opt.valueLabel}</label>
                  <input
                    className={inputCls}
                    type="number"
                    value={editing.rule.conditionValue ?? ''}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value)
                      setEditing({
                        ...editing,
                        rule: { ...editing.rule, conditionValue: isNaN(v) ? null : v },
                      })
                    }}
                  />
                </div>
              )
            })()}
            <div>
              <label className={labelCls}>优先级（数字小 = 优先级高）</label>
              <input
                className={inputCls}
                type="number"
                value={editing.rule.priority}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10)
                  setEditing({
                    ...editing,
                    rule: { ...editing.rule, priority: isNaN(v) ? 99 : v },
                  })
                }}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.rule.enabled}
                onChange={(e) => setEditing({ ...editing, rule: { ...editing.rule, enabled: e.target.checked } })}
              />
              启用此规则
            </label>
            <div className="flex gap-2 justify-end mt-2">
              <button className={btnGhost} onClick={() => setEditing(null)}>取消</button>
              <button className={btnPrimary} onClick={saveRule}>保存</button>
            </div>
          </div>
        )}
      </AdminModal>
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

function PlatformsTab({
  showToast,
  onSave,
  initialData,
}: {
  showToast: (msg: string) => void
  onSave: (s: Partial<SettingsData>) => void
  initialData: SettingsData | null
}) {
  const confirm = useConfirm()
  const [platforms, setPlatforms] = useState<PlatformItem[]>(initialData?.platforms ?? PLATFORM_DATA)
  const [editing, setEditing] = useState<{ item: PlatformItem; index: number } | null>(null)

  useEffect(() => {
    if (initialData) setPlatforms(initialData.platforms ?? PLATFORM_DATA)
  }, [initialData])

  function persist(next: PlatformItem[]) {
    setPlatforms(next)
    onSave({ platforms: next })
  }

  function toggle(index: number, field: 'status' | 'mapping') {
    const next = platforms.map((p, i) => (i === index ? { ...p, [field]: !p[field] } : p))
    persist(next)
  }

  function openNew() {
    setEditing({ item: { name: '', region: '中国', status: true, mapping: false }, index: -1 })
  }

  function openEdit(p: PlatformItem, index: number) {
    setEditing({ item: { ...p }, index })
  }

  function saveEditing() {
    if (!editing) return
    const it = editing.item
    if (!it.name.trim()) {
      showToast('平台名称不能为空')
      return
    }
    const next = [...platforms]
    if (editing.index >= 0) next[editing.index] = it
    else {
      if (next.some((x) => x.name === it.name)) {
        showToast('平台名已存在')
        return
      }
      next.push(it)
    }
    persist(next)
    setEditing(null)
    showToast('已保存')
  }

  async function remove(index: number) {
    const ok = await confirm({
      title: '删除平台',
      message: `确认删除平台「${platforms[index]?.name ?? ''}」？`,
      confirmText: '删除',
      danger: true,
    })
    if (!ok) return
    persist(platforms.filter((_, i) => i !== index))
  }

  const columns: Column<PlatformItem>[] = [
    { key: 'name', title: '平台名称' },
    { key: 'region', title: '地区' },
    {
      key: 'status',
      title: '状态',
      render: (v, row) => {
        const index = platforms.findIndex((p) => p.name === (row as PlatformItem).name)
        return (
          <button
            className="bg-transparent border-0 cursor-pointer text-xs"
            style={{ color: v ? 'var(--green2)' : 'var(--text3)' }}
            onClick={() => toggle(index, 'status')}
          >
            {v ? '✓ 启用' : '○ 停用'}
          </button>
        )
      },
    },
    {
      key: 'mapping',
      title: '报表字段映射',
      render: (v, row) => {
        const index = platforms.findIndex((p) => p.name === (row as PlatformItem).name)
        return (
          <button
            className="bg-transparent border-0 cursor-pointer text-xs text-[var(--text2)]"
            onClick={() => toggle(index, 'mapping')}
          >
            {v ? '✅ 已配置' : '⚠️ 待配置'}
          </button>
        )
      },
    },
    {
      key: 'name',
      title: '操作',
      render: (_v, row) => {
        const index = platforms.findIndex((p) => p.name === (row as PlatformItem).name)
        return (
          <div className="flex gap-2">
            <button
              className="text-xs text-[var(--accent)] bg-transparent border-0 cursor-pointer"
              onClick={() => openEdit(row as PlatformItem, index)}
            >
              编辑
            </button>
            <button
              className="text-xs text-[var(--red)] bg-transparent border-0 cursor-pointer"
              onClick={() => remove(index)}
            >
              删除
            </button>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <h3 className="text-[15px] font-semibold mb-4">合作流媒体平台</h3>
      <DataTable
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        data={platforms as unknown as Record<string, unknown>[]}
        rowKey={(r) => (r as unknown as PlatformItem).name}
      />
      <div className="mt-4">
        <button className={btnPrimary} onClick={openNew}>+ 添加平台</button>
      </div>

      <AdminModal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing && editing.index >= 0 ? '编辑平台' : '新增平台'}
        width={440}
      >
        {editing && (
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls}>平台名称</label>
              <input
                className={inputCls}
                value={editing.item.name}
                disabled={editing.index >= 0}
                onChange={(e) => setEditing({ ...editing, item: { ...editing.item, name: e.target.value } })}
              />
            </div>
            <div>
              <label className={labelCls}>地区</label>
              <select
                className={inputCls}
                value={editing.item.region}
                onChange={(e) => setEditing({ ...editing, item: { ...editing.item, region: e.target.value } })}
              >
                <option value="中国">中国</option>
                <option value="全球">全球</option>
                <option value="北美">北美</option>
                <option value="欧洲">欧洲</option>
                <option value="日韩">日韩</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.item.status}
                onChange={(e) => setEditing({ ...editing, item: { ...editing.item, status: e.target.checked } })}
              />
              启用此平台
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.item.mapping}
                onChange={(e) => setEditing({ ...editing, item: { ...editing.item, mapping: e.target.checked } })}
              />
              已配置报表字段映射
            </label>
            <div className="flex gap-2 justify-end mt-2">
              <button className={btnGhost} onClick={() => setEditing(null)}>取消</button>
              <button className={btnPrimary} onClick={saveEditing}>保存</button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  )
}

// ── ⑤ 选项管理 ──────────────────────────────────────────────────

const AI_TOOLS = ['汽水创作实验室', 'Suno', 'Udio', 'TME Studio', 'AIVA', 'Boomy', 'Soundraw']
const GENRES = ['Pop', 'Rock', 'R&B', 'Hip-Hop', '电子', '古典', '民谣', '爵士', '蓝调', '金属']

function TagEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string
  items: string[]
  onChange: (next: string[]) => void
  placeholder: string
}) {
  const [input, setInput] = useState('')

  function add() {
    const v = input.trim()
    if (!v) return
    if (items.includes(v)) return
    onChange([...items, v])
    setInput('')
  }

  return (
    <div>
      <h3 className="text-[15px] font-semibold mb-4">{label}</h3>
      <div className="flex flex-wrap gap-2 mb-3">
        {items.map((t) => (
          <span
            key={t}
            className="px-3.5 py-1.5 rounded-full border border-[var(--border)] text-sm flex items-center gap-2"
          >
            {t}
            <button
              onClick={() => onChange(items.filter((x) => x !== t))}
              className="bg-transparent border-0 text-[var(--red)] cursor-pointer text-sm"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className={inputCls}
          style={{ flex: 1 }}
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
        />
        <button className={btnPrimary} onClick={add}>添加</button>
      </div>
    </div>
  )
}

function OptionsTab({
  showToast,
  onSave,
  initialData,
}: {
  showToast: (msg: string) => void
  onSave: (s: Partial<SettingsData>) => void
  initialData: SettingsData | null
}) {
  const [aiTools, setAiTools] = useState<string[]>(initialData?.aiTools ?? AI_TOOLS)
  const [genres, setGenres] = useState<string[]>(initialData?.genres ?? GENRES)

  useEffect(() => {
    if (initialData) {
      setAiTools(initialData.aiTools ?? AI_TOOLS)
      setGenres(initialData.genres ?? GENRES)
    }
  }, [initialData])

  return (
    <div className="flex flex-col gap-6">
      <TagEditor
        label="AI 工具选项"
        items={aiTools}
        placeholder="输入新 AI 工具名称..."
        onChange={(next) => {
          setAiTools(next)
          onSave({ aiTools: next })
          showToast('已更新 AI 工具列表')
        }}
      />
      <TagEditor
        label="流派选项"
        items={genres}
        placeholder="输入新流派..."
        onChange={(next) => {
          setGenres(next)
          onSave({ genres: next })
          showToast('已更新流派列表')
        }}
      />
    </div>
  )
}
