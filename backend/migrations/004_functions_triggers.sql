-- =============================================================================
-- Migration 004: Functions and Triggers
-- =============================================================================

-- pg_notify trigger for new events
CREATE OR REPLACE FUNCTION notify_engine_new_event()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('new_event', json_build_object(
    'id', NEW.id,
    'provider', NEW.provider,
    'category', NEW.category,
    'priority', NEW.priority,
    'channel_id', NEW.metadata->>'channel_id'
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_notify_engine ON events;
CREATE TRIGGER trg_events_notify_engine
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_engine_new_event();

-- Translation cache cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM translation_cache WHERE expires_at < now();
  DELETE FROM language_detection_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;
