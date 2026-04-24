import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePermission, err, safeHandler } from '@/lib/api-utils'
import { buildAgencyPdf } from '@/lib/agency-pdf'

/**
 * GET /api/admin/songs/:id/agency-pdf
 * 返回该作品的代理发行授权凭证 PDF（application/pdf）
 * 前提：创作者已签 agency_contract。否则返回 400。
 */
export const GET = safeHandler(async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePermission(request, 'admin.songs.export')
  if ('error' in auth) return auth.error

  const { id } = await params
  const songId = parseInt(id, 10)
  if (isNaN(songId)) return err('无效的歌曲 ID')

  const song = await prisma.platformSong.findUnique({
    where: { id: songId },
    include: { user: true },
  })
  if (!song) return err('歌曲不存在', 404)
  if (!song.user.agencyContract) return err('创作者尚未签署代理发行协议', 400)

  const pdfBuffer = await buildAgencyPdf({
    copyrightCode: song.copyrightCode,
    songTitle: song.title,
    creatorRealName: song.user.realName,
    creatorPhone: song.user.phone,
    agencySignedAt: song.user.agencySignedAt,
    issueDate: new Date(),
  })

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="agency-${song.copyrightCode}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
})
