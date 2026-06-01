/**
 * Write automation articles as static Jekyll posts (_posts/) for crawlable HTML.
 * Supports local filesystem writes (backfill) and GitHub Contents API (Render).
 */

const path = require('path');
const fs = require('fs');
const { logger } = require('./logger');

let octokitCtorPromise = null;

async function loadOctokit() {
  if (!octokitCtorPromise) {
    octokitCtorPromise = import('@octokit/rest').then((mod) => mod.Octokit);
  }
  return octokitCtorPromise;
}

const ROOT_DIR = path.join(__dirname, '..', '..');
const POSTS_DIR = path.join(ROOT_DIR, '_posts');
const DEFAULT_BASE_URL = 'https://specifys-ai.com';

function escapeYamlString(value) {
  if (value == null) return '""';
  const str = String(value);
  if (/[:#\n\r"'[\]{}>|*&!%@`]/.test(str) || str.trim() !== str) {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return str;
}

function formatTagsYaml(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return '[]';
  }
  const items = tags.map((t) => `  - ${escapeYamlString(t)}`).join('\n');
  return `\n${items}`;
}

function resolvePublishedDate(articleFirebase) {
  const raw = articleFirebase.publishedAt || articleFirebase.createdAt;
  if (raw && typeof raw.toDate === 'function') {
    return raw.toDate();
  }
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw;
  }
  if (raw && typeof raw === 'object' && raw.seconds != null) {
    return new Date(raw.seconds * 1000);
  }
  if (typeof raw === 'string' || typeof raw === 'number') {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function buildPostPaths(slug, publishedDate, baseUrl = DEFAULT_BASE_URL) {
  const y = publishedDate.getFullYear();
  const m = String(publishedDate.getMonth() + 1).padStart(2, '0');
  const d = String(publishedDate.getDate()).padStart(2, '0');
  const datePrefix = `${y}-${m}-${d}`;
  const relativePath = `_posts/${datePrefix}-${slug}.md`;
  const permalink = `${baseUrl}/${y}/${m}/${d}/${slug}/`;
  return { relativePath, permalink, datePrefix, year: y, month: m, day: d };
}

/**
 * @param {object} articleFirebase - Firestore-shaped article fields
 * @param {object} [options]
 * @param {string} [options.baseUrl]
 */
function formatJekyllPostMarkdown(articleFirebase, options = {}) {
  const baseUrl = options.baseUrl || process.env.SITE_URL || DEFAULT_BASE_URL;
  const slug = articleFirebase.slug;
  if (!slug) {
    throw new Error('Article slug is required for Jekyll post');
  }

  const publishedDate = resolvePublishedDate(articleFirebase);
  const { permalink } = buildPostPaths(slug, publishedDate, baseUrl);
  const title = articleFirebase.seo_title || articleFirebase.title || 'Article';
  const description = articleFirebase.description_160 || articleFirebase.metaDescription || '';
  const dateIso = publishedDate.toISOString().split('T')[0];
  const tags = articleFirebase.tags || [];
  const body = (articleFirebase.content_markdown || '').trim();

  const frontMatter = [
    '---',
    'layout: post',
    `title: ${escapeYamlString(title)}`,
    `description: ${escapeYamlString(description)}`,
    `date: ${dateIso}`,
    `tags:${formatTagsYaml(tags)}`,
    'author: "Specifys.ai Team"',
    `canonical_url: ${permalink}`,
    'source: automation',
    '---',
    '',
    body,
    ''
  ].join('\n');

  return { content: frontMatter, publishedDate, permalink };
}

function getGitHubConfig() {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_REPO_TOKEN;
  const repoFull = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';

  if (!token || !repoFull) {
    return null;
  }

  const [owner, repo] = repoFull.split('/');
  if (!owner || !repo) {
    return null;
  }

  return { token, owner, repo, branch };
}

async function commitPostToGitHub({ relativePath, content, message }) {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error('GITHUB_TOKEN and GITHUB_REPO are required for GitHub commits');
  }

  const Octokit = await loadOctokit();
  const octokit = new Octokit({ auth: config.token });
  let sha;

  try {
    const existing = await octokit.repos.getContent({
      owner: config.owner,
      repo: config.repo,
      path: relativePath,
      ref: config.branch
    });
    if (existing.data && !Array.isArray(existing.data)) {
      sha = existing.data.sha;
    }
  } catch (err) {
    if (err.status !== 404) throw err;
  }

  const result = await octokit.repos.createOrUpdateFileContents({
    owner: config.owner,
    repo: config.repo,
    path: relativePath,
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: config.branch,
    ...(sha ? { sha } : {})
  });

  return {
    commitSha: result.data.commit.sha,
    url: result.data.content.html_url
  };
}

function writePostToFilesystem(relativePath, content) {
  const fullPath = path.join(ROOT_DIR, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

function buildRedirectLine(slug, permalink) {
  const target = permalink.replace(DEFAULT_BASE_URL, '').replace(/\/$/, '');
  return `/article.html?slug=${slug}  ${target}/  301`;
}

/**
 * Publish article as Jekyll post (GitHub if configured, else local filesystem).
 * @returns {Promise<{ jekyll_permalink, jekyll_post_path, redirect_line }>}
 */
async function writeJekyllPostForArticle(articleFirebase, options = {}) {
  const baseUrl = options.baseUrl || process.env.SITE_URL || DEFAULT_BASE_URL;
  const slug = articleFirebase.slug;
  const { content, publishedDate, permalink } = formatJekyllPostMarkdown(articleFirebase, { baseUrl });
  const { relativePath } = buildPostPaths(slug, publishedDate, baseUrl);
  const message = options.commitMessage || `Add Jekyll post: ${slug}`;

  const githubConfig = getGitHubConfig();
  const preferFilesystem = options.preferFilesystem === true;

  if (githubConfig && !preferFilesystem) {
    await commitPostToGitHub({ relativePath, content, message });
    logger.info({ slug, relativePath }, '[jekyll-post-writer] Committed post to GitHub');
  } else {
    writePostToFilesystem(relativePath, content);
    logger.info({ slug, relativePath }, '[jekyll-post-writer] Wrote post to filesystem');
  }

  return {
    jekyll_permalink: permalink,
    jekyll_post_path: relativePath,
    redirect_line: buildRedirectLine(slug, permalink)
  };
}

/**
 * Resolve static Jekyll permalink from _posts filename when Firestore field is missing.
 */
function findJekyllPermalinkForSlug(slug, baseUrl = DEFAULT_BASE_URL) {
  if (!slug || !fs.existsSync(POSTS_DIR)) return null;

  const suffix = `-${slug}.md`;
  const match = fs.readdirSync(POSTS_DIR).find(
    (name) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(name) && name.endsWith(suffix)
  );
  if (!match) return null;

  const parts = match.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
  if (!parts) return null;

  const [, year, month, day] = parts;
  return `${baseUrl.replace(/\/$/, '')}/${year}/${month}/${day}/${slug}/`;
}

function enrichArticleWithJekyllPermalink(article, baseUrl) {
  if (!article || article.jekyll_permalink) return article;
  const permalink = findJekyllPermalinkForSlug(article.slug, baseUrl);
  if (!permalink) return article;
  return { ...article, jekyll_permalink: permalink };
}

module.exports = {
  formatJekyllPostMarkdown,
  buildPostPaths,
  resolvePublishedDate,
  commitPostToGitHub,
  writePostToFilesystem,
  writeJekyllPostForArticle,
  buildRedirectLine,
  getGitHubConfig,
  findJekyllPermalinkForSlug,
  enrichArticleWithJekyllPermalink,
  POSTS_DIR,
  ROOT_DIR
};
