#!/usr/bin/env node
/**
 * Backfill Firestore academy_guides to static _guides/*.md for SEO.
 * Run: node backend/scripts/backfill-academy-to-jekyll.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { db } = require('../server/firebase-admin');
const { writeGuideToFilesystem, slugify } = require('../server/academy-jekyll-writer');
const { generateAndSaveSitemap } = require('../server/sitemap-generator');

async function main() {
  const categoriesSnapshot = await db.collection('academy_categories').get();
  const categoryMap = new Map();
  categoriesSnapshot.docs.forEach((doc) => {
    categoryMap.set(doc.id, doc.data().title || '');
  });

  const guidesSnapshot = await db.collection('academy_guides').get();
  let written = 0;

  for (const doc of guidesSnapshot.docs) {
    const data = doc.data();
    if (!data.title || !data.content) {
      console.warn(`Skipping guide ${doc.id}: missing title or content`);
      continue;
    }

    const slug = data.jekyll_slug || data.slug || slugify(data.title);
    const categoryTitle = categoryMap.get(data.category) || '';

    writeGuideToFilesystem(
      { ...data, slug, jekyll_slug: slug },
      { categoryTitle }
    );

    await doc.ref.update({
      jekyll_slug: slug,
      jekyll_permalink: `https://specifys-ai.com/academy/guides/${slug}/`,
      jekyll_guide_path: `_guides/${slug}.md`
    });

    written += 1;
    console.log(`  ✓ ${data.title} → /academy/guides/${slug}/`);
  }

  const sitemap = await generateAndSaveSitemap();
  console.log(`\nDone. Wrote ${written} guides. Sitemap URLs: ${sitemap.urlCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
