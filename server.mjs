import express from 'express';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { TikTokLiveClient, EventType, GiftStreakTracker } from 'piratetok-live-js';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const PORT = Number(process.env.PORT || 3000);
const USERNAME = (process.env.TIKTOK_USERNAME || 'oguzmaverick').replace(/^@/, '');
let status = 'starting';
let lastError = null;
let client = null;
let connectInProgress = false;
const streaks = new GiftStreakTracker();

app.get('/', (_req, res) => res.json({ service: 'Kozcan TikTok LIVE bridge', status, username: USERNAME, websocket: '/ws', clients: wss.clients.size, error: lastError }));
app.get('/health', (_req, res) => res.json({ ok: true, status, username: USERNAME, error: lastError }));

function broadcast(payload) {
  const message = JSON.stringify(payload);
  for (const socket of wss.clients) {
    if (socket.readyState === WebSocket.OPEN) socket.send(message);
  }
}
function setStatus(next, extra = {}) {
  status = next;
  broadcast({ type: 'bridge_status', status, username: USERNAME, error: lastError, ...extra });
  console.log(`[bridge] ${status}${lastError ? `: ${lastError}` : ''}`);
}
wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'bridge_status', status, username: USERNAME, error: lastError }));
});

function giftTypeFromName(name) {
  const n = String(name || '').toLocaleLowerCase('tr-TR');
  if (n.includes('buket') || n.includes('bouquet')) return 'bouquet';
  if (n.includes('heart') || n.includes('hand') || n.includes('elle') || n.includes('kalp')) return 'doctor';
  return 'rose';
}

async function startTikTok() {
  if (connectInProgress) return;
  connectInProgress = true;
  setStatus('connecting');
  try {
    client = new TikTokLiveClient(USERNAME).region('TR').language('tr');
    client.on(EventType.chat, (data) => {
      const username = data?.user?.uniqueId || data?.user?.unique_id;
      const comment = String(data?.content || '').trim();
      if (!username || !comment) return;
      broadcast({ type: 'kozcan_tiktok_chat', username, nickname: data?.user?.nickname || username, comment });
      const match = comment.match(/^\s*(?:#|no\s*)?(\d{1,2})\s*$/i);
      if (match) {
        const lane = Number(match[1]);
        if (lane >= 1 && lane <= 20) broadcast({ type: 'kozcan_tiktok_join', username, lane });
      }
    });
    client.on(EventType.gift, (data) => {
      const username = data?.user?.uniqueId || data?.user?.unique_id;
      if (!username) return;
      const streak = streaks.process(data);
      const repeatCount = Math.max(1, Number(streak?.eventGiftCount ?? data?.repeatCount ?? 1));
      if (repeatCount <= 0) return;
      const giftName = data?.gift?.name || 'Unknown gift';
      const giftType = giftTypeFromName(giftName);
      const diamondCount = Number(data?.gift?.diamondCount ?? 0);
      const payload = {
        type: 'kozcan_tiktok_gift', username,
        nickname: data?.user?.nickname || username,
        giftName, giftType, diamondCount, repeatCount,
        giftId: data?.gift?.id ?? data?.gift?.giftId ?? null
      };
      broadcast(payload);
      console.log(`[gift] @${username}: ${giftName} x${repeatCount} (${diamondCount} diamonds)`);
    });
    client.on('reconnecting', (info) => {
      lastError = info?.error?.message || 'TikTok bağlantısı yeniden deneniyor';
      setStatus('reconnecting');
    });
    client.on('disconnected', () => setStatus('disconnected'));
    client.on('error', (err) => {
      lastError = String(err?.message || err);
      setStatus('error');
      console.error('[TikTok error]', lastError);
    });
    const roomId = await client.connect();
    lastError = null;
    setStatus('connected', { roomId });
    console.log(`[bridge] Connected to @${USERNAME}; room ${roomId}`);
  } catch (err) {
    lastError = String(err?.message || err);
    setStatus('offline_or_error');
    console.error('[TikTok connect failed]', lastError);
    setTimeout(() => { connectInProgress = false; startTikTok(); }, 30000);
  }
}

server.listen(PORT, () => {
  console.log(`[bridge] Listening on ${PORT}; TikTok @${USERNAME}`);
  startTikTok();
});
