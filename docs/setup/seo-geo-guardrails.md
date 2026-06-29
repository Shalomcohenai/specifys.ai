# SEO & GEO Guardrails

Operational rules for indexable pages on Specifys.ai. Follow these on every new public page or article.

## 1. Zero JS dependency for indexable content

Public content (guides, articles, marketing pages, comparisons) must be available as **native HTML at first response**.

- Do **not** ship indexable pages whose only body text is `Loading article...` or empty shells filled by client-side API calls.
- Automated articles must be written to `_posts/YYYY-MM-DD-slug.md` (see [jekyll-post-writer.js](../../backend/server/jekyll-post-writer.js)) so Jekyll builds static permalinks.
- `pages/article.html?slug=` remains for legacy redirects only; canonical URLs are `/YYYY/MM/DD/slug/`.

## 2. The Golden Sync Triad

Every **new indexable page** must appear in all three:

| Layer | Location |
|-------|----------|
| Sitemap | Auto via [sitemap-generator.js](../../backend/server/sitemap-generator.js) — add static paths to `buildStaticUrls()` |
| AI index | [llms.txt](../../llms.txt) — markdown link with one-line context |
| Discovery | [_includes/footer.html](../../_includes/footer.html) or a linked hub (e.g. for-ai-assistants) |

## 3. Noindex vs sitemap

**Never** add a URL to `buildStaticUrls()` if the page front matter includes:

```yaml
robots: noindex, follow
```

Examples (must stay out of sitemap): `auth`, `profile`, `spec-viewer`, `planning`, `demo-spec`, `terms`, `privacy`, `academy/category`, `academy/guide`, `dynamic-post`.

## 4. Article publishing checklist

When publishing via automation or admin:

1. Save to Firestore `articles` (status: `published`).
2. Write Jekyll post → `_posts/YYYY-MM-DD-slug.md` (automation does this via [articles-automation.js](../../backend/server/articles-automation.js)).
3. Set on Firestore doc: `jekyll_permalink`, `jekyll_post_path`.
4. Ensure `_redirects` contains: `/article.html?slug=SLUG  /YYYY/MM/DD/slug/  301` (backfill script maintains the block).
5. Regenerate `sitemap.xml` (automation triggers this; or run `node backend/scripts/generate-sitemap.js`).

### Required Jekyll front matter (automation)

```yaml
---
layout: post
title: "SEO title (50–60 chars)"
description: "Meta description (~160 chars)"
date: YYYY-MM-DD
tags:
  - tag-one
author: "Specifys.ai Team"
canonical_url: https://specifys-ai.com/YYYY/MM/DD/slug/
source: automation
---
```

Body: `content_markdown` only — **no H1** in body (title is the page H1).

## 5. New static page PR checklist

- [ ] Unique `title` and `description` in front matter
- [ ] `robots` not set to `noindex` (unless intentional private page)
- [ ] Entry in `buildStaticUrls()` if indexable
- [ ] Link in `llms.txt`
- [ ] Link in footer or documented hub
- [ ] 300+ words of semantic prose on core marketing pages
- [ ] JSON-LD where applicable (compare, glossary, FAQ patterns exist)

## 7. Academy static guides

Indexable academy content lives in `_guides/*.md` (Jekyll collection, layout `guide`).

- Permalink: `/academy/guides/:name/`
- Backfill: `node backend/scripts/backfill-academy-to-jekyll.js`
- Legacy `/academy/guide.html?guide=` stays `noindex`; redirects to static URL when `jekyll_slug` is set.
- Add new guides to `llms.txt` and regenerate sitemap after backfill.

## 6. Environment & verification

| Variable | Purpose |
|----------|---------|
| `GITHUB_REPO` | `owner/repo` for committing `_posts/` from Render |
| `GITHUB_TOKEN` | PAT with `contents:write` (existing Render secret) |
| `GITHUB_BRANCH` | Default `main` |
| `search_console_verification` in `_config.yml` | Google Search Console HTML tag token |
| `GSC_VERIFICATION_TOKEN` | Optional CI secret to inject at build time |
| `INDEXNOW_KEY` | Bing/IndexNow ping after sitemap updates (`specifysai-indexnow-key`) |

## 7. robots.txt

- Do **not** reintroduce `Crawl-delay` (Bing throttles; Google ignores).
- Keep explicit `Allow: /` for AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.).

## 8. Backfill & maintenance scripts

```bash
# One-time or repair: Firestore → _posts/ + _redirects + sitemap
node backend/scripts/backfill-articles-to-jekyll.js

# Sitemap only
node backend/scripts/generate-sitemap.js
```

## Related docs

- [SEO-GEO-AUDIT-REPORT.txt](./SEO-GEO-AUDIT-REPORT.txt) — site audit snapshot
- [seo.md](./seo.md) — legacy on-page metadata plan
