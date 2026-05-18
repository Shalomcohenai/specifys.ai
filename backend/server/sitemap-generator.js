/**
 * Sitemap Generator Module
 * Shared logic for generating sitemap.xml
 * Can be used by scripts and API routes
 */

const path = require('path');
const fs = require('fs');
const { db } = require('./firebase-admin');
const ROOT_DIR = path.join(__dirname, '..', '..');
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

function toIsoDate(value) {
    const date = convertTimestamp(value);
    if (!date) return null;
    return date.toISOString().split('T')[0];
}

function resolveLastmodFromFile(relativePath) {
    try {
        const filePath = path.join(ROOT_DIR, relativePath);
        const stat = fs.statSync(filePath);
        return stat.mtime.toISOString().split('T')[0];
    } catch (error) {
        return null;
    }
}

function buildStaticUrls(baseUrl, today) {
    const staticPages = [
        { loc: `${baseUrl}/`, source: 'index.html', priority: '1.0', changefreq: 'weekly' },
        { loc: `${baseUrl}/blog/`, source: 'blog/index.html', priority: '0.9', changefreq: 'weekly' },
        { loc: `${baseUrl}/pages/articles.html`, source: 'pages/articles.html', priority: '0.9', changefreq: 'weekly' },
        { loc: `${baseUrl}/academy.html`, source: 'pages/academy/index.html', priority: '0.9', changefreq: 'weekly' },
        { loc: `${baseUrl}/pages/about.html`, source: 'pages/about.html', priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/contact.html`, source: 'pages/contact.html', priority: '0.7', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/how.html`, source: 'pages/how.html', priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/ToolPicker.html`, source: 'pages/ToolPicker.html', priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/pricing.html`, source: 'pages/pricing.html', priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/why.html`, source: 'pages/why.html', priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/cursor-windsurf-integration.html`, source: 'pages/cursor-windsurf-integration.html', priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/for-ai-assistants.html`, source: 'pages/for-ai-assistants.html', priority: '0.85', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/compare/specifys-vs-lovable.html`, source: 'pages/compare/specifys-vs-lovable.html', priority: '0.85', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/compare/specifys-vs-bolt.html`, source: 'pages/compare/specifys-vs-bolt.html', priority: '0.85', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/compare/specifys-vs-cursor-windsurf.html`, source: 'pages/compare/specifys-vs-cursor-windsurf.html', priority: '0.85', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/glossary/index.html`, source: 'pages/glossary/index.html', priority: '0.85', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/mcp.html`, source: 'pages/mcp.html', priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/tools/map/vibe-coding-tools-map.html`, source: 'tools/map/vibe-coding-tools-map.html', priority: '0.95', changefreq: 'weekly' }
    ];

    return staticPages.map((entry) => ({
        loc: entry.loc,
        changefreq: entry.changefreq,
        priority: entry.priority,
        lastmod: resolveLastmodFromFile(entry.source) || today
    }));
}

function getJekyllPostUrls(baseUrl, today) {
    const postsDir = path.join(ROOT_DIR, '_posts');
    if (!fs.existsSync(postsDir)) return [];

    const files = fs.readdirSync(postsDir).filter((name) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(name));
    return files.map((fileName) => {
        const match = fileName.match(/^(\d{4})-(\d{2})-(\d{2})-(.+)\.md$/);
        if (!match) return null;
        const [, year, month, day, slug] = match;
        const postDate = `${year}-${month}-${day}`;
        return {
            loc: `${baseUrl}/${year}/${month}/${day}/${slug}/`,
            lastmod: postDate || today,
            changefreq: 'monthly',
            priority: '0.6'
        };
    }).filter(Boolean);
}

/** Slugs from `_posts/YYYY-MM-DD-slug.md` for deduping Firestore article URLs */
function getJekyllPostSlugSet() {
    const postsDir = path.join(ROOT_DIR, '_posts');
    if (!fs.existsSync(postsDir)) return new Set();

    const slugs = new Set();
    const files = fs.readdirSync(postsDir).filter((name) => /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(name));
    for (const fileName of files) {
        const match = fileName.match(/^\d{4}-\d{2}-\d{2}-(.+)\.md$/);
        if (match) slugs.add(match[1]);
    }
    return slugs;
}

async function pingIndexNow(urls, baseUrl) {
    const key = process.env.INDEXNOW_KEY;
    if (!key || !Array.isArray(urls) || urls.length === 0) {
        return { success: false, skipped: true };
    }
    const siteHost = new URL(baseUrl).host;
    const keyLocation = `${baseUrl}/${key}.txt`;
    const payload = {
        host: siteHost,
        key,
        keyLocation,
        urlList: urls
    };

    const response = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`IndexNow ping failed: HTTP ${response.status}`);
    }
    return { success: true, skipped: false };
}

// Helper: Convert Firestore Timestamp to Date
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
        try {
            return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
        } catch (e) {
            return null;
        }
    }
    if (typeof timestamp === 'number') {
        return new Date(timestamp);
    }
    if (typeof timestamp === 'string') {
        const parsed = Date.parse(timestamp);
        return isNaN(parsed) ? null : new Date(parsed);
    }
    return null;
}

// Helper: Escape XML special characters
function escapeXml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Generate sitemap XML content
 * @param {string} baseUrl - Base URL for the site
 * @returns {Promise<string>} XML content
 */
async function generateSitemapXml(baseUrl = 'https://specifys-ai.com') {
    const today = new Date().toISOString().split('T')[0];

    const staticUrls = buildStaticUrls(baseUrl, today);
    const jekyllPostUrls = getJekyllPostUrls(baseUrl, today);
    const jekyllSlugs = getJekyllPostSlugSet();

    // Legacy Firebase article URLs only when no static Jekyll post exists for that slug
    const articlesSnapshot = await db.collection('articles')
        .where('status', '==', 'published')
        .get();

    const articleUrls = articlesSnapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((data) => data.slug && !jekyllSlugs.has(data.slug))
        .map((data) => {
            const lastmod = toIsoDate(data.publishedAt || data.createdAt) || today;
            return {
                loc: `${baseUrl}/article.html?slug=${data.slug}`,
                lastmod,
                changefreq: 'monthly',
                priority: '0.8'
            };
        });

    const allUrls = [...staticUrls, ...jekyllPostUrls, ...articleUrls];

    // Generate XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';
    
    allUrls.forEach(url => {
        xml += '  <url>\n';
        xml += `    <loc>${escapeXml(url.loc)}</loc>\n`;
        if (url.lastmod) {
            xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
        }
        xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(url.loc)}" />\n`;
        xml += `    <changefreq>${url.changefreq || 'monthly'}</changefreq>\n`;
        xml += `    <priority>${url.priority || '0.8'}</priority>\n`;
        xml += '  </url>\n';
    });
    
    xml += '</urlset>';

    return xml;
}

