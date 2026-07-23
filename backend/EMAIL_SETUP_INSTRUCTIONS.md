# Email System Setup (Resend)

## Required environment variables

Add to `backend/.env` (local) and Render Environment (production):

```bash
# Required — transactional send
RESEND_API_KEY=re_your_actual_api_key_here
RESEND_FROM_EMAIL=Specifys-Ai-Team@specifys-ai.com

# Optional — marketing audience sync on signup / admin bulk sync
RESEND_AUDIENCE_ID=aud_xxxxxxxx
# RESEND_SEGMENT_ID is accepted as an alias for the same ID

# Optional — absolute URLs in emails + click tracking redirects
BASE_URL=https://specifys-ai.com
# SITE_URL=https://specifys-ai.com
```

**Notes:**
- `RESEND_FROM_EMAIL` must be on a domain verified in the Resend dashboard.
- Never commit `.env` or real API keys.
- Click tracking uses `GET /api/email/track` (writes `email_clicks`). Successful sends write `email_sent`.

## Verify integration

```bash
cd backend

# Config + SDK response shape only (no send)
node scripts/verify-resend-email.js --dry-run

# Real send + confirm email_sent in Firestore
node scripts/verify-resend-email.js --send --to=you@example.com

# Resend's delivered test inbox (no inbox needed)
node scripts/verify-resend-email.js --send --to=delivered@resend.dev
```

Admin API (when server is running): `POST /api/admin/email/test` with `{ "email": "you@example.com" }`.

## Root cause (fixed Jul 2026)

Resend SDK v3+ returns `{ data: { id }, error }` from `emails.send`. The mailer was reading `result.id` (always `undefined`), so:

1. `email_sent` was never written (`if (result.id)` skipped)
2. Callers got `messageId: undefined` even when Resend accepted the message
3. Resend API errors in the `{ error }` field were not always treated as failures

Fix: `EmailService._send()` unwraps `{ data, error }` into `{ id }` for all send paths.

## Troubleshooting

1. **API key missing:** server log `RESEND_API_KEY not configured` → set env and restart.
2. **401 / restricted key:** send-only keys cannot list domains; sending still works.
3. **422 validation:** check `from` is a verified domain address.
4. **email_sent still empty:** run verify script with `--send`; confirm Firebase Admin credentials.
5. **email_clicks empty:** expected until a user clicks a tracked link from a sent email (`/api/email/track?...`).

## Production (Render)

Dashboard → Environment → set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`, then redeploy/restart.
