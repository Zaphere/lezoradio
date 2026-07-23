// backend/engine/eventListener.js
// Subscribes to new events via Supabase Realtime (replaces pg_notify polling).

import { supabase } from '../supabaseClient.js';

let channel = null;
let onEventCallback = null;

/**
 * Start listening for new events via Supabase Realtime.
 * @param {function} onEvent - Callback invoked with each new event row.
 */
export function startEventListener(onEvent) {
  onEventCallback = onEvent;

  channel = supabase
    .channel('engine-events')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'events' },
      (payload) => {
        console.log(`[${new Date().toISOString()}] [eventListener] New event:`, payload.new?.id);
        if (onEventCallback && payload.new) {
          onEventCallback(payload.new);
        }
      },
    )
    .subscribe((status) => {
      console.log(`[${new Date().toISOString()}] [eventListener] Subscription status:`, status);
    });

  console.log(`[${new Date().toISOString()}] [eventListener] Listening for new events`);
}

/**
 * Stop listening for events.
 */
export function stopEventListener() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  onEventCallback = null;
  console.log(`[${new Date().toISOString()}] [eventListener] Stopped`);
}
