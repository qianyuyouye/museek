-- Theme 9: CmsContent 新增富字段
-- 幂等可重跑；在 Theme 9+ 首次部署时执行

-- sections：JSON，课程/文章大纲
ALTER TABLE cms_contents
  ADD COLUMN IF NOT EXISTS sections JSON NULL AFTER video_url;

-- duration：视频时长 / 文章阅读时间
ALTER TABLE cms_contents
  ADD COLUMN IF NOT EXISTS duration VARCHAR(50) NULL AFTER sections;

-- level：难度级别
ALTER TABLE cms_contents
  ADD COLUMN IF NOT EXISTS level VARCHAR(20) NULL AFTER duration;

-- author：作者/讲师
ALTER TABLE cms_contents
  ADD COLUMN IF NOT EXISTS author VARCHAR(100) NULL AFTER level;

-- tags：逗号分隔标签
ALTER TABLE cms_contents
  ADD COLUMN IF NOT EXISTS tags VARCHAR(500) NULL AFTER author;

-- summary：摘要，列表展示用
ALTER TABLE cms_contents
  ADD COLUMN IF NOT EXISTS summary VARCHAR(500) NULL AFTER tags;
