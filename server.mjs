import express from 'express';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const PORT = Number(process.env.PORT || 3000);
const TIKTOK_USERNAME = (process.env.TIKTOK_USERNAME || 'oguzmaverick').replace(/^@/, '');
let liveConnection = null;
let liveStatus = 'starting';
let lastError = '';

app.get('/', (_req, res) => res.json({ service: 'Kozcan TikTok LIVE bridge', status: liveStatus, username: TIKTOK_USERNAME, clients: wss.clients.size }));
app.get('/health', (_req, res) => res.json({ ok: true, status: liveStatus, username: TIKTOK_USERNAME, error: lastError || null }));

function broadcast(payload) {
  const message = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  }
}

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'bridge_status', status: liveStatus, username: TIKTOK_USERNAME }));
});

async function connectTikTok() {
  liveStatus = 'connecting';
  broadcast({ type: 'bridge_status', status: liveStatus, username: TIKTOK_USERNAME });
  liveConnection = new TikTokLiveConnection(TIKTOK_USERNAME, { enableExtendedGiftInfo: true });

  liveConnection.on(ControlEvent.CONNECTED, (state) => {
    liveStatus = 'connected'; lastError = '';
    broadcast({ type: 'bridge_status', status: liveStatus, username: TIKTOK_USERNAME, roomId: state?.roomId || null });
    console.log(`Connected to @${TIKTOK_USERNAME} LIVE`);
  });
  liveConnection.on(ControlEvent.DISCONNECTED, () => {
    liveStatus = 'disconnected';
    broadcast({ type: 'bridge_status', status: liveStatus, username: TIKTOK_USERNAME });
  });
  liveConnection.on(ControlEvent.ERROR, (err) => {
    lastError = String(err?.message || err);
    liveStatus = 'error';
    console.error('TikTok connection error:', lastError);
    broadcast({ type: 'bridge_status', status: liveStatus, error: lastError });
  });

  liveConnection.on(WebcastEvent.CHAT, (data) => {
    const username = data?.user?.uniqueId;
    const comment = String(data?.comment || '').trim();
    if (!username || !comment) return;
    broadcast({ type: 'kozcan_tiktok_chat', username, nickname: data?.user?.nickname || username, comment });
    // A bare number from 1 to 20 is treated as a request to enter that lane.
    const match = comment.match(/^\s*(?:#|no\s*)?(\d{1,2})\s*$/i);
    if (match) {
      const lane = Number(match[1]);
      if (lane >= 1 && lane <= 20) broadcast({ type: 'kozcan_tiktok_join', username, lane });
    }
  });

  liveConnection.on(WebcastEvent.GIFT, (data) => {
    // Streak gifts can emit several updates. Apply only the final update to avoid double-counting.
    if (data?.giftType === 1 && data?.repeatEnd === false) return;
    const username = data?.user?.uniqueId;
    if (!username) return;
    const giftName = data?.extendedGiftInfo?.name || data?.giftDetails?.giftName || data?.giftName || 'Unknown gift';
    const diamondCount = Number(data?.extendedGiftInfo?.diamond_count ?? data?.giftDetails?.diamondCount ?? data?.diamondCount ?? 0);
    const repeatCount = Math.max(1, Number(data?.repeatCount || 1));
    broadcast({
      type: 'kozcan_tiktok_gift', username,
      nickname: data?.user?.nickname || username,
      giftName, giftType: giftName,
      diamondCount, repeatCount,
      giftId: data?.giftId ?? null
    });
    console.log(`Gift @${username}: ${giftName} x${repeatCount}`);
  });

  try {
    await liveConnection.connect();
  } catch (err) {
    lastError = String(err?.message || err);
    liveStatus = 'offline_or_error';
    console.error('Could not connect. Is the TikTok account LIVE?', lastError);
    broadcast({ type: 'bridge_status', status: liveStatus, error: lastError });
    // Retry after a short delay; the account may not have started its LIVE yet.
    setTimeout(connectTikTok, 15000);
  }
}

server.listen(PORT, () => {
  console.log(`Kozcan bridge listening on ${PORT}; TikTok @${TIKTOK_USERNAME}`);
  connectTikTok();
});
