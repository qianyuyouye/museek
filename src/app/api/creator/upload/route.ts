import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, ok, err, safeHandler} from '@/lib/api-utils'

/** 生成唯一的 copyrightCode */
async function generateCopyrightCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = `AIMU-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`
    const exists = await prisma.platformSong.findUnique({
      where: { copyrightCode: code },
      select: { id: true },
    })
    if (!exists) return code
  }
  throw new Error('无法生成唯一的版权编码')
}

export const POST = safeHandler(async function POST(request: NextRequest) {
  const { userId, portal } = getCurrentUser(request)
  if (!userId || portal !== 'creator') return err('无权限', 403)

  const body = await request.json()
  const { title, lyricist, composer, aiTool, aiTools, genre, bpm, prompt, lyrics, contribution, creationDesc, styleDesc, audioUrl, coverUrl, audioFeatures } = body

  if (!title) return err('标题不能为空')

  const copyrightCode = await generateCopyrightCode()

  const song = await prisma.platformSong.create({
    data: {
      copyrightCode,
      userId,
      title,
      lyricist,
      composer,
      aiTools: aiTools || (aiTool ? [aiTool] : undefined),
      genre,
      bpm: bpm ? parseInt(String(bpm), 10) : undefined,
      lyrics,
      styleDesc: styleDesc || prompt,
      audioUrl: audioUrl || undefined,
      coverUrl: coverUrl || undefined,
      audioFeatures: audioFeatures || undefined,
      contribution: contribution || 'lead',
      creationDesc,
      source: 'upload',
      status: 'pending_review',
    },
  })

  return ok({
    id: song.id,
    copyrightCode: song.copyrightCode,
  })
})
