-- AARN v2: Prompt Templates
-- Stores AI director prompt templates per station and language
-- Run this migration in the Supabase SQL editor.

-- Prompt Templates Table
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
  prompt_type TEXT NOT NULL CHECK (prompt_type IN ('news', 'traffic', 'weather', 'entertainment', 'sports', 'bulletin')),
  language TEXT NOT NULL,
  template TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  version INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Prompt Template History Table
-- Tracks template changes for rollback capability
CREATE TABLE IF NOT EXISTS prompt_template_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
  version INT NOT NULL,
  template TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  changed_by TEXT DEFAULT 'system',
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_templates_station_id ON prompt_templates(station_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_prompt_type ON prompt_templates(prompt_type);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_language ON prompt_templates(language);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_template_history_template_id ON prompt_template_history(template_id);

-- Seed default DRC prompt templates
INSERT INTO prompt_templates (station_id, prompt_type, language, template, variables, is_active)
SELECT 
  s.id,
  'news',
  'fr',
  'Tu es un présentateur de radio professionnel pour {{station_name}} à {{city}}, {{country}}. 
   Rédige un bulletin d''actualités concis et engageant basé sur les informations suivantes :
   
   {{content}}
   
   Style : {{style}}
   Durée souhaitée : {{duration_seconds}} secondes
   Inclus une introduction et une conclusion appropriées.',
  '["station_name", "city", "country", "content", "style", "duration_seconds"]',
  true
FROM stations s
WHERE s.country = 'CD'
ON CONFLICT DO NOTHING;

-- Seed Swahili template for Goma/Lubumbashi stations
INSERT INTO prompt_templates (station_id, prompt_type, language, template, variables, is_active)
SELECT 
  s.id,
  'news',
  'sw',
  'Ni mwakilishi wa taarifa za redio kwa {{station_name}} katika {{city}}, {{country}}. 
   Andika taarifa fupi na ya kupendeza kulingana na taarifa zifuatazo :
   
   {{content}}
   
   Mtindo : {{style}}
   Muda unaopendekezwa : {{duration_seconds}} sekunde
   Jumuisha utangulizi na hitimisho lijalo.',
  '["station_name", "city", "country", "content", "style", "duration_seconds"]',
  true
FROM stations s
WHERE s.country = 'CD' AND s.city IN ('Goma', 'Lubumbashi')
ON CONFLICT DO NOTHING;