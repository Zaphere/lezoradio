-- =============================================================================
-- Migration 003: Indexes
-- =============================================================================

-- events
CREATE INDEX IF NOT EXISTS idx_events_provider ON events(provider);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_priority ON events(priority);
CREATE INDEX IF NOT EXISTS idx_events_city ON events(city);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_provider_record_id ON events(provider, provider_record_id);
CREATE INDEX IF NOT EXISTS idx_events_language ON events(language);
CREATE INDEX IF NOT EXISTS idx_events_provider_hash ON events(provider_hash);

-- news_items
CREATE INDEX IF NOT EXISTS idx_news_items_language ON news_items(language);
CREATE INDEX IF NOT EXISTS idx_news_items_published_at ON news_items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_items_category ON news_items(category);
CREATE INDEX IF NOT EXISTS idx_news_items_url ON news_items(url);
CREATE INDEX IF NOT EXISTS idx_news_items_feed_id ON news_items(feed_id);
CREATE INDEX IF NOT EXISTS idx_news_items_ingested_at ON news_items(ingested_at DESC);

-- radio_scripts
CREATE INDEX IF NOT EXISTS idx_radio_scripts_news_item_id ON radio_scripts(news_item_id);

-- provider configs
CREATE INDEX IF NOT EXISTS idx_provider_configs_provider ON provider_configs(provider);
CREATE INDEX IF NOT EXISTS idx_provider_configs_enabled ON provider_configs(enabled);

-- provider sync logs
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_provider ON provider_sync_logs(provider);
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_endpoint ON provider_sync_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_created_at ON provider_sync_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_status ON provider_sync_logs(status);

-- ingestion logs
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_created_at ON ingestion_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_status ON ingestion_logs(status);

-- station_voices
CREATE INDEX IF NOT EXISTS idx_station_voices_station_id ON station_voices(station_id);
CREATE INDEX IF NOT EXISTS idx_station_voices_language ON station_voices(language);

-- station_schedules
CREATE INDEX IF NOT EXISTS idx_station_schedules_station_id ON station_schedules(station_id);
CREATE INDEX IF NOT EXISTS idx_station_schedules_event_type ON station_schedules(event_type);

-- station_analytics
CREATE INDEX IF NOT EXISTS idx_station_analytics_station_id ON station_analytics(station_id);
CREATE INDEX IF NOT EXISTS idx_station_analytics_metric_name ON station_analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_station_analytics_recorded_at ON station_analytics(recorded_at DESC);

