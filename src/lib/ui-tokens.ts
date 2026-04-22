/**
 * 全站统一样式常量（Admin / Creator / Reviewer 三端共享）
 *
 * 使用方式：
 *   import { cardCls, btnPrimary, pageWrap } from '@/lib/ui-tokens'
 *   <div className={pageWrap}>
 *     <div className={cardCls}>...</div>
 *   </div>
 *
 * 设计基线：
 *   - 字号：以 admin 端为基线（正文 text-sm / 标题 text-lg）
 *   - 圆角：卡片 12px(rounded-xl)、按钮 8px(rounded-lg)
 *   - 颜色：全部走 CSS 变量（见 globals.css），禁止新增硬编码 #xxxxxx
 */

// ─── 文字 ──────────────────────────────
/** 页面主标题 18px */
export const textPageTitle = 'text-lg font-bold text-[var(--text)]'
/** 区块/卡片标题 16px */
export const textSectionTitle = 'text-base font-semibold text-[var(--text)]'
/** 正文 14px */
export const textBody = 'text-sm text-[var(--text)]'
/** 次级正文 14px */
export const textMuted = 'text-sm text-[var(--text2)]'
/** 辅助说明 / 标签 / 表头 12px */
export const textCaption = 'text-xs text-[var(--text3)]'
/** 数字统计 24px */
export const textStat = 'text-2xl font-bold text-[var(--text)]'

// ─── 布局 ──────────────────────────────
/** 页面整体容器：padding + section 间距 */
export const pageWrap = 'p-6 space-y-4'
/** 卡片 grid，响应式 1/2/4 列 */
export const gridCards = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'
/** 表单两列 */
export const gridForm2 = 'grid grid-cols-2 gap-4'

// ─── 卡片 ──────────────────────────────
/** 标准卡片 */
export const cardCls =
  'bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.3)]'
/** 紧凑卡片（列表项、统计小卡） */
export const cardCompact =
  'bg-[var(--bg3)] border border-[var(--border)] rounded-xl p-4 shadow-[0_1px_4px_rgba(0,0,0,0.3)]'

// ─── 按钮 ──────────────────────────────
/** 主按钮（渐变） */
export const btnPrimary =
  'bg-gradient-to-r from-[var(--accent)] to-[var(--accent2)] text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-[0_2px_8px_rgba(99,102,241,0.25)] cursor-pointer border-0 transition-all hover:-translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0'
/** 次按钮（空心） */
export const btnGhost =
  'bg-transparent text-[var(--text2)] border border-[var(--border)] px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer hover:bg-[var(--bg4)] transition-colors'
/** 小按钮（表格操作列等） */
export const btnSmall =
  'text-xs px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] text-[var(--text2)] cursor-pointer hover:bg-[var(--bg4)] transition-colors'
/** 成功按钮（绿色渐变） */
export const btnSuccess =
  'bg-gradient-to-r from-[var(--green2)] to-[var(--green)] text-white px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border-0 transition-all hover:-translate-y-[1px]'
/** 危险按钮 */
export const btnDanger =
  'bg-[var(--red)] text-white px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer border-0 transition-all hover:opacity-90'

// ─── 表单 ──────────────────────────────
/** 表单 label */
export const labelCls = 'block text-xs text-[var(--text2)] mb-1.5 font-medium'
/** 输入框 / select / 都用这个 */
export const inputCls =
  'w-full px-3.5 py-2.5 bg-[var(--bg3)] border-[1.5px] border-[var(--border)] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] transition-colors disabled:bg-[var(--bg2)] disabled:text-[var(--text3)]'
/** 文本域 */
export const textareaCls = `${inputCls} resize-none`

// ─── 表格 ──────────────────────────────
export const tableHeadCell = 'px-3 py-2.5 text-xs font-medium text-[var(--text3)] text-left'
export const tableBodyCell = 'px-3 py-3 text-sm text-[var(--text)]'

