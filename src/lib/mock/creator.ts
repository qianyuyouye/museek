// src/lib/mock/creator.ts

import {
  MOCK_SONGS,
  MOCK_STUDENTS,
  MOCK_USER_GROUPS,
} from './admin'

// ═══ Types ═══

export interface CreatorAssignment {
  id: number
  title: string
  groupId: number
  groupName: string
  description: string
  deadline: string
  status: 'active' | 'closed' | 'draft'
  memberCount: number
  submittedCount: number
  formFields: CreatorFormField[]
}

export interface CreatorFormField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'multiselect'
  required: boolean
  defaultValue: string | string[]
  options?: string[]
}

export interface CreatorSubmission {
  id: number
  assignmentId: number
  userId: number
  data: Record<string, string | string[]>
  audioUrl: string
  status: 'reviewed' | 'pending_review' | 'needs_revision'
  score: number | null
  submittedAt: string
}

// ═══ Current User ═══

export const CURRENT_USER = MOCK_STUDENTS.find((s) => s.id === 1)!

// ═══ Form Fields Template ═══

const DEFAULT_FORM_FIELDS: CreatorFormField[] = [
  { key: 'aiTool', label: '创作工具', type: 'multiselect', required: true, defaultValue: [], options: ['汽水创作实验室', 'Suno'] },
  { key: 'songTitle', label: '歌曲标题', type: 'text', required: true, defaultValue: '' },
  { key: 'performer', label: '表演者', type: 'text', required: true, defaultValue: '{realName}' },
  { key: 'lyricist', label: '词作者', type: 'text', required: true, defaultValue: '{realName}' },
  { key: 'composer', label: '曲作者', type: 'text', required: true, defaultValue: '{realName}' },
  { key: 'lyrics', label: '歌词', type: 'textarea', required: true, defaultValue: '' },
  { key: 'styleDesc', label: '风格描述', type: 'text', required: false, defaultValue: '' },
  { key: 'albumName', label: '专辑名称', type: 'text', required: false, defaultValue: '{songTitle}' },
  { key: 'albumArtist', label: '专辑歌手', type: 'text', required: false, defaultValue: '{realName}' },
]

// ═══ Assignments (enriched from admin data + HTML prototype) ═══

export const CREATOR_ASSIGNMENTS: CreatorAssignment[] = [
  {
    id: 1,
    title: '第一次AI音乐创作作业',
    groupId: 1,
    groupName: '三明医学科技职业技术学院',
    description: '使用AI工具创作一首原创歌曲，主题不限。要求完整填写元数据信息，上传音频文件。',
    deadline: '2026-04-30',
    status: 'active',
    memberCount: 45,
    submittedCount: 5,
    formFields: [
      ...DEFAULT_FORM_FIELDS.slice(0, 6),
      { key: 'styleDesc', label: '风格描述', type: 'text', required: true, defaultValue: '' },
      ...DEFAULT_FORM_FIELDS.slice(7),
    ],
  },
  {
    id: 2,
    title: '第二次AI音乐创作作业',
    groupId: 1,
    groupName: '三明医学科技职业技术学院',
    description: '以"春天"为主题创作一首歌曲，注意旋律与歌词的配合。',
    deadline: '2026-05-31',
    status: 'active',
    memberCount: 45,
    submittedCount: 0,
    formFields: DEFAULT_FORM_FIELDS,
  },
  {
    id: 3,
    title: '社会组首次作品征集',
    groupId: 2,
    groupName: '社会组',
    description: '面向社会组成员的首次AI音乐作品征集，题材风格不限。',
    deadline: '2026-06-30',
    status: 'active',
    memberCount: 28,
    submittedCount: 1,
    formFields: [
      DEFAULT_FORM_FIELDS[0],
      DEFAULT_FORM_FIELDS[1],
      { key: 'performer', label: '表演者', type: 'text', required: false, defaultValue: '{realName}' },
      { key: 'lyricist', label: '词作者', type: 'text', required: false, defaultValue: '{realName}' },
      { key: 'composer', label: '曲作者', type: 'text', required: false, defaultValue: '{realName}' },
      DEFAULT_FORM_FIELDS[5],
      ...DEFAULT_FORM_FIELDS.slice(6),
    ],
  },
]

// ═══ Submission Records (enriched with form data from HTML prototype) ═══

