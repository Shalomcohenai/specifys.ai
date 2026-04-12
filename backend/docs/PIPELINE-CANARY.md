# Pipeline Canary

End-to-end check of spec generation (overview → approve → queued advanced specs), same services as user traffic. Results appear in the admin dashboard and in Firestore collection `pipeline_canary_runs`.

## Environment variables

| Variable | Description |
|----------|-------------|
| `PIPELINE_CANARY_FIREBASE_UID` | Firebase Auth UID that owns canary specs (default in code: service canary UID). |
| `PIPELINE_CANARY_ENABLED` | Set to `true` to run the **scheduled** daily canary. Default: off. |
| `PIPELINE_CANARY_HOUR` | Local hour (0–23) for the scheduled run. Default: `4`. |
| `PIPELINE_CANARY_TIMEZONE` | IANA timezone, e.g. `Asia/Jerusalem`. Falls back to `REPORT_TIMEZONE` or `UTC`. |
| `PIPELINE_CANARY_OVERVIEW_TIMEOUT_MS` | Overview step timeout (default 20 minutes). |
| `PIPELINE_CANARY_QUEUE_TIMEOUT_MS` | Wait for advanced generation (default 60 minutes). |

Canary specs are tagged `pipelineCanary: true` and deleted automatically after `expiresAt` (7 days) by the scheduled job cleanup.

Admin routes share a per-IP rate limit (`rateLimiters.admin` in `security.js`). The limit is set high enough for long canary polls plus other dashboard calls.

## API (admin JWT)

- `GET /api/admin/pipeline-canary/history?days=14`
- `GET /api/admin/pipeline-canary/run/:runId`
- `POST /api/admin/pipeline-canary/run` — optional body `{ "templateIndex": 0 }`

## Templates

Edit `backend/config/pipeline-canary-templates.json` (seven rotating app descriptions).