/**
 * Generate and save sitemap.xml file
 * @param {string} outputPath - Path to save the sitemap file
 * @param {string} baseUrl - Base URL for the site
 * @returns {Promise<{success: boolean, urlCount: number, path: string}>}
 *
 * Coverage summary:
 * - Public static marketing/product URLs
 * - Jekyll posts from `_posts/*.md` with permalink-style URLs
 * - Published Firebase articles only when no matching `_posts/` slug exists
 */
async function generateAndSaveSitemap(outputPath = null, baseUrl = null) {
    try {
        const finalBaseUrl = baseUrl || process.env.SITE_URL || 'https://specifys-ai.com';
        const finalOutputPath = outputPath || path.join(__dirname, '..', '..', 'sitemap.xml');
        
        const xml = await generateSitemapXml(finalBaseUrl);
        fs.writeFileSync(finalOutputPath, xml, 'utf8');
        
        // Count URLs (rough estimate)
        const urlCount = (xml.match(/<url>/g) || []).length;
        const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
        let indexNow = { success: false, skipped: true };
        if (process.env.INDEXNOW_KEY) {
            try {
                indexNow = await pingIndexNow(urls, finalBaseUrl);
            } catch (error) {
                console.warn('IndexNow ping failed:', error.message);
            }
        }
        
        return {
            success: true,
            urlCount: urlCount,
            path: finalOutputPath,
            indexNow
        };
    } catch (error) {
        console.error('Error generating sitemap:', error);
        throw error;
    }
}

module.exports = {
    generateSitemapXml,
    generateAndSaveSitemap,
    pingIndexNow,
    getJekyllPostSlugSet,
    getJekyllPostUrls
};

