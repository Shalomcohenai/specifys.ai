// Script to fix Academy category icons
// Run with: node backend/scripts/fix-academy-icons.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Initialize Firebase Admin
const { db } = require('../server/firebase-admin');

// Icon mappings - fix icons that don't exist in FontAwesome
const iconFixes = {
  'magic': 'wand-magic-sparkles',  // magic doesn't exist, use wand-magic-sparkles
  'sparkles': 'wand-magic-sparkles',  // sparkles doesn't exist, use wand-magic-sparkles
  'chart-bar': 'chart-column',  // chart-bar might not exist, use chart-column
  'chart-line': 'chart-line-up',  // chart-line might not exist, use chart-line-up
  'layers': 'project-diagram',  // layers doesn't display properly, use project-diagram
  'robot': 'microchip'  // robot doesn't display properly, use microchip
};

// Category-specific fixes (by title)
const categoryFixes = {
  'App Structure': 'project-diagram',
  'AI Feature Development': 'microchip'
};

async function fixIcons() {
  try {
    console.log('🔧 Fixing Academy category icons...\n');

    const categories = await db.collection('academy_categories').get();
    let fixed = 0;

    for (const doc of categories.docs) {
      const category = doc.data();
      const currentIcon = category.icon;
      
      // Check for category-specific fix first
      let fixedIcon = categoryFixes[category.title];
      
      // If no category-specific fix, check icon mapping
      if (!fixedIcon) {
        fixedIcon = iconFixes[currentIcon];
      }

      if (fixedIcon && currentIcon !== fixedIcon) {
        await db.collection('academy_categories').doc(doc.id).update({
          icon: fixedIcon
        });
        console.log(`✅ Fixed "${category.title}": ${currentIcon} → ${fixedIcon}`);
        fixed++;
      }
    }

    console.log(`\n✅ Fixed ${fixed} category icons`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing icons:', error);
    process.exit(1);
  }
}

fixIcons();

