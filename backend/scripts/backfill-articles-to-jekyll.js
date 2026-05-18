#!/usr/bin/env node
/**
 * Backfill published Firestore articles into Jekyll _posts/ and _redirects.
 *
 * Usage (from repo root):
 *   node backend/scripts/backfill-articles-to-jekyll.js
 *   node backend/scripts/backfill-articles-to-jekyll.js --dry-run
 *
 * Requires: Firebase credentials (backend/firebase-service-account.json or env).
 * Optional: GITHUB_REPO + GITHUB_TOKEN to commit via API instead of local files.
 */

const path = require('path');
const fs = require('fs');
const { db, admin } = require('../server/firebase-admin');
const {
  writeJekyllPostForArticle,
  buildRedirectLine,
  getGitHubConfig,
  ROOT_DIR
} = require('../server/jekyll-post-writer');
const { generateAndSaveSitemap } = require('../server/sitemap-generator');

const ARTICLES_COLLECTION = 'articles';
const REDIRECTS_PATH = path.join(ROOT_DIR, '_redirects');
const REDIRECT_MARKER_START = '# Article slug redirects (automation backfill)';
const REDIRECT_MARKER_END = '# End article slug redirects';

function parseArgs() {
  return { dryRun: process.argv.includes('--dry-run') };
}

function convertTimestamp(timestamp) {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp && typeof timestamp.toDate === 'function') {
    try {
      return timestamp.toDate();
    } catch (e) {
      return null;
    }
  }
  if (timestamp && typeof timestamp === 'object' && timestamp.seconds !== undefined) {
    return new Date(timestamp.seconds * 1000);
  }
  return null;
}

function upsertRedirectBlock(newLines) {
  let content = '';
  if (fs.existsSync(REDIRECTS_PATH)) {
    content = fs.readFileSync(REDIRECTS_PATH, 'utf8');
  }

  const startIdx = content.indexOf(REDIRECT_MARKER_START);
  const endIdx = content.indexOf(REDIRECT_MARKER_END);

  const block = [
    REDIRECT_MARKER_START,
    ...newLines.sort(),
    REDIRECT_MARKER_END,
    ''
  ].join('\n');

  if (startIdx !== -1 && endIdx !== -1) {
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx + REDIRECT_MARKER_END.length);
    content = `${before.trimEnd()}\n\n${block}${after.startsWith('\n') ? after : `\n${after}`}`;
  } else {
    content = `${content.trimEnd()}\n\n${block}`;
  }

  fs.writeFileSync(REDIRECTS_PATH, content.trimEnd() + '\n', 'utf8');
}

async function main() {
  const { dryRun } = parseArgs();
  const useGitHub = Boolean(getGitHubConfig());
  const preferFilesystem = !useGitHub;

  console.log(`Backfill articles → Jekyll _posts/ (dryRun=${dryRun}, github=${useGitHub})`);

  const snapshot = await db.collection(ARTICLES_COLLECTION)
    .where('status', '==', 'published')
    .get();

  console.log(`Found ${snapshot.size} published articles`);

  const redirectLines = new Set();
  let written = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const slug = data.slug;
    if (!slug) {
      skipped++;
      continue;
    }

    const postPath = data.jekyll_post_path;
    if (postPath && fs.existsSync(path.join(ROOT_DIR, postPath))) {
      if (data.jekyll_permalink) {
        redirectLines.add(buildRedirectLine(slug, data.jekyll_permalink));
      }
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] would write: ${slug}`);
      written++;
      continue;
    }

    try {
      const result = await writeJekyllPostForArticle(
        { ...data, slug },
        { preferFilesystem, commitMessage: `Backfill Jekyll post: ${slug}` }
      );

      await doc.ref.update({
        jekyll_permalink: result.jekyll_permalink,
        jekyll_post_path: result.jekyll_post_path
      });

      redirectLines.add(result.redirect_line);
      written++;
      console.log(`OK ${slug} → ${result.jekyll_permalink}`);
    } catch (err) {
      errors++;
      console.error(`FAIL ${slug}:`, err.message);
    }
  }

  if (!dryRun && redirectLines.size > 0) {
    upsertRedirectBlock([...redirectLines]);
    console.log(`Updated _redirects with ${redirectLines.size} article redirect(s)`);
  }

  if (!dryRun) {
    try {
      const sitemapResult = await generateAndSaveSitemap();
      console.log(`Sitemap regenerated: ${sitemapResult.urlCount} URLs → ${sitemapResult.path}`);
    } catch (err) {
      console.warn('Sitemap regeneration failed:', err.message);
    }
  }

  console.log('\nSummary:', { written, skipped, errors, dryRun });
  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
