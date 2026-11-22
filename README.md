# Közcan TikTok LIVE bridge (free connector)

This version replaces `tiktok-live-connector` / EulerStream with `piratetok-live-js`, which documents a direct TikTok WebSocket connection without API keys or a signing server. It is unofficial and may stop working if TikTok changes its protocol.

## Render settings
- Runtime: Node
- Node version: 22.19 or newer (declared in `package.json`)
- Build command: `npm install`
- Start command: `npm start`
- Environment variable: `TIKTOK_USERNAME=oguzmaverick`

## Endpoints
- `/health` reports bridge status.
- `/ws` broadcasts `bridge_status`, `kozcan_tiktok_chat`, `kozcan_tiktok_join`, and `kozcan_tiktok_gift` events.

Chat comments containing a single number from 1 to 20 are forwarded as lane join requests. Gifts are normalized to `rose`, `bouquet`, or `doctor` for the Közcan game.

No TikTok password, session cookie, or verification code is required.
