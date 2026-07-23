// backend/engine/radioWsServer.js
// WebSocket server for broadcasting NowPlaying state to connected clients.

import { WebSocketServer } from 'ws';

let wss = null;

/**
 * Start the radio WebSocket server on the existing HTTP server.
 * @param {import('http').Server} server - Existing HTTP server instance
 * @param {string} path - WebSocket path (default: '/ws/radio')
 */
export function startRadioWsServer(server, path = '/ws/radio') {
  wss = new WebSocketServer({ server, path });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[${new Date().toISOString()}] [radioWs] Client connected from ${clientIp}`);

    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        } else if (msg.type === 'subscribe') {
          // Client subscribes to specific channel updates
          ws.subscribedChannels = msg.channels || ['all'];
        }
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      console.log(`[${new Date().toISOString()}] [radioWs] Client disconnected`);
    });

    // Send initial state immediately
    ws.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }));
  });

  // Heartbeat to detect dead connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));

  console.log(`[${new Date().toISOString()}] [radioWs] WebSocket server started on ${path}`);
  return wss;
}

/**
 * Broadcast NowPlaying state to all subscribed clients.
 * @param {string} channelId - Channel identifier
 * @param {object} state - NowPlaying state object
 */
export function broadcastState(channelId, state) {
  if (!wss) return;

  const message = JSON.stringify({
    type: 'state_update',
    channel_id: channelId,
    state,
    timestamp: Date.now(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState !== 1) return; // WebSocket.OPEN

    // Check if client is subscribed to this channel or 'all'
    const subs = client.subscribedChannels || ['all'];
    if (subs.includes('all') || subs.includes(channelId)) {
      client.send(message);
    }
  });
}

/**
 * Broadcast a bulletin trigger to all clients.
 */
export function broadcastBulletin(bulletinData) {
  if (!wss) return;

  const message = JSON.stringify({
    type: 'bulletin_triggered',
    ...bulletinData,
    timestamp: Date.now(),
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

/**
 * Stop the WebSocket server.
 */
export function stopRadioWsServer() {
  if (wss) {
    wss.close();
    wss = null;
  }
}
