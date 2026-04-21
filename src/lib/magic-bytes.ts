export function checkMagicBytes(buf: Buffer, type: 'audio' | 'image'): string | null {
  if (buf.length < 12) return '文件过小，无法识别格式'

  if (type === 'audio') {
    // MP3 ID3v2: "ID3"
    if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return null
    // MP3 帧同步字 FF Ex（MPEG1/2/2.5 Layer I/II/III）
    if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return null
    // WAV: "RIFF" .... "WAVE"
    if (
      buf.subarray(0, 4).toString('ascii') === 'RIFF'
      && buf.subarray(8, 12).toString('ascii') === 'WAVE'
    ) return null
    return '音频文件头部字节不匹配 MP3/WAV 格式'
  }

  // image
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return null  // JPEG
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return null  // PNG
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF'
    && buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return null
  return '图片文件头部字节不匹配 JPEG/PNG/WEBP 格式'
}
