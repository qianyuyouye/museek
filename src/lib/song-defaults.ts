export interface SongSubmitLike {
  title: string
  performer?: string | null
  lyricist?: string | null
  composer?: string | null
  albumName?: string | null
  albumArtist?: string | null
}

interface UserLike {
  realName?: string | null
  name: string
}

/**
 * 按 PRD §7.1.2 为歌曲提交体填充默认值：
 * - performer / lyricist / composer / albumArtist：实名（未实名回落登录名）
 * - albumName：标题
 * 已填写的字段（含非空白字符串）原样保留。
 */
export function fillSongDefaults<T extends SongSubmitLike>(body: T, user: UserLike): T {
  const fallback = (user.realName?.trim() || user.name).trim()
  const nonEmpty = (v: string | null | undefined) =>
    v && v.trim().length > 0 ? v.trim() : null
  return {
    ...body,
    performer: nonEmpty(body.performer) ?? fallback,
    lyricist: nonEmpty(body.lyricist) ?? fallback,
    composer: nonEmpty(body.composer) ?? fallback,
    albumName: nonEmpty(body.albumName) ?? body.title,
    albumArtist: nonEmpty(body.albumArtist) ?? fallback,
  }
}
