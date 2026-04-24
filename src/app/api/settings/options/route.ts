import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { safeHandler } from '@/lib/api-utils'
import { SETTING_KEYS } from '@/lib/settings-keys'

export const GET = safeHandler(async function GET() {
  const [aiToolsRow, genresRow] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: SETTING_KEYS.AI_TOOLS } }),
    prisma.systemSetting.findUnique({ where: { key: SETTING_KEYS.GENRES } }),
  ])

  const aiTools = Array.isArray(aiToolsRow?.value) ? aiToolsRow.value : ['汽水创作实验室', 'Suno', 'Udio', '其他']
  const genres = Array.isArray(genresRow?.value) ? genresRow.value : ['Pop', 'Rock', 'R&B', 'Hip-Hop', '电子', '古典', '民谣']

  return NextResponse.json({ code: 200, data: { aiTools, genres } })
})
