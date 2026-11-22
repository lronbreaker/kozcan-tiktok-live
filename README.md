# Közcan TikTok LIVE bridge

Node.js 20+ service that listens to the public LIVE for `TIKTOK_USERNAME` and relays chat/gift events to browser clients over WebSocket at `/ws`.

## Environment
- `TIKTOK_USERNAME`: creator username without `@` (default: `oguzmaverick`)
- `PORT`: hosting platform port (default: `3000`)

## Run
```bash
npm install
npm start
```

`GET /health` reports bridge status. WebSocket clients connect to `wss://YOUR-HOST/ws`.

Events sent to browser:
- `kozcan_tiktok_chat`: `{ username, nickname, comment }`
- `kozcan_tiktok_join`: `{ username, lane }` when a comment is only a lane number 1–20
- `kozcan_tiktok_gift`: `{ username, nickname, giftName, giftType, diamondCount, repeatCount, giftId }`
- `bridge_status`: connection status

This uses `tiktok-live-connector`, an unofficial reverse-engineered client. It is not affiliated with TikTok, may stop working if TikTok changes its protocol, and only connects while the creator is LIVE. Do not add TikTok passwords, session cookies, or private credentials to this repository.
