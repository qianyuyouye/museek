'use client'

import { useState, useRef } from 'react'
import { FileAudio, Link, Wallet, Download, AlertTriangle, CheckCircle2, HelpCircle, Music, Smartphone, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'

function getCurrentQuarter(): string {
  const now = new Date()
  const q = Math.floor(now.getMonth() / 3) + 1
  return `${now.getFullYear()}-Q${q}`
}
import { DataTable, Column } from '@/components/ui/data-table'
import { AdminTab } from '@/components/ui/unified-tabs'
import { AdminModal } from '@/components/ui/modal'
import { useApi, apiCall } from '@/lib/use-api'
import { downloadCSV, today } from '@/lib/export'
import { pageWrap, cardCls, btnPrimary, btnGhost, btnDanger, btnSuccess, btnSmall, inputCls, labelCls } from '@/lib/ui-tokens'
import { STAT_COLORS } from '@/lib/constants'
import { formatDateTime } from '@/lib/format'

// ── Types ───────────────────────────────────────────────────────

interface RevenueImport {
  id: number
  fileName: string
  period: string
  totalRows: number
  idHit: number
  nameMatch: number
  unmatched: number
  duplicates: number
  totalRevenue: number
}

interface Mapping {
  id: number
  qishuiId: string
  songName: string
  creatorName: string | null
  source: 'auto' | 'manual'
  status: 'confirmed' | 'pending' | 'unbound'
  confirmedAt: string | null
}

interface Settlement {
  id: number
  songTitle: string
  platform: string
  plays?: number
  rawRevenue: number
  creatorRatio: number
  creatorAmount: number
  status: 'pending' | 'confirmed' | 'exported' | 'paid'
}

interface QishuiDetail {
  id: number
  songName: string
  month: string
  douyinRevenue: number
  qishuiRevenue: number
  matchStatus: string
}

interface CreatorOption {
  id: number
  name: string
  phone: string
}

interface RevenueStats {
  grandTotal: number
  grandDouyin: number
  grandQishui: number
  userStats: { name: string; songCount: number; douyin: number; qishui: number; total: number }[]
  songStats: { name: string; user: string; periodCount: number; douyin: number; qishui: number; total: number }[]
  periodStats: { period: string; songs: number; userCount: number; douyin: number; qishui: number; total: number }[]
}

interface OtherImport {
  id: number
  platform: string
  fileName: string
  totalRows: number
  matchedRows: number
  totalRevenue: number
  status: string
}

// ── Status maps ─────────────────────────────────────────────────

const SETTLE_STATUS: Record<string, { l: string; c: string }> = {
  pending: { l: '待确认', c: 'var(--orange)' },
  confirmed: { l: '已确认', c: 'var(--accent)' },
  exported: { l: '已导出', c: 'var(--text2)' },
  paid: { l: '已打款', c: 'var(--green2)' },
}

const MAP_STATUS: Record<string, { l: string; c: string }> = {
  confirmed: { l: '已确认', c: 'var(--green2)' },
  pending: { l: '待确认', c: 'var(--orange)' },
  unbound: { l: '未绑定', c: 'var(--text3)' },
}

// ── Main component ──────────────────────────────────────────────

export default function AdminRevenuePage() {
  const [tab, setTab] = useState('qishui')
  const [statsTab, setStatsTab] = useState('user')
  const [mappingFilter, setMappingFilter] = useState('all')
  const [matchDetail, setMatchDetail] = useState<RevenueImport | null>(null)
  const [linkModal, setLinkModal] = useState<Mapping | null>(null)
  const [toast, setToast] = useState('')

  // API hooks
  const { data: importsData, refetch: refetchImports } = useApi<{ list: RevenueImport[]; total: number }>('/api/admin/revenue/imports')
  const { data: mappingsData, refetch: refetchMappings } = useApi<{ list: Mapping[]; total: number }>(`/api/admin/revenue/mappings?status=${mappingFilter}`, [mappingFilter])
  const { data: statsData } = useApi<{
    totalRevenue: number
    douyinRevenue: number
    qishuiRevenue: number
    creatorCount: number
    byCreator: { creatorId: number; creatorName: string | null; totalRevenue: number; douyinRevenue: number; qishuiRevenue: number }[]
    bySong: { songName: string | null; qishuiSongId: string; totalRevenue: number; douyinRevenue: number; qishuiRevenue: number }[]
    byMonth: { period: string; totalRevenue: number; douyinRevenue: number; qishuiRevenue: number }[]
  }>('/api/admin/revenue/stats')
  const { data: settleData, refetch: refetchSettlements } = useApi<{ list: Settlement[]; total: number }>('/api/admin/revenue/settlements?status=')

  const imports = importsData?.list ?? []
  const mappings = mappingsData?.list ?? []
  const settlements = settleData?.list ?? []

  const grandTotal = statsData?.totalRevenue ?? 0
  const grandDouyin = statsData?.douyinRevenue ?? 0
  const grandQishui = statsData?.qishuiRevenue ?? 0
  const userStats = (statsData?.byCreator ?? []).map((c) => ({
    name: c.creatorName ?? `用户${c.creatorId}`,
    songCount: 0,
    douyin: c.douyinRevenue,
    qishui: c.qishuiRevenue,
    total: c.totalRevenue,
  }))
  const songStats = (statsData?.bySong ?? []).map((s) => ({
    name: s.songName ?? s.qishuiSongId,
    user: '-',
    periodCount: 0,
    douyin: s.douyinRevenue,
    qishui: s.qishuiRevenue,
    total: s.totalRevenue,
  }))
  const periodStats = (statsData?.byMonth ?? []).map((m) => ({
    period: m.period,
    songs: 0,
    userCount: 0,
    douyin: m.douyinRevenue,
    qishui: m.qishuiRevenue,
    total: m.totalRevenue,
  }))

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const pendingCount = mappings.filter(m => m.status === 'pending').length

  const tabItems = [
    { key: 'qishui', label: '汽水导入' },
    { key: 'mapping', label: `匹配关系${pendingCount > 0 ? ` (${pendingCount})` : ''}` },
    { key: 'stats', label: '多维统计' },
    { key: 'settle', label: '结算管理' },
    { key: 'imports', label: '其他平台' },
    { key: 'platform_settle', label: '平台分发结算' },
  ]

  return (
    <div className={pageWrap}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-[9999] px-6 py-3 rounded-xl bg-[var(--bg3)] border border-[var(--green)] text-[var(--green)] text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <PageHeader title="收益管理" subtitle="汽水音乐导入 · 歌曲ID映射 · 多维统计" />

      <div>
        <AdminTab tabs={tabItems} active={tab} onChange={setTab} />
      </div>

      {/* ═══ 汽水音乐导入 ═══ */}
      {tab === 'qishui' && <QishuiTab showToast={showToast} grandTotal={grandTotal} imports={imports} mappings={mappings} onDetail={setMatchDetail} refetchImports={refetchImports} refetchMappings={refetchMappings} />}

      {/* ═══ 匹配关系维护 ═══ */}
      {tab === 'mapping' && (
        <MappingTab
          showToast={showToast}
          mappings={mappings}
          allMappingsCount={mappings.length}
          mappingFilter={mappingFilter}
          setMappingFilter={setMappingFilter}
          onLink={setLinkModal}
          refetch={refetchMappings}
        />
      )}

      {/* ═══ 多维统计 ═══ */}
      {tab === 'stats' && (
        <StatsTab
          statsTab={statsTab}
          setStatsTab={setStatsTab}
          grandTotal={grandTotal}
          grandDouyin={grandDouyin}
          grandQishui={grandQishui}
          userStats={userStats}
          songStats={songStats}
          periodStats={periodStats}
        />
      )}

      {/* ═══ 结算管理 ═══ */}
      {tab === 'settle' && <SettleTab showToast={showToast} settlements={settlements} refetch={refetchSettlements} />}

      {/* ═══ 其他平台 ═══ */}
      {tab === 'imports' && <OtherPlatformTab showToast={showToast} />}

      {/* ═══ 平台分发结算 ═══ */}
      {tab === 'platform_settle' && <PlatformSettleTab showToast={showToast} />}

      {/* ★ 匹配详情 Modal */}
      <AdminModal
        open={!!matchDetail}
        onClose={() => setMatchDetail(null)}
        title={`导入详情 · ${matchDetail?.fileName || ''}`}
        width={780}
      >
        {matchDetail && <ImportDetailContent row={matchDetail} showToast={showToast} refetch={refetchImports} />}
      </AdminModal>

      {/* ★ 人工绑定创作者 Modal */}
      <AdminModal
        open={!!linkModal}
        onClose={() => setLinkModal(null)}
        title={`绑定创作者 · ${linkModal?.songName || ''}`}
      >
        {linkModal && (
          <LinkCreatorForm
            mapping={linkModal}
            onSubmit={async (creatorId) => {
              const res = await apiCall(`/api/admin/revenue/mappings/${linkModal.id}`, 'PUT', { action: 'bind', creatorId })
              if (res.ok) {
                setLinkModal(null)
                const created = (res.data as { backfill?: { created: number } } | null)?.backfill?.created ?? 0
                showToast(
                  created > 0
                    ? `已绑定「${linkModal.songName}」，回溯生成 ${created} 条结算`
                    : `已绑定「${linkModal.songName}」的创作者`,
                )
                refetchMappings()
              } else {
                showToast(res.message ?? '绑定失败')
              }
            }}
          />
        )}
      </AdminModal>
    </div>
  )
}

// ── Tab: 汽水导入 ───────────────────────────────────────────────

function QishuiTab({
  showToast,
  grandTotal,
  imports,
  mappings,
  onDetail,
  refetchImports,
  refetchMappings,
}: {
  showToast: (msg: string) => void
  grandTotal: number
  imports: RevenueImport[]
  mappings: Mapping[]
  onDetail: (r: RevenueImport) => void
  refetchImports: () => void
  refetchMappings: () => void
}) {
  const importColumns: Column<RevenueImport>[] = [
    { key: 'fileName', title: '文件名', render: v => <span style={{ fontSize: 12 }}>{v as string}</span> },
    { key: 'period', title: '数据区间' },
    { key: 'totalRows', title: '总行数' },
    { key: 'idHit', title: 'ID命中', render: v => <span style={{ color: 'var(--green2)', fontWeight: 600 }}>{v as number}</span> },
    { key: 'nameMatch', title: '歌名待确认', render: v => (v as number) > 0 ? <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{v as number}</span> : <span>0</span> },
    { key: 'unmatched', title: '未匹配', render: v => <span style={{ color: 'var(--text3)' }}>{v as number}</span> },
    { key: 'duplicates', title: '重复跳过', render: v => (v as number) > 0 ? <span style={{ color: 'var(--red)' }}>{v as number}</span> : <span>0</span> },
    { key: 'totalRevenue', title: '总收益', render: v => `¥${(v as number).toFixed(2)}` },
    {
      key: 'id', title: '操作', render: (_v, row) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={`${btnGhost} ${btnSmall}`}
            onClick={(e) => { e.stopPropagation(); onDetail(row as unknown as RevenueImport) }}
          >
            详情
          </button>
          <button
            className={`${btnDanger} ${btnSmall}`}
            onClick={async (e) => {
              e.stopPropagation()
              const r = row as unknown as RevenueImport
              if (confirm(`确认回滚导入「${r.fileName}」？已导出或已打款的结算将阻止回滚。`)) {
                const res = await fetch(`/api/admin/revenue/imports/${r.id}`, { method: 'DELETE' })
                const json = await res.json()
                if (json.code === 200) {
                  showToast(`已回滚导入「${r.fileName}」`)
                  refetchImports()
                  refetchMappings()
                } else {
                  showToast(json.message ?? '回滚失败')
                }
              }
            }}
          >
            回滚
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <QishuiUploader onDone={(msg) => { showToast(msg); refetchImports(); refetchMappings() }} />

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard icon={<Download className="w-5 h-5" />} label="导入批次" val={imports.length} color={STAT_COLORS.purple} iconBg="rgba(99,102,241,0.1)" />
        <StatCard icon={<Link className="w-5 h-5" />} label="映射表记录" val={mappings.length} color={STAT_COLORS.green} iconBg="rgba(22,163,74,0.1)" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="已确认" val={mappings.filter(m => m.status === 'confirmed').length} color={STAT_COLORS.teal} iconBg="rgba(13,148,136,0.1)" />
        <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="待确认" val={mappings.filter(m => m.status === 'pending').length} color={STAT_COLORS.amber} iconBg="rgba(245,158,11,0.1)" />
        <StatCard icon={<Wallet className="w-5 h-5" />} label="已确认收益" val={`¥${grandTotal.toFixed(2)}`} color={STAT_COLORS.pink} iconBg="rgba(236,72,153,0.1)" />
      </div>

      {/* Import history */}
      <div className={cardCls}>
        <h3 className="text-base font-semibold mb-4">导入历史</h3>
        <DataTable
          columns={importColumns}
          data={imports}
          rowKey={r => r.id}
        />
      </div>
    </div>
  )
}

function QishuiUploader({ onDone }: { onDone: (msg: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('platform', 'qishui')
    try {
      const res = await fetch('/api/admin/revenue/imports', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.code === 200) {
        const d = json.data
        onDone(`导入完成：${d.totalRows} 行 · 匹配 ${d.matchedRows} · 待确认 ${d.suspectRows} · 未匹配 ${d.unmatchedRows}${d.duplicateRows ? ` · 重复 ${d.duplicateRows}` : ''}`)
      } else {
        onDone(json.message || '上传失败')
      }
    } catch {
      onDone('网络错误，上传失败')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={cardCls}>
      <h3 className="text-base font-semibold mb-1">导入汽水音乐收益报表</h3>
      <p className="text-xs text-[var(--text3)] mb-4">
        每月从汽水后台导出CSV → 系统按歌曲ID查映射表精确匹配 → 新歌曲按歌名匹配歌曲库待人工确认 → 确认后自动记入映射表
      </p>
      <label
        htmlFor="qishui-csv-input"
        style={{
          border: '2px dashed var(--border)',
          borderRadius: 10,
          padding: '16px 20px',
          cursor: uploading ? 'wait' : 'pointer',
          transition: 'all .2s',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          opacity: uploading ? 0.6 : 1,
          pointerEvents: uploading ? 'none' : 'auto',
        }}
        onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        <input
          ref={inputRef}
          id="qishui-csv-input"
          type="file"
          accept=".csv"
          disabled={uploading}
          style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        <span style={{ fontSize: 28 }}><FileAudio className="w-7 h-7 text-[var(--text3)]" /></span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>
            {uploading ? '解析中...' : '点击上传汽水音乐 CSV'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            列顺序：类型 · 起止日期 · 歌曲名称 · 歌曲ID · 抖音收入 · 汽水收入 · 总收入
          </div>
        </div>
      </label>
    </div>
  )
}

// ── Tab: 匹配关系维护 ──────────────────────────────────────────

function MappingTab({
  showToast,
  mappings,
  allMappingsCount,
  mappingFilter,
  setMappingFilter,
  onLink,
  refetch,
}: {
  showToast: (msg: string) => void
  mappings: Mapping[]
  allMappingsCount: number
  mappingFilter: string
  setMappingFilter: (v: string) => void
  onLink: (m: Mapping) => void
  refetch: () => void
}) {
  const filteredData = mappingFilter === 'all'
    ? mappings
    : mappings.filter(m => m.status === mappingFilter)

  const mappingColumns: Column<Mapping>[] = [
    { key: 'qishuiId', title: '歌曲ID', render: v => <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)', userSelect: 'all' as const }}>{v as string}</span> },
    { key: 'songName', title: '歌曲名称', render: v => <span style={{ fontWeight: 500 }}>{v as string}</span> },
    {
      key: 'creatorName', title: '绑定创作者', render: v =>
        v ? <span style={{ color: 'var(--green2)', fontWeight: 500 }}>{v as string}</span> : <span style={{ color: 'var(--text3)' }}>未绑定</span>,
    },
    {
      key: 'source', title: '匹配来源', render: v =>
        v === 'auto' ? <span style={{ fontSize: 11, color: 'var(--accent2)' }}>自动</span> : <span style={{ fontSize: 11, color: 'var(--orange)' }}>人工</span>,
    },
    {
      key: 'status', title: '状态', render: v => {
        const s = MAP_STATUS[v as string]
        return <span style={{ fontSize: 12, color: s?.c }}>{s?.l}</span>
      },
    },
    { key: 'confirmedAt', title: '确认时间', render: v => v ? formatDateTime(v as string) : '—' },
    {
      key: 'id', title: '操作', render: (_v, row) => {
        const r = row as unknown as Mapping
        return (
          <div style={{ display: 'flex', gap: 4 }}>
            {r.status === 'pending' && (
              <button className={`${btnSuccess} ${btnSmall}`} onClick={async e => {
                e.stopPropagation()
                const res = await apiCall(`/api/admin/revenue/mappings/${r.id}`, 'PUT', { action: 'confirm' })
                if (res.ok) {
                  const created = (res.data as { backfill?: { created: number } } | null)?.backfill?.created ?? 0
                  showToast(
                    created > 0
                      ? `已确认「${r.songName}」，回溯生成 ${created} 条结算`
                      : `已确认「${r.songName}」的映射关系`,
                  )
                  refetch()
                } else showToast(res.message ?? '确认失败')
              }}>
                确认
              </button>
            )}
            {r.status === 'pending' && (
              <button className={`${btnDanger} ${btnSmall}`} onClick={async e => {
                e.stopPropagation()
                const res = await apiCall(`/api/admin/revenue/mappings/${r.id}`, 'PUT', { action: 'reject' })
                if (res.ok) { showToast('已驳回，请重新绑定'); refetch() }
                else showToast(res.message ?? '驳回失败')
              }}>
                驳回
              </button>
            )}
            {(r.status === 'unbound' || r.status === 'pending') && (
              <button className={`${btnGhost} ${btnSmall}`} onClick={e => { e.stopPropagation(); onLink(r) }}>
                绑定创作者
              </button>
            )}
            {r.status === 'confirmed' && (
              <>
                <button className={`${btnGhost} ${btnSmall}`} onClick={e => { e.stopPropagation(); onLink(r) }}>
                  修改绑定
                </button>
                <button className={`${btnDanger} ${btnSmall}`} onClick={async e => {
                  e.stopPropagation()
                  if (confirm(`确认解除「${r.songName}」的映射绑定？将清除 creatorId 并删除待结算记录。`)) {
                    const res = await fetch(`/api/admin/revenue/mappings/${r.id}`, { method: 'DELETE' })
                    const json = await res.json()
                    if (json.code === 200) {
                      showToast('已解除映射')
                      refetch()
                    } else {
                      showToast(json.message ?? '解除失败')
                    }
                  }
                }}>
                  解除
                </button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  const filters = [
    { k: 'all', l: '全部' },
    { k: 'confirmed', l: '已确认' },
    { k: 'pending', l: '待确认' },
    { k: 'unbound', l: '未绑定' },
  ]

  return (
    <div>
      {/* Info banner */}
      <div className={cardCls} style={{ background: 'linear-gradient(135deg,rgba(108,92,231,.06),rgba(0,206,201,.04))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 32 }}><Link className="w-8 h-8 text-[var(--accent)]" /></span>
          <div>
            <h3 className="text-base font-semibold mb-1">歌曲ID映射关系表</h3>
            <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
              每首歌曲在汽水音乐有唯一的歌曲ID。首次导入时系统用歌曲名称自动匹配创作者，匹配结果需人工确认后写入本表。
              <br />后续导入同一歌曲ID自动命中映射表，<strong style={{ color: 'var(--green2)' }}>无需再次确认</strong>。
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="已确认映射" val={mappings.filter(m => m.status === 'confirmed').length} sub="导入时自动命中" color={STAT_COLORS.teal} iconBg="rgba(13,148,136,0.1)" />
        <StatCard icon={<AlertTriangle className="w-5 h-5" />} label="待确认" val={mappings.filter(m => m.status === 'pending').length} sub="需人工审核" color={STAT_COLORS.amber} iconBg="rgba(245,158,11,0.1)" />
        <StatCard icon={<HelpCircle className="w-5 h-5" />} label="未绑定" val={mappings.filter(m => m.status === 'unbound').length} sub="暂无对应创作者" color={STAT_COLORS.gray} iconBg="rgba(148,163,184,0.1)" />
      </div>

      {/* Quick filters */}
      <div className="flex gap-2 items-center">
        {filters.map(f => (
          <button
            key={f.k}
            onClick={() => setMappingFilter(f.k)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: 'none',
              fontSize: 12,
              cursor: 'pointer',
              background: mappingFilter === f.k ? 'var(--accent)' : 'var(--bg4)',
              color: mappingFilter === f.k ? '#fff' : 'var(--text2)',
              transition: 'all .18s',
            }}
          >
            {f.l} ({f.k === 'all' ? allMappingsCount : mappings.filter(m => m.status === f.k).length})
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button
          className={`${btnGhost} ${btnSmall}`}
          onClick={() => {
            if (filteredData.length === 0) { showToast('当前筛选无记录'); return }
            const rows = filteredData.map((m) => ({
              歌曲ID: m.qishuiId,
              歌曲名: m.songName,
              绑定创作者: m.creatorName ?? '',
              匹配来源: m.source === 'auto' ? '自动' : '人工',
              状态: m.status,
              确认时间: m.confirmedAt ?? '',
            }))
            downloadCSV(rows, `映射关系_${today()}.csv`)
            showToast(`已导出 ${rows.length} 条映射记录`)
          }}
        ><Download className="inline w-3.5 h-3.5 mr-1" />导出</button>
      </div>

      {/* Table */}
      <div className={cardCls}>
        <DataTable
          columns={mappingColumns}
          data={filteredData}
          rowKey={r => r.id}
        />
      </div>
    </div>
  )
}

// ── Tab: 多维统计 ───────────────────────────────────────────────

function StatsTab({
  statsTab,
  setStatsTab,
  grandTotal,
  grandDouyin,
  grandQishui,
  userStats,
  songStats,
  periodStats,
}: {
  statsTab: string
  setStatsTab: (v: string) => void
  grandTotal: number
  grandDouyin: number
  grandQishui: number
  userStats: { name: string; songCount: number; douyin: number; qishui: number; total: number }[]
  songStats: { name: string; user: string; periodCount: number; douyin: number; qishui: number; total: number }[]
  periodStats: { period: string; songs: number; userCount: number; douyin: number; qishui: number; total: number }[]
}) {
  const maxPeriodTotal = Math.max(...periodStats.map(x => x.total), 1)

  const userColumns: Column<RevenueStats["userStats"][number]>[] = [
    { key: 'name', title: '创作者', render: (v) => {
      const idx = userStats.findIndex(u => u.name === (v as string))
      return <span style={{ fontWeight: 600 }}>#{idx + 1} {v as string}</span>
    }},
    { key: 'songCount', title: '歌曲数' },
    { key: 'douyin', title: '抖音', render: v => `¥${(v as number).toFixed(2)}` },
    { key: 'qishui', title: '汽水', render: v => `¥${(v as number).toFixed(2)}` },
    { key: 'total', title: '合计', render: v => <span style={{ fontWeight: 600, color: 'var(--green2)' }}>¥{(v as number).toFixed(2)}</span> },
  ]

  const songColumns: Column<RevenueStats["songStats"][number]>[] = [
    { key: 'name', title: '歌曲', render: (v, row) => (
      <div>
        <span style={{ fontWeight: 600 }}>{v as string}</span>
        <div style={{ fontSize: 11, color: 'var(--text3)' }}>by {(row as unknown as { user: string }).user}</div>
      </div>
    )},
    { key: 'periodCount', title: '月数' },
    { key: 'douyin', title: '抖音', render: v => `¥${(v as number).toFixed(2)}` },
    { key: 'qishui', title: '汽水', render: v => `¥${(v as number).toFixed(2)}` },
    { key: 'total', title: '合计', render: v => <span style={{ fontWeight: 600, color: 'var(--green2)' }}>¥{(v as number).toFixed(2)}</span> },
  ]

  const periodColumns: Column<RevenueStats["periodStats"][number]>[] = [
    { key: 'period', title: '月份', render: v => <span style={{ fontWeight: 600 }}>{v as string}</span> },
    { key: 'songs', title: '歌曲数' },
    { key: 'userCount', title: '创作者' },
    { key: 'douyin', title: '抖音', render: v => `¥${(v as number).toFixed(2)}` },
    { key: 'qishui', title: '汽水', render: v => `¥${(v as number).toFixed(2)}` },
    { key: 'total', title: '合计', render: v => <span style={{ fontWeight: 600, color: 'var(--green2)' }}>¥{(v as number).toFixed(2)}</span> },
  ]

  const subTabs = [
    { key: 'user', label: '按创作者' },
    { key: 'song', label: '按歌曲' },
    { key: 'period', label: '按月份' },
    { key: 'source', label: '按来源' },
  ]

  return (
    <div>
      {/* Hint */}
      <div style={{ padding: 12, background: 'rgba(253,203,110,.06)', borderRadius: 8, fontSize: 12, color: 'var(--orange)' }}>
        统计仅包含映射关系<strong>已确认</strong>的歌曲收益数据，「待确认」和「未绑定」的收益不计入统计，确保数据准确。
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={<Wallet className="w-5 h-5" />} label="已确认总收益" val={`¥${grandTotal.toFixed(2)}`} color={STAT_COLORS.teal} iconBg="rgba(13,148,136,0.1)" />
        <StatCard icon={<Smartphone className="w-5 h-5" />} label="抖音收入" val={`¥${grandDouyin.toFixed(2)}`} sub={`${grandTotal > 0 ? Math.round(grandDouyin / grandTotal * 100) : 0}%`} color={STAT_COLORS.purple} iconBg="rgba(99,102,241,0.1)" />
        <StatCard icon={<Music className="w-5 h-5" />} label="汽水收入" val={`¥${grandQishui.toFixed(2)}`} sub={`${grandTotal > 0 ? Math.round(grandQishui / grandTotal * 100) : 0}%`} color={STAT_COLORS.pink} iconBg="rgba(236,72,153,0.1)" />
        <StatCard icon={<Users className="w-5 h-5" />} label="有收益创作者" val={userStats.length} color={STAT_COLORS.amber} iconBg="rgba(245,158,11,0.1)" />
      </div>

      {/* Sub tabs */}
      <div>
        <AdminTab tabs={subTabs} active={statsTab} onChange={setStatsTab} />
      </div>

      {/* By creator */}
      {statsTab === 'user' && (
        <div className={cardCls}>
          <DataTable columns={userColumns} data={userStats} rowKey={r => r.name} />
        </div>
      )}

      {/* By song */}
      {statsTab === 'song' && (
        <div className={cardCls}>
          <DataTable columns={songColumns} data={songStats} rowKey={r => r.name} />
        </div>
      )}

      {/* By period */}
      {statsTab === 'period' && (
        <div className={cardCls}>
          {/* Bar chart */}
          <div style={{ display: 'flex', alignItems: 'end', gap: 24, height: 140, padding: '0 20px', marginBottom: 20 }}>
            {[...periodStats].reverse().map(p => (
              <div key={p.period} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'end', height: 100 }}>
                  <div style={{ width: 20, background: 'var(--accent)', borderRadius: '4px 4px 0 0', height: `${Math.max(p.douyin / maxPeriodTotal * 80, 4)}px` }} />
                  <div style={{ width: 20, background: 'var(--pink)', borderRadius: '4px 4px 0 0', height: `${Math.max(p.qishui / maxPeriodTotal * 80, 4)}px` }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6 }}>¥{p.total.toFixed(2)}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.period}</div>
              </div>
            ))}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 12, marginBottom: 16 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} />抖音</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--pink)', display: 'inline-block' }} />汽水</span>
          </div>
          <DataTable columns={periodColumns} data={periodStats} rowKey={r => r.period} />
        </div>
      )}

      {/* By source — donut chart */}
      {statsTab === 'source' && (
        <div className={cardCls}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 48, padding: '24px 0' }}>
            {/* SVG Donut */}
            <svg width="200" height="200" viewBox="0 0 200 200">
              {(() => {
                const cx = 100, cy = 100, r = 80, innerR = 52
                const douyinPct = grandTotal > 0 ? grandDouyin / grandTotal : 0.5
                const qishuiPct = grandTotal > 0 ? grandQishui / grandTotal : 0.5
                // Donut arcs
                const douyinAngle = douyinPct * 360
                const douyinEnd = douyinAngle * (Math.PI / 180)
                const qishuiStart = douyinAngle
                void qishuiStart

                function arcPath(startDeg: number, endDeg: number, outerR: number, iR: number) {
                  const s = (startDeg - 90) * (Math.PI / 180)
                  const e = (endDeg - 90) * (Math.PI / 180)
                  const largeArc = endDeg - startDeg > 180 ? 1 : 0
                  const x1 = cx + outerR * Math.cos(s)
                  const y1 = cy + outerR * Math.sin(s)
                  const x2 = cx + outerR * Math.cos(e)
                  const y2 = cy + outerR * Math.sin(e)
                  const x3 = cx + iR * Math.cos(e)
                  const y3 = cy + iR * Math.sin(e)
                  const x4 = cx + iR * Math.cos(s)
                  const y4 = cy + iR * Math.sin(s)
                  return `M${x1},${y1} A${outerR},${outerR} 0 ${largeArc} 1 ${x2},${y2} L${x3},${y3} A${iR},${iR} 0 ${largeArc} 0 ${x4},${y4} Z`
                }

                // Prevent exact 0 or 360 edge cases
                const dEnd = Math.min(douyinAngle, 359.99)
                const qEnd = Math.min(360, 359.99)

                void douyinEnd
                return (
                  <>
                    {douyinPct > 0 && <path d={arcPath(0, dEnd, r, innerR)} fill="var(--accent)" />}
                    {qishuiPct > 0 && <path d={arcPath(dEnd, qEnd, r, innerR)} fill="var(--pink)" />}
                    {/* Center text */}
                    <text x={cx} y={cy - 6} textAnchor="middle" fontSize="11" fill="var(--text3)">总收益</text>
                    <text x={cx} y={cy + 14} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--text)">
                      ¥{grandTotal.toFixed(2)}
                    </text>
                  </>
                )
              })()}
            </svg>
            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { name: '抖音', val: grandDouyin, color: 'var(--accent)' },
                { name: '汽水', val: grandQishui, color: 'var(--pink)' },
              ].map(item => {
                const pct = grandTotal > 0 ? Math.round(item.val / grandTotal * 100) : 0
                return (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 3, background: item.color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text2)' }}>{item.name}收入</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                        ¥{item.val.toFixed(2)}
                        <span style={{ fontSize: 12, fontWeight: 500, color: item.color, marginLeft: 6 }}>{pct}%</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: 结算管理 ───────────────────────────────────────────────

function SettleTab({ showToast, settlements, refetch }: { showToast: (msg: string) => void; settlements: Settlement[]; refetch: () => void }) {
  const settleColumns: Column<Settlement>[] = [
    { key: 'songTitle', title: '歌曲' },
    { key: 'platform', title: '来源平台' },
    { key: 'plays', title: '播放量', render: v => (v as number)?.toLocaleString() },
    { key: 'rawRevenue', title: '原始收益', render: v => `¥${(v as number)?.toFixed(2)}` },
    { key: 'creatorRatio', title: '创作者比例', render: v => `${v as number}%` },
    { key: 'creatorAmount', title: '创作者应得', render: v => <span style={{ fontWeight: 600, color: 'var(--green2)' }}>¥{(v as number)?.toFixed(2)}</span> },
    {
      key: 'status', title: '状态', render: v => {
        const s = SETTLE_STATUS[v as string]
        return <span style={{ color: s?.c, fontSize: 12 }}>{s?.l}</span>
      },
    },
    {
      key: 'id', title: '', render: (_v, row) => {
        const r = row as unknown as Settlement
        const handleSettle = async (action: string) => {
          const res = await apiCall('/api/admin/revenue/settlements', 'POST', { ids: [r.id], action })
          if (res.ok) { showToast(`已${action === 'confirm' ? '确认' : action === 'export' ? '导出' : '标记打款'}`); refetch() }
          else showToast(res.message ?? '操作失败')
        }
        if (r.status === 'pending') return <button className={`${btnSuccess} ${btnSmall}`} onClick={e => { e.stopPropagation(); handleSettle('confirm') }}>确认</button>
        if (r.status === 'confirmed') return <button className={`${btnPrimary} ${btnSmall}`} onClick={e => { e.stopPropagation(); handleSettle('export') }}>导出</button>
        if (r.status === 'exported') return <button className={`${btnGhost} ${btnSmall}`} onClick={e => { e.stopPropagation(); handleSettle('pay') }}>标记打款</button>
        return <span style={{ fontSize: 11, color: 'var(--green2)' }}><CheckCircle2 className="inline w-3.5 h-3.5" /></span>
      },
    },
  ]

  return (
    <div className={cardCls}>
      <h3 className="text-base font-semibold mb-4">结算明细 · {getCurrentQuarter()}</h3>
      <DataTable
        columns={settleColumns}
        data={settlements}
        rowKey={r => r.id}
      />
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button className={btnPrimary} onClick={async () => { const ids = settlements.filter((s: { status: string; id: number }) => s.status === 'pending').map(s => s.id); if (!ids.length) { showToast('没有待确认的记录'); return }; const res = await apiCall('/api/admin/revenue/settlements', 'POST', { ids, action: 'confirm' }); if (res.ok) { showToast('已批量确认'); refetch() } else showToast(res.message ?? '操作失败') }}>批量确认</button>
        <button className={btnGhost} onClick={async () => { const ids = settlements.filter((s: { status: string; id: number }) => s.status === 'confirmed').map(s => s.id); if (!ids.length) { showToast('没有待导出的记录'); return }; const res = await apiCall('/api/admin/revenue/settlements', 'POST', { ids, action: 'export' }); if (res.ok) { showToast('已导出'); refetch() } else showToast(res.message ?? '操作失败') }}><Download className="inline w-3.5 h-3.5 mr-1" />导出</button>
      </div>
    </div>
  )
}

// ── Tab: 其他平台 ───────────────────────────────────────────────

function OtherPlatformTab({ showToast }: { showToast: (msg: string) => void }) {
  const { data: otherData, refetch: refetchOther } = useApi<{ imports: OtherImport[] }>('/api/admin/revenue/other-imports')
  const otherImports = otherData?.imports ?? []
  const [platform, setPlatform] = useState('qq_music')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function doImport() {
    if (!pendingFile) { showToast('请先选择文件'); return }
    setUploading(true)
    const fd = new FormData()
    fd.append('file', pendingFile)
    fd.append('platform', platform)
    try {
      const res = await fetch('/api/admin/revenue/imports', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.code === 200) {
        const d = json.data
        showToast(`导入完成：${d.totalRows} 行 · 匹配 ${d.matchedRows} · 未匹配 ${d.unmatchedRows}`)
        setPendingFile(null)
        refetchOther()
      } else {
        showToast(json.message || '导入失败')
      }
    } catch {
      showToast('网络错误')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const otherColumns: Column<OtherImport>[] = [
    { key: 'platform', title: '平台' },
    { key: 'fileName', title: '文件名', render: v => <span style={{ fontSize: 12 }}>{v as string}</span> },
    { key: 'totalRows', title: '行数' },
    { key: 'matchedRows', title: '匹配', render: v => <span style={{ color: 'var(--green2)' }}>{v as number}</span> },
    { key: 'totalRevenue', title: '收益', render: v => `¥${(v as number).toLocaleString()}` },
    {
      key: 'status', title: '状态', render: v =>
        v === 'completed' ? <span style={{ color: 'var(--green2)', fontSize: 12 }}><CheckCircle2 className="inline w-3.5 h-3.5" /></span> : <span style={{ color: 'var(--orange)', fontSize: 12 }}>处理中</span>,
    },
  ]

  return (
    <div>
      {/* Upload section */}
      <div className={cardCls}>
        <p className="text-xs text-[var(--text3)] mb-3">
          其他平台先沿用汽水 CSV 模板（类型 | 起止日期 | 歌曲名 | 歌曲ID | 抖音收入 | 汽水收入 | 总收入），后续可单独适配各家导出格式。
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) setPendingFile(f) }}
        />
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            className={inputCls}
            style={{ width: 200, flex: 'none' }}
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option value="qq_music">QQ音乐</option>
            <option value="netease">网易云音乐</option>
            <option value="spotify">Spotify</option>
            <option value="apple_music">Apple Music</option>
            <option value="kugou">酷狗音乐</option>
          </select>
          <div
            style={{
              flex: 1,
              border: '2px dashed var(--border)',
              borderRadius: 8,
              padding: '10px 16px',
              textAlign: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              fontSize: 13,
              color: 'var(--text2)',
              opacity: uploading ? 0.6 : 1,
            }}
            onClick={() => !uploading && fileInputRef.current?.click()}
          >
            <FileAudio className="inline w-4 h-4 mr-1 text-[var(--text3)]" /> {pendingFile ? pendingFile.name : '点击选择 CSV 文件'}
          </div>
          <button className={btnPrimary} onClick={doImport} disabled={uploading || !pendingFile}>
            {uploading ? '导入中...' : '导入'}
          </button>
        </div>
      </div>

      {/* Import history */}
      <div className={cardCls}>
        <DataTable
          columns={otherColumns}
          data={otherImports}
          rowKey={r => r.id}
        />
      </div>
    </div>
  )
}

// ── Tab: 平台分发结算 ──────────────────────────────────────────

function PlatformSettleTab({ showToast }: { showToast: (msg: string) => void }) {
  const { data: psData, refetch: refetchPs } = useApi<{ settlements: Settlement[] }>('/api/admin/revenue/platform-settlements')
  const platformSettlements = psData?.settlements ?? []

  const psColumns: Column<Settlement>[] = [
    { key: 'songTitle', title: '歌曲' },
    {
      key: 'platform', title: '来源平台', render: v =>
        <span style={{ background: 'var(--bg4)', color: 'var(--accent)', borderRadius: 4, padding: '2px 6px', fontSize: 12 }}>{v as string}</span>,
    },
    { key: 'period', title: '账期' },
    { key: 'rawRevenue', title: '原始收益', render: v => `¥${(v as number).toFixed(2)}` },
    { key: 'creatorRatio', title: '创作者比例', render: v => `${v as number}%` },
    { key: 'creatorAmount', title: '创作者应得', render: v => <span style={{ fontWeight: 600, color: 'var(--green2)' }}>¥{(v as number).toFixed(2)}</span> },
    {
      key: 'status', title: '结算状态', render: v => {
        const s = SETTLE_STATUS[v as string]
        return <span style={{ color: s?.c, fontSize: 12, fontWeight: 500 }}>{s?.l}</span>
      },
    },
    {
      key: 'id', title: '', render: (_v, row) => {
        const r = row as unknown as Settlement
        const handlePsAction = async (action: string) => {
          const res = await apiCall('/api/admin/revenue/settlements', 'POST', { ids: [r.id], action })
          if (res.ok) { showToast(action === 'confirm' ? '已确认' : action === 'export' ? '已导出' : '已标记打款'); refetchPs() }
          else showToast(res.message ?? '操作失败')
        }
        if (r.status === 'pending') return <button className={`${btnSuccess} ${btnSmall}`} onClick={e => { e.stopPropagation(); handlePsAction('confirm') }}>确认</button>
        if (r.status === 'confirmed') return <button className={`${btnPrimary} ${btnSmall}`} onClick={e => { e.stopPropagation(); handlePsAction('export') }}>导出</button>
        if (r.status === 'exported') return <button className={`${btnGhost} ${btnSmall}`} onClick={e => { e.stopPropagation(); handlePsAction('pay') }}>标记打款</button>
        return null
      },
    },
  ]

  return (
    <div className={cardCls}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-base font-semibold">平台分发结算（非汽水平台）</h3>
        <div className="text-xs text-[var(--text3)]">来源：其他平台导入后生成的 settlements 记录</div>
      </div>
      <DataTable
        columns={psColumns}
        data={platformSettlements}
        rowKey={r => r.id}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className={btnGhost} onClick={async () => { const ids = platformSettlements.filter((s: { status: string; id: number }) => s.status === 'pending').map(s => s.id); if (!ids.length) { showToast('没有待确认的记录'); return }; const res = await apiCall('/api/admin/revenue/settlements', 'POST', { ids, action: 'confirm' }); if (res.ok) { showToast('已批量确认'); refetchPs() } else showToast(res.message ?? '操作失败') }}>批量确认</button>
        <button className={btnGhost} onClick={async () => { const ids = platformSettlements.filter((s: { status: string; id: number }) => s.status === 'confirmed').map(s => s.id); if (!ids.length) { showToast('没有待导出的记录'); return }; const res = await apiCall('/api/admin/revenue/settlements', 'POST', { ids, action: 'export' }); if (res.ok) { showToast('已批量导出'); refetchPs() } else showToast(res.message ?? '操作失败') }}>批量导出</button>
      </div>
    </div>
  )
}

// ── Import detail modal content ─────────────────────────────────

function ImportDetailContent({ row, showToast, refetch }: { row: RevenueImport; showToast: (msg: string) => void; refetch: () => void }) {
  const { data: detailData } = useApi<{
    idConfirmed: QishuiDetail[]
    namePending: { id: number; songName: string; qishuiSongId: string; matchedUserName: string; douyinRevenue: number; qishuiRevenue: number; totalRevenue: number; matchStatus: string }[]
    unmatched: { id: number; songName: string; qishuiSongId: string; totalRevenue: number; matchStatus: string }[]
  }>(`/api/admin/revenue/imports/${row.id}`)

  const idConfirmed = detailData?.idConfirmed ?? []
  const namePending = detailData?.namePending ?? []
  const unmatched = detailData?.unmatched ?? []
  void refetch

  return (
    <div>
      {/* 4 stat boxes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {[
          ['总行数', row.totalRows, 'var(--text)'],
          ['ID命中', row.idHit, 'var(--green2)'],
          ['歌名待确认', row.nameMatch, 'var(--orange)'],
          ['重复跳过', row.duplicates, 'var(--red)'],
        ].map(([l, v, c]) => (
          <div key={l as string} style={{ textAlign: 'center', padding: 10, background: 'var(--bg4)', borderRadius: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: c as string }}>{v as number}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{l as string}</div>
          </div>
        ))}
      </div>

      {row.duplicates > 0 && (
        <div style={{ padding: 10, background: 'rgba(255,107,107,.08)', borderRadius: 8, marginBottom: 12, fontSize: 12, color: 'var(--red)' }}>
          {row.duplicates}条重复数据（相同歌曲ID+月份已存在），已自动跳过。
        </div>
      )}

      {/* Match flow */}
      <div style={{ padding: 12, background: 'var(--bg4)', borderRadius: 8, marginBottom: 16, fontSize: 12, lineHeight: 2, color: 'var(--text2)' }}>
        <strong>匹配流程：</strong>
        ① 歌曲ID查映射关系表 → <span style={{ color: 'var(--green2)' }}>ID命中（直接归属，最可靠）</span> →
        ② 新歌曲ID走歌名匹配 → <span style={{ color: 'var(--orange)' }}>歌名待确认（需人工确认后写入映射表）</span> →
        ③ 歌名也未匹配 → <span style={{ color: 'var(--text3)' }}>未匹配（可人工绑定）</span>
      </div>

      {/* ID confirmed */}
      {idConfirmed.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--green2)' }}>ID映射命中（已确认，自动归属）</h4>
          <DataTable
            columns={[
              { key: 'songName', title: '歌曲', render: v => <span style={{ fontWeight: 500 }}>{v as string}</span> },
              { key: 'month', title: '月份' },
              { key: 'douyinRevenue', title: '抖音', render: v => `¥${(v as number).toFixed(2)}` },
              { key: 'qishuiRevenue', title: '汽水', render: v => `¥${(v as number).toFixed(2)}` },
              { key: 'id', title: '合计', render: (_v, r) => {
                const d = r as unknown as QishuiDetail
                return <span style={{ fontWeight: 600 }}>¥{(d.douyinRevenue + d.qishuiRevenue).toFixed(2)}</span>
              }},
            ]}
            data={idConfirmed}
            rowKey={r => r.id}
          />
        </div>
      )}

      {/* Name pending */}
      {namePending.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--orange)' }}>歌名匹配待确认（确认后写入映射表）</h4>
          <DataTable
            columns={[
              { key: 'songName', title: '歌曲', render: v => <span style={{ fontWeight: 500 }}>{v as string}</span> },
              { key: 'qishuiSongId', title: '歌曲ID', render: v => <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)' }}>{v as string}</span> },
              { key: 'matchedUserName', title: '建议创作者', render: v => v ? <span style={{ color: 'var(--orange)' }}>→ {v as string} ?</span> : <span>—</span> },
              { key: 'totalRevenue', title: '收益', render: v => `¥${(v as number).toFixed(2)}` },
              { key: 'id', title: '', render: (_v, r) => {
                const d = r as unknown as { id: number; songName: string; matchedUserName: string }
                return (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {d.matchedUserName && (
                      <button className={`${btnSuccess} ${btnSmall}`} onClick={async () => {
                        const res = await apiCall(`/api/admin/revenue/mappings/${d.id}`, 'PUT', { action: 'confirm' })
                        if (res.ok) {
                          const created = (res.data as { backfill?: { created: number } } | null)?.backfill?.created ?? 0
                          showToast(
                            created > 0
                              ? `已确认「${d.songName}」→「${d.matchedUserName}」，回溯生成 ${created} 条结算`
                              : `已确认「${d.songName}」→「${d.matchedUserName}」，已写入映射表`,
                          )
                        } else showToast(res.message ?? '确认失败')
                      }}>
                        确认绑定
                      </button>
                    )}
                    <button className={`${btnGhost} ${btnSmall}`} onClick={() => showToast('请在匹配关系页签中手动绑定')}>手动绑定</button>
                  </div>
                )
              }},
            ]}
            data={namePending}
            rowKey={r => r.id}
          />
        </div>
      )}

      {/* Unmatched */}
      {unmatched.length > 0 && (
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text3)' }}>未匹配（可手动绑定创作者）</h4>
          <DataTable
            columns={[
              { key: 'songName', title: '歌曲' },
              { key: 'qishuiSongId', title: '歌曲ID', render: v => <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text3)' }}>{v as string}</span> },
              { key: 'totalRevenue', title: '收益', render: v => `¥${(v as number).toFixed(2)}` },
              { key: 'id', title: '', render: () => <button className={`${btnGhost} ${btnSmall}`} onClick={() => showToast('请在匹配关系页签中绑定创作者')}>绑定创作者</button> },
            ]}
            data={unmatched}
            rowKey={r => r.id}
          />
        </div>
      )}
    </div>
  )
}

// ── Link creator form ───────────────────────────────────────────

function LinkCreatorForm({ mapping, onSubmit }: { mapping: Mapping; onSubmit: (creatorId: number) => void }) {
  const { data: creatorsData } = useApi<{ creators: CreatorOption[] }>('/api/admin/revenue/creators')
  const creators = creatorsData?.creators ?? []
  const [selectedCreatorId, setSelectedCreatorId] = useState('')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: 16, background: 'var(--bg4)', borderRadius: 10 }}>
        <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text3)' }}>歌曲名称</span>
            <span>{mapping.songName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text3)' }}>歌曲ID</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{mapping.qishuiId}</span>
          </div>
        </div>
      </div>
      <div>
        <label className={labelCls}>选择创作者</label>
        <select className={inputCls} value={selectedCreatorId} onChange={e => setSelectedCreatorId(e.target.value)}>
          <option value="">请选择创作者...</option>
          {creators.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>
          ))}
        </select>
      </div>
      <div style={{ padding: 10, background: 'rgba(108,92,231,.06)', borderRadius: 8, fontSize: 12, color: 'var(--accent2)', lineHeight: 1.6 }}>
        确认绑定后，该歌曲ID的所有历史和未来收益将自动归属到选定的创作者。映射关系写入映射表后，后续导入无需再次确认。
      </div>
      <button
        className={`${btnPrimary} w-full flex justify-center`}
        onClick={() => { if (selectedCreatorId) onSubmit(Number(selectedCreatorId)) }}
      >
        确认绑定
      </button>
    </div>
  )
}
