-- =============================================================================
-- Migration 005: content_templates
-- =============================================================================
-- Stores all text templates used in broadcast: transitions, teasers, station
-- IDs, bridge intros, commentary, bulletin scripts, etc.
-- Replaces hardcoded arrays in lib/types.ts, broadcastFlowSupervisor.ts.
--
-- Templates support {station}, {time}, {date} placeholders.
--
-- Module: ContentNormalizer, EventScheduler, PlaybackController
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS content_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Classification
  template_type TEXT NOT NULL CHECK (template_type IN (
    'transition',           -- Between-story transitions
    'coming_up_teaser',     -- Teaser before upcoming stories
    'station_id',           -- Station identification voiceover
    'bridge_intro',         -- Music bridge introduction
    'bridge_outro',         -- Music bridge conclusion
    'commentary',           -- Post-entertainment-track commentary
    'intro_before_track',   -- Pre-entertainment-track intro
    'entertainment_open',   -- Entertainment segment opening
    'entertainment_close',  -- Entertainment segment closing
    'french_bulletin_intro', -- French bulletin opening
    'french_bulletin_outro', -- French bulletin closing
    'time_announcement',    -- Time-of-day announcement
    'fallback_message',     -- When no content available
    'alert_banner',         -- Emergency alert banner
    'bfs_transition'        -- Broadcast flow supervisor transitions
  )),

  -- Scoping
  language TEXT NOT NULL DEFAULT 'fr',
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,  -- NULL = global
  channel_id TEXT,                                             -- NULL = all channels

  -- Content
  text_content TEXT NOT NULL,         -- Template text with {placeholders}
  category TEXT,                      -- For script templates: 'news', 'traffic', etc.
  priority_level TEXT CHECK (priority_level IN ('critical', 'high', 'medium', 'low')),

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_content_templates_type ON content_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_content_templates_language ON content_templates(language);
CREATE INDEX IF NOT EXISTS idx_content_templates_station ON content_templates(station_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_channel ON content_templates(channel_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_active ON content_templates(template_type, language, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_templates_select_active"
  ON content_templates FOR SELECT
  USING (is_active = true);

CREATE POLICY "content_templates_service_role"
  ON content_templates FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE content_templates IS 'All text templates for broadcast (transitions, teasers, station IDs, bulletins, etc.)';
COMMENT ON COLUMN content_templates.template_type IS 'Category of template: transition, station_id, bridge_intro, etc.';
COMMENT ON COLUMN content_templates.channel_id IS 'NULL = applies to all channels; set to restrict to specific channel';
COMMENT ON COLUMN content_templates.text_content IS 'Template text. Supports {station}, {time}, {date} placeholders.';