// ─── 阴影 ──────────────────────────────
export const shadowCard = 'shadow-[0_1px_4px_rgba(0,0,0,0.3)]'
export const shadowBtn = 'shadow-[0_2px_8px_rgba(129,140,248,0.2)]'
export const shadowModal = 'shadow-[0_20px_60px_rgba(0,0,0,0.5)]'

// ─── 徽章 / 状态标签 ──────────────────────────────
/** 基础徽章（配合语义色使用） */
export const badgeBase = 'inline-flex items-center gap-1 px-2.5 py-[3px] text-xs font-medium rounded-full'

// ─── 骨架屏 ──────────────────────────────
export const skeletonBase = 'bg-[var(--bg4)] rounded animate-skeleton-pulse'
export const skeletonText = 'h-4 bg-[var(--bg4)] rounded animate-skeleton-pulse'
export const skeletonCard = 'h-24 bg-[var(--bg4)] rounded-xl animate-skeleton-pulse'

// ─── 表单 select ──────────────────────
/** select 下拉框（比 inputCls 多 appearance-none） */
export const selectCls =
  'px-3.5 py-2.5 bg-[var(--bg3)] border-[1.5px] border-[var(--border)] rounded-lg text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] appearance-none cursor-pointer transition-colors'

// ─── 状态占位 ──────────────────────────
/** 加载中 / 无数据占位 */
export const loadingState = 'py-10 text-center text-sm text-[var(--text3)]'
/** 列表空状态 */
export const emptyState = 'py-10 text-center text-sm text-[var(--text3)]'

// ─── 信息提示框 ────────────────────────
/** 紫色提示框（操作提示） */
export const infoBoxPurple = 'p-[10px] rounded-lg text-xs bg-[rgba(108,92,231,.08)]'
/** 红色警告框 */
export const infoBoxRed = 'p-[10px] rounded-lg text-xs bg-[rgba(255,107,107,.08)] text-[var(--red)]'
/** 橙色提示框（待审核等） */
export const infoBoxOrange = 'p-[10px] rounded-lg text-xs bg-[rgba(253,203,110,.08)] text-[var(--orange)]'
/** 灰色提示框（未操作等） */
export const infoBoxGray = 'p-[10px] rounded-lg text-xs bg-[rgba(107,114,128,.08)] text-[var(--text3)]'
/** 绿色提示框（成功/已认证） */
export const infoBoxGreen = 'p-[10px] rounded-lg text-xs bg-[rgba(85,239,196,.12)] text-[var(--green2)]'

// ─── Key-Value 行 ──────────────────────
/** 详情页 Key-Value 行容器 */
export const kvRow = 'flex justify-between items-center px-3 py-2 rounded-md bg-[var(--bg4)] text-sm'
/** Key-Value 标签色 */
export const kvLabel = 'text-[var(--text3)]'

// ─── Tab 栏 ────────────────────────────
/** Tab 栏容器 */
export const tabBar = 'flex gap-8 border-b border-[var(--border)]'
/** 激活态 Tab */
export const tabActive = 'border-b-2 border-[var(--accent)] font-semibold text-[var(--text)]'
/** 未激活 Tab */
export const tabInactive = 'border-b-2 border-transparent text-[var(--text3)]'

// ─── 筛选栏 / 分页 ─────────────────────
/** 筛选栏容器 */
export const filterRow = 'flex items-center gap-3 flex-wrap'
/** 分页按钮 */
export const paginationBtn = 'w-7 h-7 rounded border border-[var(--border)] bg-[var(--bg3)] flex items-center justify-center text-sm'
/** 分页当前页 */
export const paginationBtnActive = 'border-[var(--accent)] bg-[var(--accent)] text-white'

// ─── 详情页布局 ────────────────────────
/** 详情页双列布局 */
export const detailGrid = 'grid grid-cols-2 gap-5'
