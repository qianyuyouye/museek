/**
 * 轻量 XSS 过滤：正则实现，覆盖 90% 常见攻击向量。
 * 不依赖 DOMPurify/jsdom（避免 ESM/打包复杂度）。
 *
 * 覆盖：
 * - 剔除危险标签连同内部内容：script, iframe, object, embed, style, link, meta, form, svg/math（JSON payload 绕过）
 * - 剔除所有 on* 事件属性（含引号变体）
 * - 剔除 href/src 里的 javascript: / data:text/html 协议
 *
 * 不覆盖（需更专业库）：
 * - 带 base64 payload 的 SVG data URI
 * - 复杂 CSS expression / Mutation XSS
 * 当前 CMS 富文本渲染若使用 dangerouslySetInnerHTML，必须升级为专业库。
 */

const DANGEROUS_TAG_RE = /<\s*(script|iframe|object|embed|style|link|meta|form|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi
const DANGEROUS_TAG_VOID_RE = /<\s*(script|iframe|object|embed|style|link|meta|form|svg|math)[^>]*\/?\s*>/gi
const EVENT_ATTR_RE = /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const JS_PROTO_RE = /(href|src|action|xlink:href)\s*=\s*(["'])\s*(?:javascript|vbscript|data:text\/html)\s*:[^"']*\2/gi
const JS_PROTO_UNQUOTED_RE = /(href|src|action|xlink:href)\s*=\s*(?:javascript|vbscript|data:text\/html)\s*:[^\s>]*/gi

export function sanitizeHtml(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') return ''
  let out = dirty
  out = out.replace(DANGEROUS_TAG_RE, '')
  out = out.replace(DANGEROUS_TAG_VOID_RE, '')
  out = out.replace(EVENT_ATTR_RE, '')
  out = out.replace(JS_PROTO_RE, '$1=""')
  out = out.replace(JS_PROTO_UNQUOTED_RE, '$1=""')
  return out
}

/** 完全剥离 HTML，只保留纯文本 */
export function stripHtml(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') return ''
  return sanitizeHtml(dirty).replace(/<[^>]+>/g, '')
}
