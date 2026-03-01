# Brain Dump

Brain Dump is a single-shot flow in the spec viewer: the user describes a feature or change they want (e.g. "How do I add an image upload to my site?" or "Add a develop page that shows sum and average from the check table"), and the system returns a **4-part result** based on the **current specification**. The result is **not saved**—refreshing the page clears it.

## Access

- **Where**: Spec viewer page only (tab "Brain Dump"), for the spec currently being viewed.
- **Who**: Any logged-in user (not Pro-only) can use Generate. **Add to main architecture** is Pro-only.
- **Scope**: One description per run; no conversation history.

## Flow

1. User enters a short description of the feature or change in the text area and clicks **Generate**.
2. The backend (rate limited: 5 per day per user) returns a structured result with:
   - **Plain text**: A short, simple explanation of the change.
   - **Mermaid diagram**: The relevant subsystem only, with the changed part highlighted.
   - **Full development prompt**: A copy-paste ready prompt for Cursor or another AI IDE (with a Copy button).
   - **Add to main architecture** (Pro only): A button that merges the change into the spec’s **overview** and **technical** sections (design is not updated). After applying, the spec is updated and the OpenAI cache is invalidated so Chat/Brain Dump use the new content.

3. The user can copy the prompt and use it elsewhere. If they are Pro and click **Add to main architecture**, the change is written into the spec and the page can refresh spec data.

## What is not saved

- The 4-part result (plain text, diagram, prompt) is **not** stored in Firestore or localStorage. It exists only in the current session and is lost on refresh.
- Applying to spec (Pro) **does** update the spec document (overview + technical).

## Rate limit

- **Generate**: Up to **5 per day per user**.
- When the limit is reached, the API returns `429` and the UI shows a message to try again tomorrow.
- Tracked in Firestore (`brainDumpRateLimit/{userId}`), reset at midnight (date-based).

## API

See [API – Brain Dump](../architecture/API.md#brain-dump-apibrain-dump) for `POST /api/brain-dump/generate` and `POST /api/brain-dump/apply-to-spec`.
