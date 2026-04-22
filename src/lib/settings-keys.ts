/** SystemSetting key 常量（纯常量，客户端可安全导入） */
export const SETTING_KEYS = {
  SCORING_WEIGHTS: 'scoring_weights',
  AUTO_ARCHIVE_THRESHOLD: 'auto_archive_threshold',
  REVENUE_RULES: 'revenue_rules',
  REVIEW_TEMPLATES: 'review_templates',
  PLATFORM_CONFIGS: 'platform_configs',
  AI_TOOLS: 'ai_tools',
  GENRES: 'genres',
  AI_CONFIG: 'ai_config',
  STORAGE_CONFIG: 'storage_config',
  SMS_CONFIG: 'sms_config',
  NOTIFICATION_TEMPLATES: 'notification_templates',
  AGENCY_TERMS: 'agency_terms',
  SERVICE_AGREEMENT: 'service_agreement',
  PRIVACY_POLICY: 'privacy_policy',
  INVITE_LINK_DOMAIN: 'invite_link_domain',
} as const

export type SettingKey = typeof SETTING_KEYS[keyof typeof SETTING_KEYS]
