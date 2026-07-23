-- =============================================================================
-- Migration 009: normalizer_config
-- =============================================================================
-- Content normalizer settings: max lengths, default values, detection
-- thresholds, validation rules. Replaces hardcoded values in normalizers
-- and validators.
--
-- Module: ContentNormalizer, Provider Framework
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS normalizer_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Scope
  provider TEXT NOT NULL,             -- 'lezotraffic', 'rss', 'global'
  config_key TEXT NOT NULL,           -- e.g., 'summary_max_length', 'default_country'
  config_value JSONB NOT NULL,        -- The value (number, string, array, object)

  description TEXT,                   -- Human-readable description
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(provider, config_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_normalizer_config_provider ON normalizer_config(provider);
CREATE INDEX IF NOT EXISTS idx_normalizer_config_lookup ON normalizer_config(provider, config_key);

-- RLS
ALTER TABLE normalizer_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "normalizer_config_service_role"
  ON normalizer_config FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE normalizer_config IS 'Key-value configuration for content normalizers and validators.';
COMMENT ON COLUMN normalizer_config.provider IS 'Provider scope: lezotraffic, rss, or global';
COMMENT ON COLUMN normalizer_config.config_key IS 'Configuration key (e.g., summary_max_length)';
COMMENT ON COLUMN normalizer_config.config_value IS 'JSONB value (number, string, array, or object)';
