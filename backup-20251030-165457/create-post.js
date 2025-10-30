#!/usr/bin/env node

/**
 * New Blog Post Creator
 * Creates a new Jekyll blog post with proper front-matter and file structure
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

function formatDate(date) {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

async function createNewPost() {
  console.log('\n🚀 Specifys.ai Blog Post Creator\n');
  console.log('This will create a new Jekyll blog post in the _posts directory.\n');

  try {
    // Get post details
    const title = await question('📝 Post title: ');
    if (!title.trim()) {
      console.log('❌ Title is required!');
      process.exit(1);
    }

    const description = await question('📄 Description (≤160 chars): ');
    if (!description.trim()) {
      console.log('❌ Description is required!');
      process.exit(1);
    }

    const tagsInput = await question('🏷️  Tags (comma-separated): ');
    const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);

    const author = await question('👤 Author (default: specifys.ai Team): ') || 'specifys.ai Team';
    
    const publishDate = await question('📅 Publish date (YYYY-MM-DD, default: today): ');
    const date = publishDate ? new Date(publishDate) : new Date();
    
    if (isNaN(date.getTime())) {
      console.log('❌ Invalid date format!');
      process.exit(1);
    }

    // Generate filename
    const slug = slugify(title);
    const dateStr = formatDate(date);
    const filename = `${dateStr}-${slug}.md`;
    const filepath = path.join('_posts', filename);

    // Check if file already exists
    if (fs.existsSync(filepath)) {
      console.log(`❌ Post already exists: ${filename}`);
      process.exit(1);
    }

    // Create front-matter
    const frontMatter = `---
layout: post
title: "${title}"
description: "${description}"
date: ${dateStr}
tags: [${tags.map(tag => `"${tag}"`).join(', ')}]
author: "${author}"
canonical_url: "https://specifys-ai.com/blog/${filename.replace('.md', '.html')}"
---

# ${title}

${description}

<!-- Add your content here -->

## Introduction

Start your post with an engaging introduction that hooks the reader.

## Main Content

Structure your content with clear headings and sections.

## Conclusion

Wrap up your post with key takeaways and a call to action.

---

*This post was created using the Specifys.ai blog post creator.*
`;

    // Ensure _posts directory exists
    if (!fs.existsSync('_posts')) {
      fs.mkdirSync('_posts');
      console.log('📁 Created _posts directory');
    }

    // Write the file
    fs.writeFileSync(filepath, frontMatter);
    
    console.log('\n✅ Blog post created successfully!');
    console.log(`📄 File: ${filepath}`);
    console.log(`🔗 URL: /${dateStr.split('-').join('/')}/${slug}/`);
    console.log('\n📝 Next steps:');
    console.log('1. Edit the post content in your editor');
    console.log('2. Test locally with: bundle exec jekyll serve');
    console.log('3. Preview at: http://localhost:4000/blog/');
    
  } catch (error) {
    console.error('❌ Error creating post:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
createNewPost();
