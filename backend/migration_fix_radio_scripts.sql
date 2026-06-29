-- Fix missing columns in radio_scripts
ALTER TABLE radio_scripts ADD COLUMN IF NOT EXISTS news_item_id UUID REFERENCES news_items(id);
ALTER TABLE radio_scripts ADD COLUMN IF NOT EXISTS script_text TEXT;
ALTER TABLE radio_scripts ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'unknown';
ALTER TABLE radio_scripts ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE radio_scripts ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false;
ALTER TABLE radio_scripts ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'news';

-- Fix missing/constraint columns in other tables
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'unknown';
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'rss';
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE feeds ADD COLUMN IF NOT EXISTS last_fetched_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE feeds ALTER COLUMN type SET DEFAULT 'rss';

ALTER TABLE news_items ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'unknown';
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
ALTER TABLE news_items ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT false;

ALTER TABLE alerts ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'unknown';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium';

ALTER TABLE broadcast_queue ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'unknown';
ALTER TABLE broadcast_queue ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';
