#!/usr/bin/env node
/**
 * Generate static sitemap.xml file
 * This script queries Firebase and generates a sitemap.xml file
 * Run: node backend/scripts/generate-sitemap.js
 */

const path = require('path');
const fs = require('fs');

// Use the same Firebase initialization as the server
const { db } = require('../server/firebase-admin');

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

async function generateSitemap() {
  try {
    const baseUrl = process.env.SITE_URL || 'https://specifys-ai.com';
    const today = new Date().toISOString().split('T')[0];

    console.log('Generating sitemap for:', baseUrl);

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
    console.log('Fetching articles...');
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

    console.log(`Found ${articleUrls.length} articles`);

    // Get academy categories
    console.log('Fetching academy categories...');
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

    console.log(`Found ${categoryUrls.length} categories`);

    // Get academy guides
    console.log('Fetching academy guides...');
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

    console.log(`Found ${guideUrls.length} guides`);

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

    // Write to file
    const outputPath = path.join(__dirname, '..', '..', 'sitemap.xml');
    fs.writeFileSync(outputPath, xml, 'utf8');

    console.log(`\n✅ Sitemap generated successfully!`);
    console.log(`   Total URLs: ${allUrls.length}`);
    console.log(`   Static: ${staticUrls.length}`);
    console.log(`   Articles: ${articleUrls.length}`);
    console.log(`   Categories: ${categoryUrls.length}`);
    console.log(`   Guides: ${guideUrls.length}`);
    console.log(`   Output: ${outputPath}`);

  } catch (error) {
    console.error('Error generating sitemap:', error);
    process.exit(1);
  }
}

generateSitemap().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

