# Specifys.ai Blog - Jekyll Setup

This directory contains the Jekyll-based blog system for Specifys.ai, migrated from the original HTML blog structure.

## Structure

```
├── _config.yml          # Jekyll configuration
├── _layouts/            # Jekyll layouts
│   ├── default.html     # Main site layout
│   └── post.html        # Blog post layout
├── _includes/           # Reusable components
│   ├── header.html      # Site header
│   └── footer.html      # Site footer
├── _posts/              # Blog posts (Markdown)
│   ├── 2025-01-15-lovable-vibe-coding-2025.md
│   ├── 2025-06-12-meet-the-new-vibe-coding-strategy.md
│   └── ... (32 total posts)
├── blog/
│   └── index.md         # Blog listing page
├── assets/css/
│   └── blog.css         # Blog-specific styles
└── Gemfile              # Ruby dependencies
```

## Features

- ✅ **32 Migrated Posts**: All original HTML posts converted to Markdown
- ✅ **Jekyll Structure**: Proper layouts, includes, and configuration
- ✅ **SEO Optimized**: Meta tags, canonical URLs, redirects
- ✅ **Responsive Design**: Mobile-friendly layouts
- ✅ **Template Integration**: Uses template-test.html design system
- ✅ **Redirect Support**: Legacy URLs redirect to new permalinks
- ✅ **301 Redirects**: Preserves SEO rankings and link equity

## Usage

### Creating New Posts

#### Interactive Method (Recommended)
```bash
# Run the interactive post creator
node create-post.js

# Or use shell scripts
./create-post.sh        # Unix/Mac
create-post.bat         # Windows
```

#### Manual Method
1. Copy `_posts/TEMPLATE.md` to `_posts/YYYY-MM-DD-slug.md`
2. Fill in the front-matter
3. Write your content

### Post Creation Workflow
1. **Run Script**: Use `node create-post.js` for guided creation
2. **Fill Details**: Title, description, tags, author, date
3. **Edit Content**: Use your preferred editor
4. **Test Locally**: `bundle exec jekyll serve`
5. **Preview**: Visit `http://localhost:4000/blog/`

### File Structure
- **Posts**: `_posts/YYYY-MM-DD-slug.md`
- **Template**: `_posts/TEMPLATE.md`
- **Scripts**: `create-post.js`, `create-post.sh`, `create-post.bat`
- **Documentation**: `BLOG-WORKFLOW.md`, `CSS-DOCUMENTATION.md`, `BLOG-MAINTENANCE.md`, `CSS-QUICK-REFERENCE.md`

### Local Development

1. Install Ruby and Bundler
2. Install dependencies:
   ```bash
   bundle install
   ```
3. Serve locally:
   ```bash
   bundle exec jekyll serve
   ```
4. Visit `http://localhost:4000/blog/`

### GitHub Pages Deployment

The setup is configured for GitHub Pages deployment:

1. Push to GitHub repository
2. Enable GitHub Pages in repository settings
3. Select source branch (usually `main` or `gh-pages`)
4. Site will be available at `https://username.github.io/repository-name/blog/`

**Canonical Blog URL**: `/blog/` (replaces `/blog.html`)

## URL Migration

The blog has been migrated from `/blog.html` to `/blog/` for better SEO and Jekyll compatibility:

- ✅ **New Canonical URL**: `/blog/` (Jekyll-based)
- ✅ **Legacy Redirect**: `/blog.html` → `/blog/` (301 redirect)
- ✅ **Navigation Updated**: All site navigation links point to `/blog/`
- ✅ **SEO Preserved**: Canonical URLs and redirects maintain search rankings

## Post Structure

Each post includes:

```yaml
---
layout: post
title: "Post Title"
description: "Post description (≤160 chars)"
date: YYYY-MM-DD
tags: ["tag1", "tag2", "tag3"]
author: "specifys.ai Team"
cover: "/assets/images/post-cover.jpg"
canonical_url: "https://specifys-ai.com/blog/original-file.html"
redirect_from: ["/blog/original-file.html"]
---
```

## CSS Variables

The blog uses CSS variables defined in `assets/css/blog.css`:

- **Typography**: Font families, sizes, weights, line heights
- **Colors**: Primary, secondary, text, background colors
- **Spacing**: Consistent spacing scale
- **Shadows**: Box shadows for depth
- **Transitions**: Smooth animations

## Redirect Configuration

The blog includes comprehensive redirect support for legacy URLs:

### Jekyll Redirect Plugin
- **Plugin**: `jekyll-redirect-from` configured in `_config.yml`
- **Method**: `redirect_from` entries in each post's front-matter
- **Example**: `redirect_from: ["/blog/old-file.html"]`

### _redirects File
- **File**: `_redirects` (included in Jekyll build)
- **Purpose**: Fallback redirects for hosting platforms like Netlify
- **Format**: `source destination status_code`
- **Example**: `/blog/old-file.html /2025/01/01/new-permalink/ 301`

### Redirect Benefits
- ✅ **SEO Preservation**: 301 redirects maintain search rankings
- ✅ **Link Equity**: Preserves value from external links
- ✅ **User Experience**: Seamless transition for bookmarks
- ✅ **Backward Compatibility**: All old URLs continue to work

## Migration Notes

- All original HTML content preserved
- Tables kept as HTML within Markdown
- Links updated to use Jekyll's `relative_url` filter
- SEO metadata maintained
- Redirects configured for legacy URLs

## Documentation

### Comprehensive Guides
- **[BLOG-WORKFLOW.md](BLOG-WORKFLOW.md)** - Complete post creation workflow
- **[CSS-DOCUMENTATION.md](CSS-DOCUMENTATION.md)** - Design system and CSS variables
- **[BLOG-MAINTENANCE.md](BLOG-MAINTENANCE.md)** - Maintenance procedures and troubleshooting
- **[CSS-QUICK-REFERENCE.md](CSS-QUICK-REFERENCE.md)** - Quick CSS variables reference

### Key Features Documented
- ✅ **Post Creation**: Interactive scripts and manual methods
- ✅ **CSS Variables**: Complete design system documentation
- ✅ **Maintenance**: Daily, weekly, monthly procedures
- ✅ **Troubleshooting**: Common issues and solutions
- ✅ **Performance**: Optimization guidelines
- ✅ **Security**: Best practices and procedures

## Testing

A test file `blog-test.html` demonstrates the expected output structure without requiring Jekyll to be running locally.
