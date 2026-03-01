# Local Development – Frontend with Design

## View the site with full styling (HTML + CSS + layout)

From the project root:

```bash
bundle install   # once
npm run dev:site
```

Then open in the browser: **http://localhost:4000**

This runs Jekyll and serves the built site from `_site`, so you get the full layout and CSS.

---

## Ports summary

| Port   | Command           | Purpose |
|--------|-------------------|--------|
| **4000** | `npm run dev:site` | **Site with design** – use this to view the frontend. |
| 5173   | `npm run dev:vite` | Vite dev server (JS bundles only). Do **not** use for viewing the full site – pages will appear as plain text without styling. |
| 10000  | `npm run dev` (from backend) | Backend API server. |

---

## If you see only text and no design

You are probably on **http://localhost:5173**. Switch to **http://localhost:4000** and run:

```bash
npm run dev:site
```

The site is built with Jekyll; Vite (5173) does not run Jekyll, so it serves raw templates without layout or CSS.
