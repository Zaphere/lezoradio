-- =============================================================================
-- Migration 012: events trigger for pg_notify
-- =============================================================================
-- PostgreSQL trigger that fires pg_notify when new events are inserted.
-- The radio engine listens for this notification to react to new content
-- without polling.
--
-- Module: EventListener (backend)
-- =============================================================================

-- Trigger function
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

-- Trigger on events table
CREATE TRIGGER trg_events_notify_engine
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_engine_new_event();

-- Comments
COMMENT ON FUNCTION notify_engine_new_event() IS 'Fires pg_notify when new events arrive. Engine subscribes to this.';
COMMENT ON TRIGGER trg_events_notify_engine ON events IS 'Notifies radio engine of new content via pg_notify';
