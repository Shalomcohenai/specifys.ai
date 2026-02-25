# Brain Dump

Brain Dump is a spec-scoped chat in the spec viewer that lets users ask how to add features or make changes (e.g. "How do I add an image upload to my site?") and get answers based on their **current specification**. Each assistant reply can be turned into a **personal prompt**—a single copy-paste ready prompt for Cursor or another AI IDE to implement that feature in context.

## Access

- **Where**: Spec viewer page only (tab "Brain Dump"), for the spec currently being viewed.
- **Who**: Any logged-in user (not Pro-only). Requires authentication.
- **Scope**: One Brain Dump thread per spec; history is stored as part of the spec in Firestore.

## Flow

1. User opens the Brain Dump tab and asks a question (e.g. how to add a feature).
2. The backend uses the same spec context as the main AI Chat (same assistant/vector store, separate thread) and returns an answer.
3. Each assistant message shows a button: **"Create personal prompt for this change/feature"**.
4. Clicking it calls the API to generate a single, copy-paste ready prompt (including spec context). The user can copy it and use it in Cursor/IDE.

## Rate limit

- **Personal prompt**: Up to **5 per day per user** (not per spec).
- When the limit is reached, the API returns `429` and the UI shows: "Limit reached (5 personal prompts per day). Try again tomorrow."
- The limit is tracked in Firestore (`brainDumpRateLimit/{userId}`) and resets at midnight (date-based).

## API

See [API – Brain Dump](../architecture/API.md#brain-dump-apibrain-dump) for endpoints and request/response shapes.
