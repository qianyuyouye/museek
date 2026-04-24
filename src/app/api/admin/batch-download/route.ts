import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, safeHandler } from '@/lib/api-utils'
import { logAdminAction } from '@/lib/log-action'
import JSZip from 'jszip'

export const POST = safeHandler(async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'admin.songs.export')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const { songIds }: { songIds: number[] } = body

  if (!Array.isArray(songIds) || songIds.length === 0) {
    return NextResponse.json({ code: 400, message: '请选择至少一首歌曲' }, { status: 400 })
  }
  if (songIds.length > 100) {
    return NextResponse.json({ code: 400, message: '单次最多下载 100 首歌曲' }, { status: 400 })
  }

  const songs = await prisma.platformSong.findMany({
    where: { id: { in: songIds } },
    include: { user: { select: { name: true, realName: true, realNameStatus: true, agencyContract: true } } },
  })

  const zip = new JSZip()
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_').trim()
  const errors: string[] = []
  let successCount = 0

  for (const song of songs) {
    const audioUrl = song.audioUrl
    if (!audioUrl) { errors.push(`${song.title}: 无音频地址`); continue }

    try {
      const res = await fetch(audioUrl)
      if (!res.ok) { errors.push(`${song.title}: HTTP ${res.status}`); continue }
      const buffer = Buffer.from(await res.arrayBuffer())
      const ext = (audioUrl.match(/\.(mp3|wav|flac|m4a|ogg)$/i)?.[1] ?? 'mp3').toLowerCase()
      const filename = `${safe(song.copyrightCode || String(song.id))}_${safe(song.title)}.${ext}`
      zip.file(filename, buffer)
      successCount++

      if (song.coverUrl) {
        try {
          const cr = await fetch(song.coverUrl)
          if (cr.ok) {
            const cblob = Buffer.from(await cr.arrayBuffer())
            const cext = (song.coverUrl.match(/\.(jpg|jpeg|png|webp)$/i)?.[1] ?? 'jpg').toLowerCase()
            zip.file(`covers/${safe(song.copyrightCode || String(song.id))}.${cext}`, cblob)
          }
        } catch { /* 封面失败不影响音频 */ }
      }
    } catch (e) {
      errors.push(`${song.title}: ${e instanceof Error ? e.message : '下载失败'}`)
    }

    // 代理发行授权凭证 PDF
    if (song.user.realNameStatus === 'verified') {
      try {
        const pr2 = await fetch(`${request.nextUrl.origin}/api/admin/songs/${song.id}/agency-pdf`)
        if (pr2.ok) {
          const pblob = Buffer.from(await pr2.arrayBuffer())
          zip.file(`agency-pdfs/${safe(song.copyrightCode || String(song.id))}.pdf`, pblob)
        }
      } catch { /* PDF 失败不影响音频 */ }
    }
  }

  // Validation report
  const report = songs.map(song => {
    const missingAgency = !song.user.agencyContract
    const missingRealName = song.user.realNameStatus !== 'verified'
    const missingIsrc = !song.isrc || !song.isrc.trim()
    return { song, missingAgency, missingRealName, missingIsrc }
  })
  const lines: string[] = ['Museek 批量下载校验报告', `生成时间：${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, '']
  lines.push(`==== 通过 (${report.filter(v => !v.missingAgency && !v.missingRealName && !v.missingIsrc).length}) ====`)
  for (const v of report) {
    if (!v.missingAgency && !v.missingRealName && !v.missingIsrc) {
      lines.push(`[${v.song.copyrightCode}] ${v.song.title}`)
    }
  }
  lines.push('')
  lines.push(`==== 不合规 (${report.filter(v => v.missingAgency || v.missingRealName || v.missingIsrc).length}) ====`)
  for (const v of report) {
    if (v.missingAgency || v.missingRealName || v.missingIsrc) {
      lines.push(`[${v.song.copyrightCode}] ${v.song.title}`)
      if (v.missingAgency) lines.push('  ❌ 未签代理协议')
      if (v.missingRealName) lines.push('  ❌ 未实名认证')
      if (v.missingIsrc) lines.push('  ⚠️ ISRC 未申报')
    }
  }
  zip.file('validation-report.txt', lines.join('\n') + '\n')

  // Metadata JSON
  zip.file('metadata.json', JSON.stringify(
    songs.map(s => ({
      id: s.id, title: s.title, creator: s.user.realName || s.user.name || `用户${s.userId}`,
      genre: s.genre, bpm: s.bpm, aiTools: s.aiTools ?? [], score: s.score,
      copyrightCode: s.copyrightCode, isrc: s.isrc, status: s.status,
    })),
    null, 2,
  ))

  if (errors.length > 0) {
    zip.file('errors.txt', errors.join('\n'))
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

  await logAdminAction(request, {
    action: 'batch_download_songs',
    targetType: 'platform_song',
    detail: { count: songs.length, success: successCount, errors: errors.length, songIds },
  }).catch(() => {})

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="批量下载_${new Date().toISOString().slice(0, 10)}.zip"`,
    },
  })
})