export const CREATOR_SUBMISSIONS: CreatorSubmission[] = [
  {
    id: 1,
    assignmentId: 1,
    userId: 1,
    data: {
      aiTool: ['汽水创作实验室'],
      songTitle: '父爱的魔法',
      performer: '张小明',
      lyricist: '张小明',
      composer: '张小明',
      lyrics: '一双粗糙的手\n托起了我的整个世界...',
      styleDesc: '暖心流行 warm pop',
      albumName: '父爱的魔法',
      albumArtist: '张小明',
    },
    audioUrl: 'demo.wav',
    status: 'reviewed',
    score: 86,
    submittedAt: '2026-01-25 14:30',
  },
  {
    id: 2,
    assignmentId: 1,
    userId: 3,
    data: {
      aiTool: ['Suno'],
      songTitle: '虚假客户',
      performer: '王强',
      lyricist: '王强',
      composer: '王强',
      lyrics: '穿着笔挺的西装\n说着违心的话...',
      styleDesc: '讽刺职场 hip-hop',
      albumName: '虚假客户',
      albumArtist: '王强',
    },
    audioUrl: 'demo2.wav',
    status: 'reviewed',
    score: 81,
    submittedAt: '2026-01-28 10:15',
  },
  {
    id: 3,
    assignmentId: 1,
    userId: 8,
    data: {
      aiTool: ['Suno', '汽水创作实验室'],
      songTitle: '晨光序曲',
      performer: '林志远',
      lyricist: '林志远',
      composer: '林志远',
      lyrics: '第一缕阳光穿过窗帘\n新的一天悄然来临...',
      styleDesc: '轻快流行 upbeat pop',
      albumName: '晨光序曲',
      albumArtist: '林志远',
    },
    audioUrl: 'demo3.wav',
    status: 'pending_review',
    score: null,
    submittedAt: '2026-04-05 09:00',
  },
  {
    id: 5,
    assignmentId: 1,
    userId: 2,
    data: {
      aiTool: ['Suno'],
      songTitle: '雨后彩虹',
      performer: '李芳',
      lyricist: '李芳',
      composer: '李芳',
      lyrics: '雨过天晴的清晨\n一道彩虹挂天边...',
      styleDesc: '明快流行 upbeat pop',
      albumName: '雨后彩虹',
      albumArtist: '李芳',
    },
    audioUrl: 'demo5.wav',
    status: 'pending_review',
    score: null,
    submittedAt: '2026-03-20 11:30',
  },
  {
    id: 6,
    assignmentId: 2,
    userId: 3,
    data: {
      aiTool: ['汽水创作实验室'],
      songTitle: '数字黄昏',
      performer: '王强',
      lyricist: '王强',
      composer: '王强',
      lyrics: '霓虹灯下的余晖\n数字化的黄昏...',
      styleDesc: '赛博朋克 synthwave',
      albumName: '数字黄昏',
      albumArtist: '王强',
    },
    audioUrl: 'demo6.wav',
    status: 'pending_review',
    score: null,
    submittedAt: '2026-04-01 15:00',
  },
  {
    id: 4,
    assignmentId: 3,
    userId: 4,
    data: {
      aiTool: ['Suno'],
      songTitle: '初次尝试',
      performer: '陈雨',
      lyricist: '陈雨',
      composer: '陈雨',
      lyrics: '第一次张开嘴唱歌\n声音在空气中飘荡...',
      styleDesc: '简单流行 simple pop',
      albumName: '初次尝试',
      albumArtist: '陈雨',
    },
    audioUrl: 'demo4.wav',
    status: 'pending_review',
    score: null,
    submittedAt: '2026-04-02 16:00',
  },
  {
    id: 7,
    assignmentId: 2,
    userId: 1,
    data: {
      aiTool: ['Suno'],
      songTitle: '深海之歌',
      performer: '张小明',
      lyricist: '张小明',
      composer: '张小明',
      lyrics: '深海的低鸣\n那是遥远的呼唤...',
      styleDesc: '环境音乐 ambient',
      albumName: '深海之歌',
      albumArtist: '张小明',
    },
    audioUrl: 'demo7.wav',
    status: 'needs_revision',
    score: 65,
    submittedAt: '2026-03-15 16:00',
  },
]

// ═══ Derived data for current user ═══

export const MY_SUBMISSIONS = CREATOR_SUBMISSIONS.filter((s) => s.userId === CURRENT_USER.id)

export const MY_SONGS = MOCK_SONGS.filter((s) => s.userId === CURRENT_USER.id)

// Re-export shared data
export { MOCK_SONGS, MOCK_STUDENTS, MOCK_USER_GROUPS }