-- music
CREATE INDEX IF NOT EXISTS idx_music_tracks_genre ON music_tracks(genre);
CREATE INDEX IF NOT EXISTS idx_music_tracks_language ON music_tracks(language);
CREATE INDEX IF NOT EXISTS idx_music_tracks_mood ON music_tracks(mood);
CREATE INDEX IF NOT EXISTS idx_music_tracks_available ON music_tracks(is_available);
CREATE INDEX IF NOT EXISTS idx_music_playlists_station_id ON music_playlists(station_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id ON playlist_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_music_play_history_station_id ON music_play_history(station_id);
CREATE INDEX IF NOT EXISTS idx_music_play_history_track_id ON music_play_history(track_id);
CREATE INDEX IF NOT EXISTS idx_music_play_history_played_at ON music_play_history(played_at DESC);

-- feature flags
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_flag_id ON feature_flag_overrides(flag_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_overrides_station_id ON feature_flag_overrides(station_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_log_flag_id ON feature_flag_log(flag_id);
CREATE INDEX IF NOT EXISTS idx_feature_flag_log_evaluated_at ON feature_flag_log(evaluated_at DESC);

-- translation cache
CREATE INDEX IF NOT EXISTS idx_translation_cache_hash ON translation_cache(text_hash);
CREATE INDEX IF NOT EXISTS idx_translation_cache_languages ON translation_cache(source_language, target_language);
CREATE INDEX IF NOT EXISTS idx_translation_cache_expires ON translation_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_language_detection_cache_hash ON language_detection_cache(content_hash);
CREATE INDEX IF NOT EXISTS idx_language_detection_cache_expires ON language_detection_cache(expires_at);

-- prompt templates
CREATE INDEX IF NOT EXISTS idx_prompt_templates_station_id ON prompt_templates(station_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_prompt_type ON prompt_templates(prompt_type);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_language ON prompt_templates(language);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_template_history_template_id ON prompt_template_history(template_id);

-- v3 engine indexes
CREATE INDEX IF NOT EXISTS idx_radio_station_state_channel ON radio_station_state(channel_id);
CREATE INDEX IF NOT EXISTS idx_radio_station_state_station ON radio_station_state(station_id);
CREATE INDEX IF NOT EXISTS idx_radio_station_state_version ON radio_station_state(channel_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_station_channels_station ON station_channels(station_id);
CREATE INDEX IF NOT EXISTS idx_station_channels_active ON station_channels(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_station_channels_language ON station_channels(language);
CREATE INDEX IF NOT EXISTS idx_queue_played_channel ON queue_played_items(channel_id);
CREATE INDEX IF NOT EXISTS idx_queue_played_station ON queue_played_items(station_id);
CREATE INDEX IF NOT EXISTS idx_queue_played_item ON queue_played_items(item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_queue_played_at ON queue_played_items(channel_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_queue_played_expires ON queue_played_items(channel_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_queue_played_lookup ON queue_played_items(channel_id, item_type, item_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_tts_cache_hash ON tts_audio_cache(text_hash);
CREATE INDEX IF NOT EXISTS idx_tts_cache_voice ON tts_audio_cache(voice_id);
CREATE INDEX IF NOT EXISTS idx_tts_cache_expires ON tts_audio_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_tts_cache_lookup ON tts_audio_cache(text_hash, voice_id, language);
CREATE INDEX IF NOT EXISTS idx_content_templates_type ON content_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_content_templates_language ON content_templates(language);
CREATE INDEX IF NOT EXISTS idx_content_templates_station ON content_templates(station_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_channel ON content_templates(channel_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_active ON content_templates(template_type, language, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_audio_config_channel ON audio_config(channel_id);
CREATE INDEX IF NOT EXISTS idx_audio_config_station ON audio_config(station_id);
CREATE INDEX IF NOT EXISTS idx_engine_config_channel ON engine_config(channel_id);
CREATE INDEX IF NOT EXISTS idx_engine_config_station ON engine_config(station_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_type ON provider_taxonomy(taxonomy_type);
CREATE INDEX IF NOT EXISTS idx_taxonomy_provider ON provider_taxonomy(provider);
CREATE INDEX IF NOT EXISTS idx_taxonomy_lookup ON provider_taxonomy(taxonomy_type, provider, source_key);
CREATE INDEX IF NOT EXISTS idx_normalizer_config_provider ON normalizer_config(provider);
CREATE INDEX IF NOT EXISTS idx_normalizer_config_lookup ON normalizer_config(provider, config_key);
CREATE INDEX IF NOT EXISTS idx_playback_history_channel ON playback_history(channel_id);
CREATE INDEX IF NOT EXISTS idx_playback_history_station ON playback_history(station_id);
CREATE INDEX IF NOT EXISTS idx_playback_history_started ON playback_history(channel_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_playback_history_type ON playback_history(segment_type);
CREATE INDEX IF NOT EXISTS idx_playback_history_source ON playback_history(source_table, segment_id);
CREATE INDEX IF NOT EXISTS idx_entertainment_tracks_active ON entertainment_tracks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_entertainment_tracks_channel ON entertainment_tracks(channel_id);
CREATE INDEX IF NOT EXISTS idx_entertainment_tracks_mood ON entertainment_tracks(mood);
