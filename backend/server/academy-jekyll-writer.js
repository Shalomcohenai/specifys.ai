/**
 * Write academy guides as static Jekyll files (_guides/) for crawlable HTML.
 */

const path = require('path');
const fs = require('fs');
const { logger } = require('./logger');

const ROOT_DIR = path.join(__dirname, '..', '..');
const GUIDES_DIR = path.join(ROOT_DIR, '_guides');
const DEFAULT_BASE_URL = 'https://specifys-ai.com';

function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeYamlString(value) {
  if (value == null) return '""';
  const str = String(value);
  if (/[:#\n\r"'[\]{}>|*&!%@`]/.test(str) || str.trim() !== str) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}

/**
 * @param {object} guideFirebase
 * @param {object} [options]
 * @param {string} [options.categoryTitle]
 * @param {string} [options.baseUrl]
 */
function formatJekyllGuideMarkdown(guideFirebase, options = {}) {
  const baseUrl = options.baseUrl || process.env.SITE_URL || DEFAULT_BASE_URL;
  const slug = guideFirebase.jekyll_slug || guideFirebase.slug || slugify(guideFirebase.title);
  if (!slug) {
    throw new Error('Guide slug is required for Jekyll guide');
  }

  const title = guideFirebase.title || 'Academy Guide';
  const description = guideFirebase.summary || guideFirebase.whatYouLearn || '';
  const level = guideFirebase.level || 'Beginner';
  const categoryTitle = options.categoryTitle || guideFirebase.category_title || '';
  const body = (guideFirebase.content || '').trim();
  const permalink = `${baseUrl}/academy/guides/${slug}/`;

  const frontMatter = [
    '---',
    'layout: guide',
    `title: ${escapeYamlString(title)}`,
    `description: ${escapeYamlString(description)}`,
    `level: ${escapeYamlString(level)}`,
    `category_title: ${escapeYamlString(categoryTitle)}`,
    `canonical_url: ${permalink}`,
    'source: academy',
    '---',
    '',
    body,
    ''
  ].join('\n');

  return { content: frontMatter, slug, permalink, relativePath: `_guides/${slug}.md` };
}

function writeGuideToFilesystem(guideFirebase, options = {}) {
  const { content, slug, permalink, relativePath } = formatJekyllGuideMarkdown(guideFirebase, options);
  const outputPath = path.join(ROOT_DIR, relativePath);

  if (!fs.existsSync(GUIDES_DIR)) {
    fs.mkdirSync(GUIDES_DIR, { recursive: true });
  }

  fs.writeFileSync(outputPath, content, 'utf8');
  logger.info(`Wrote academy guide: ${relativePath}`);

  return { slug, permalink, relativePath, outputPath };
}

module.exports = {
  slugify,
  formatJekyllGuideMarkdown,
  writeGuideToFilesystem,
  GUIDES_DIR
};
