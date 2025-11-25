#!/usr/bin/env node
/**
 * Generate static sitemap.xml file
 * This script queries Firebase and generates a sitemap.xml file
 * Run: node backend/scripts/generate-sitemap.js
 */

const { generateAndSaveSitemap } = require('../server/sitemap-generator');

async function main() {
  try {
    const baseUrl = process.env.SITE_URL || 'https://specifys-ai.com';
    console.log('Generating sitemap for:', baseUrl);
    
    const result = await generateAndSaveSitemap();
    
    console.log(`\n✅ Sitemap generated successfully!`);
    console.log(`   Total URLs: ${result.urlCount}`);
    console.log(`   Output: ${result.path}`);
    
  } catch (error) {
    console.error('Error generating sitemap:', error);
    process.exit(1);
  }
}

main().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
