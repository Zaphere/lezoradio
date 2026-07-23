// @deprecated — archived in Phase 1 (2026-07-14). Replaced by backend engine modules and frontend useNowPlaying/useAudioExecutor.
import { useEffect, useRef, useCallback } from 'react';

interface BulletinSyncMessage {
  type: 'bulletin_sync';
  hour: number;
  timestamp: number;
  origin: string;
}

interface UseBulletinSyncOptions {
  stationId: string;
  onRemoteBulletin: (hour: number) => void;
  enabled?: boolean;
}

export function useBulletinSync(options: UseBulletinSyncOptions) {
  const { stationId, onRemoteBulletin, enabled = true } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onBulletinRef = useRef(onRemoteBulletin);
  onBulletinRef.current = onRemoteBulletin;

  useEffect(() => {
    if (!enabled) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.DEV ? 'localhost:3001' : window.location.host;
    const url = `${protocol}//${host}/ws/bulletin`;

    function connect() {
      if (wsRef.current?.readyState === WebSocket.OPEN) return;

      try {
        const ws = new WebSocket(url);

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'ping' }));
        };

        ws.onmessage = (event) => {
          try {
            const msg: BulletinSyncMessage = JSON.parse(event.data);
            if (msg.type === 'bulletin_sync' && msg.origin !== stationId) {
              onBulletinRef.current(msg.hour);
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          reconnectRef.current = setTimeout(connect, 30000);
        };

        ws.onerror = () => {
          ws.close();
        };

        wsRef.current = ws;
      } catch {
        reconnectRef.current = setTimeout(connect, 30000);
      }
    }

    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [stationId, enabled]);

  const broadcastBulletin = useCallback((hour: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'bulletin_triggered',
        hour,
        stationId,
        timestamp: Date.now(),
      }));
    }
  }, [stationId]);

  return { broadcastBulletin };
}
