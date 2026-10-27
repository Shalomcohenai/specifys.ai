#!/usr/bin/env node
/**
 * Generate static sitemap.xml without Firebase
 * For use during build when Firebase is not available
 */

const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.join(__dirname, '..');
const BASE_URL = 'https://www.specifys-ai.com';

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
        { loc: `${baseUrl}/academy.html`, source: 'pages/academy/index.html', priority: '0.9', changefreq: 'weekly' },
        { loc: `${baseUrl}/pages/about.html`, source: 'pages/about.html', priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/contact.html`, source: 'pages/contact.html', priority: '0.7', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/how.html`, source: 'pages/how.html', priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/ToolPicker.html`, source: 'pages/ToolPicker.html', priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/pricing.html`, source: 'pages/pricing.html', priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/why.html`, source: 'pages/why.html', priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/cursor-windsurf-integration.html`, source: 'pages/cursor-windsurf-integration.html', priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/for-ai-assistants.html`, source: 'pages/for-ai-assistants.html', priority: '0.85', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/compare.html`, source: 'pages/compare.html', priority: '0.85', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/integrations.html`, source: 'pages/integrations.html', priority: '0.85', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/guides.html`, source: 'pages/guides.html', priority: '0.85', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/guides/vibe-coding.html`, source: 'pages/guides/vibe-coding.html', priority: '0.85', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/guides/app-specification.html`, source: 'pages/guides/app-specification.html', priority: '0.85', changefreq: 'monthly' },
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

function getJekyllGuideUrls(baseUrl, today) {
    const guidesDir = path.join(ROOT_DIR, '_guides');
    if (!fs.existsSync(guidesDir)) return [];

    const files = fs.readdirSync(guidesDir).filter((name) => name.endsWith('.md'));
    return files.map((fileName) => {
        const slug = fileName.replace(/\.md$/, '');
        const filePath = path.join(guidesDir, fileName);
        let lastmod = today;
        try {
            lastmod = fs.statSync(filePath).mtime.toISOString().split('T')[0];
        } catch (error) {
            // keep today
        }
        return {
            loc: `${baseUrl}/academy/guides/${slug}/`,
            lastmod,
            changefreq: 'monthly',
            priority: '0.75'
        };
    });
}

function escapeXml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function generateSitemap() {
    const today = new Date().toISOString().split('T')[0];
    
    const staticUrls = buildStaticUrls(BASE_URL, today);
    const jekyllPostUrls = getJekyllPostUrls(BASE_URL, today);
    const jekyllGuideUrls = getJekyllGuideUrls(BASE_URL, today);
    
    // No Firebase article URLs - all articles are in Jekyll _posts
    const allUrls = [...staticUrls, ...jekyllPostUrls, ...jekyllGuideUrls];

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

// Main execution
const xml = generateSitemap();
const outputPath = path.join(ROOT_DIR, 'sitemap.xml');
fs.writeFileSync(outputPath, xml, 'utf8');

const urlCount = (xml.match(/<url>/g) || []).length;
console.log(`✅ Sitemap generated successfully!`);
console.log(`   Total URLs: ${urlCount}`);
console.log(`   Output: ${outputPath}`);
console.log(`   Base URL: ${BASE_URL}`);
