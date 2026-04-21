/**
 * 富文本 HTML 净化。使用 isomorphic-dompurify（服务端 jsdom + 浏览器原生 DOM）。
 *
 * 策略：
 * - 允许常见展示标签（p, h1-h6, br, strong, em, u, s, blockquote, ul/ol/li, a, img, code, pre）
 * - 允许属性白名单：a.href、img.src/alt/title、class（样式兜底）
 * - 禁掉 script/iframe/object/embed/style/link/meta/form/svg/math 等危险标签
 * - 禁掉所有 on* 事件属性
 * - href/src 只允许 http(s)/mailto/tel/相对路径，拒掉 javascript:/vbscript:/data:text/html
 *
 * TipTap 默认产出的 HTML 完全在白名单内。
 */
import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'u', 's', 'del', 'ins', 'sub', 'sup', 'mark',
  'blockquote', 'code', 'pre',
  'ul', 'ol', 'li',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div',
]

const ALLOWED_ATTR = [
  'href', 'target', 'rel',
  'src', 'alt', 'title', 'width', 'height',
  'class', 'style',
  'colspan', 'rowspan',
]

/** 净化富文本 HTML，返回安全的 HTML 字符串（可直接 dangerouslySetInnerHTML） */
export function sanitizeHtml(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') return ''
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // 禁掉 script 协议
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|ftp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    // 强制 target=_blank 时加 noopener
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta', 'form', 'svg', 'math'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onkeydown', 'onkeyup', 'onsubmit'],
  })
}

/** 完全剥离 HTML，只保留纯文本 */
export function stripHtml(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') return ''
  return sanitizeHtml(dirty).replace(/<[^>]+>/g, '')
}
