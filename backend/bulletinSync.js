import { WebSocketServer } from 'ws';

let wss = null;

export function startBulletinSyncServer(server) {
  wss = new WebSocketServer({ server, path: '/ws/bulletin' });

  console.log('   Bulletin Sync WS: ws://localhost:{port}/ws/bulletin');

  wss.on('connection', (ws) => {
    console.log('   Bulletin Sync: client connected');

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          return;
        }

        if (msg.type === 'bulletin_triggered') {
          const payload = JSON.stringify({
            type: 'bulletin_sync',
            hour: msg.hour,
            timestamp: Date.now(),
            origin: msg.stationId,
          });
          wss.clients.forEach((client) => {
            if (client.readyState === 1 && client !== ws) {
              client.send(payload);
            }
          });
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      console.log('   Bulletin Sync: client disconnected');
    });
  });

  return wss;
}

export function broadcastBulletinTrigger(hour, stationId) {
  if (!wss) return;
  const payload = JSON.stringify({
    type: 'bulletin_sync',
    hour,
    timestamp: Date.now(),
    origin: stationId,
  });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}
