-- =============================================================================
-- Migration 008: provider_taxonomy
-- =============================================================================
-- Classification mappings for providers: incident types, severity maps,
-- category maps, city keywords, region-country mappings.
-- Replaces hardcoded taxonomies in lezotraffic/taxonomy.js, rssNormalizer.js.
--
-- Module: ContentNormalizer, Provider Framework
-- =============================================================================

-- Table
CREATE TABLE IF NOT EXISTS provider_taxonomy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Classification
  taxonomy_type TEXT NOT NULL CHECK (taxonomy_type IN (
    'incident_type',        -- Provider-specific type -> unified category/subcategory
    'severity_map',         -- Severity string -> priority number
    'category_map',         -- Provider category -> unified category
    'subcategory_map',      -- Provider category -> unified subcategory
    'region_country_map',   -- Region string -> country code
    'city_keywords',        -- Text keywords -> city name
    'priority_rules',       -- Conditions -> priority number
    'rss_category_map',     -- RSS category -> unified category
    'rss_subcategory_map'   -- RSS category -> unified subcategory
  )),

  provider TEXT NOT NULL,             -- 'lezotraffic', 'rss', 'global'
  language TEXT DEFAULT 'fr',

  -- Mapping data
  source_key TEXT NOT NULL,           -- Input key (e.g., 'accident_grave', 'high')
  target_value JSONB NOT NULL,        -- Output value (e.g., {"category":"traffic","subcategory":"accident"})

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(taxonomy_type, provider, source_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_taxonomy_type ON provider_taxonomy(taxonomy_type);
CREATE INDEX IF NOT EXISTS idx_taxonomy_provider ON provider_taxonomy(provider);
CREATE INDEX IF NOT EXISTS idx_taxonomy_lookup ON provider_taxonomy(taxonomy_type, provider, source_key);

-- RLS
ALTER TABLE provider_taxonomy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "provider_taxonomy_service_role"
  ON provider_taxonomy FOR ALL
  USING (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE provider_taxonomy IS 'Classification mappings for providers (incident types, severity maps, category maps, etc.)';
COMMENT ON COLUMN provider_taxonomy.taxonomy_type IS 'Type of mapping: incident_type, severity_map, category_map, etc.';
COMMENT ON COLUMN provider_taxonomy.source_key IS 'Input key to look up (e.g., accident_grave, high)';
COMMENT ON COLUMN provider_taxonomy.target_value IS 'JSON output value (e.g., {"category":"traffic","priority":2})';
