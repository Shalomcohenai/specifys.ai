# Render Deployment (Backend / API)

## Architecture

**Render hosts the API only.** The main website (frontend) is served from **https://specifys-ai.com** (e.g. Netlify or another host). Users should use the domain for the site; the Render service URL is for API calls only.

- **Frontend (site):** https://specifys-ai.com  
- **Backend (API):** Render service (see `BACKEND_URL` in `assets/js/config.js`; default `https://specifys-ai-backend.onrender.com`)

The backend does not build or serve the Jekyll `_site` on Render. Build and deploy of the static site are done separately (e.g. via GitHub Actions or your frontend host).

## Render Service

- **Service name:** `specifys-backend`
- **Root directory:** `backend`
- **Build:** `npm install` (no Jekyll build)
- **Start:** `npm start`

## Optional: Redirect non-API requests to the site

If you want requests to the Render URL for pages (e.g. GET `/` or `/blog/`) to redirect to the main site, set in Render Environment:

- `REDIRECT_NON_API_TO_SITE=true`
- `SITE_URL=https://specifys-ai.com` (or your frontend URL)

When enabled, GET requests that are not under `/api/` and do not match a static file will redirect to `SITE_URL` with the same path.
