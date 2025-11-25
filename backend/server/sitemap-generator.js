/**
 * Sitemap Generator Module
 * Shared logic for generating sitemap.xml
 * Can be used by scripts and API routes
 */

const path = require('path');
const fs = require('fs');
const { db } = require('./firebase-admin');

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

    // Static URLs
    const staticUrls = [
        { loc: `${baseUrl}/`, priority: '1.0', changefreq: 'weekly' },
        { loc: `${baseUrl}/blog/`, priority: '0.9', changefreq: 'weekly' },
        { loc: `${baseUrl}/articles.html`, priority: '0.9', changefreq: 'weekly' },
        { loc: `${baseUrl}/academy.html`, priority: '0.9', changefreq: 'weekly' },
        { loc: `${baseUrl}/pages/about.html`, priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/how.html`, priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/ToolPicker.html`, priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/pricing.html`, priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/why.html`, priority: '0.8', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/auth.html`, priority: '0.7', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/profile.html`, priority: '0.7', changefreq: 'weekly' },
        { loc: `${baseUrl}/pages/demo-spec.html`, priority: '0.6', changefreq: 'monthly' },
        { loc: `${baseUrl}/pages/spec-viewer.html`, priority: '0.85', changefreq: 'weekly' },
        { loc: `${baseUrl}/tools/map/vibe-coding-tools-map.html`, priority: '0.95', changefreq: 'weekly' }
    ];

    // Get published articles
    const articlesSnapshot = await db.collection('articles')
        .where('status', '==', 'published')
        .get();
    
    const articleUrls = articlesSnapshot.docs.map(doc => {
        const data = doc.data();
        const publishedAt = convertTimestamp(data.publishedAt || data.createdAt);
        const lastmod = publishedAt ? publishedAt.toISOString().split('T')[0] : today;
        
        return {
            loc: `${baseUrl}/article.html?slug=${data.slug}`,
            lastmod: lastmod,
            changefreq: 'monthly',
            priority: '0.8'
        };
    });

    // Get academy categories
    const categoriesSnapshot = await db.collection('academy_categories').get();
    const categoryUrls = categoriesSnapshot.docs.map(doc => {
        const data = doc.data();
        const createdAt = convertTimestamp(data.createdAt);
        const lastmod = createdAt ? createdAt.toISOString().split('T')[0] : today;
        
        return {
            loc: `${baseUrl}/academy/category.html?category=${doc.id}`,
            lastmod: lastmod,
            changefreq: 'weekly',
            priority: '0.85'
        };
    });

    // Get academy guides
    const guidesSnapshot = await db.collection('academy_guides').get();
    const guideUrls = guidesSnapshot.docs.map(doc => {
        const data = doc.data();
        const createdAt = convertTimestamp(data.createdAt);
        const lastmod = createdAt ? createdAt.toISOString().split('T')[0] : today;
        
        return {
            loc: `${baseUrl}/academy/guide.html?guide=${doc.id}`,
            lastmod: lastmod,
            changefreq: 'monthly',
            priority: '0.8'
        };
    });

    // Combine all URLs
    const allUrls = [...staticUrls, ...articleUrls, ...categoryUrls, ...guideUrls];

    // Generate XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    allUrls.forEach(url => {
        xml += '  <url>\n';
        xml += `    <loc>${escapeXml(url.loc)}</loc>\n`;
        if (url.lastmod) {
            xml += `    <lastmod>${url.lastmod}</lastmod>\n`;
        }
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
 */
async function generateAndSaveSitemap(outputPath = null, baseUrl = null) {
    try {
        const finalBaseUrl = baseUrl || process.env.SITE_URL || 'https://specifys-ai.com';
        const finalOutputPath = outputPath || path.join(__dirname, '..', '..', 'sitemap.xml');
        
        const xml = await generateSitemapXml(finalBaseUrl);
        fs.writeFileSync(finalOutputPath, xml, 'utf8');
        
        // Count URLs (rough estimate)
        const urlCount = (xml.match(/<url>/g) || []).length;
        
        return {
            success: true,
            urlCount: urlCount,
            path: finalOutputPath
        };
    } catch (error) {
        console.error('Error generating sitemap:', error);
        throw error;
    }
}

module.exports = {
    generateSitemapXml,
    generateAndSaveSitemap
};

