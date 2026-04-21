-- Theme 5: audioUrl/coverUrl 语义从 URL 改为 key，剥离前导 '/'
-- 幂等可重跑

UPDATE platform_songs
  SET audio_url = TRIM(LEADING '/' FROM audio_url)
  WHERE audio_url LIKE '/%';

UPDATE platform_songs
  SET cover_url = TRIM(LEADING '/' FROM cover_url)
  WHERE cover_url LIKE '/%';
