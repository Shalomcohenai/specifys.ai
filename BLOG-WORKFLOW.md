# Blog Post Creation Workflow

This document explains how to create new blog posts for the Specifys.ai Jekyll blog.

## Quick Start

### Method 1: Interactive Script (Recommended)
```bash
# Run the interactive post creator
node create-post.js

# Or use the shell script
./create-post.sh

# Or on Windows
create-post.bat
```

### Method 2: Manual Creation
1. Copy `_posts/TEMPLATE.md` to `_posts/YYYY-MM-DD-your-slug.md`
2. Fill in the front-matter
3. Write your content

## Post Structure

### File Naming Convention
- Format: `YYYY-MM-DD-slug.md`
- Example: `2025-01-15-lovable-vibe-coding-2025.md`
- Location: `_posts/` directory

### Front-matter Requirements
```yaml
---
layout: post
title: "Your Post Title"
description: "Brief description (≤160 chars)"
date: YYYY-MM-DD
tags: ["tag1", "tag2", "tag3"]
author: "specifys.ai Team"
cover: "/assets/images/cover.jpg"  # Optional
canonical_url: "https://specifys-ai.com/blog/slug.html"
---
```

### Content Guidelines

#### SEO Optimization
- **Title**: Clear, descriptive, includes keywords
- **Description**: 150-160 characters, compelling summary
- **Tags**: 3-5 relevant tags, use existing ones when possible
- **Slug**: URL-friendly version of title

#### Content Structure
1. **Introduction**: Hook the reader, explain what they'll learn
2. **Main Content**: Clear headings, subheadings, examples
3. **Conclusion**: Key takeaways, next steps, call to action

#### Writing Tips
- Use clear, concise language
- Break up text with headings and lists
- Include code examples when relevant
- Add images to illustrate points
- Link to related posts and external resources

## Local Development

### Prerequisites
- Node.js (for post creation script)
- Ruby and Jekyll (for local preview)

### Running Locally
```bash
# Install Jekyll dependencies
bundle install

# Start local server
bundle exec jekyll serve

# View blog at: http://localhost:4000/blog/
```

### Testing New Posts
1. Create your post using the script
2. Start Jekyll server
3. Navigate to `/blog/` to see your post
4. Check individual post URL: `/YYYY/MM/DD/slug/`

## Image Management

### Adding Images
1. Place images in `assets/images/`
2. Reference in posts: `![Alt text](/assets/images/filename.jpg)`
3. Use descriptive filenames
4. Optimize file sizes for web

### Cover Images
- Recommended size: 1200x630px
- Format: JPG or PNG
- Include in front-matter: `cover: "/assets/images/cover.jpg"`

## Tag Management

### Existing Tags
- `vibe coding`
- `AI app development`
- `no-code platform`
- `Specifys.ai`
- `ChatGPT-5`
- `Lovable`
- `software development`
- `AI coding`
- `app development`
- `GPT-5`

### Adding New Tags
- Keep tags lowercase
- Use hyphens for multi-word tags
- Be consistent with existing naming
- Limit to 3-5 tags per post

## Publishing Workflow

### Local Testing
1. Create post using script
2. Edit content in your preferred editor
3. Test locally with Jekyll
4. Verify formatting and links
5. Check SEO elements

### Content Review
- [ ] Title is clear and SEO-friendly
- [ ] Description is compelling and ≤160 chars
- [ ] Tags are relevant and consistent
- [ ] Content is well-structured
- [ ] Images are optimized
- [ ] Links work correctly
- [ ] Code examples are formatted properly

### Deployment
- Posts are automatically included in Jekyll build
- No additional deployment steps needed
- Jekyll generates static files for hosting

## Troubleshooting

### Common Issues

#### Post Not Appearing
- Check file is in `_posts/` directory
- Verify filename format: `YYYY-MM-DD-slug.md`
- Ensure front-matter is valid YAML
- Restart Jekyll server

#### Images Not Loading
- Verify image path starts with `/assets/images/`
- Check file exists in correct location
- Ensure proper file permissions

#### Jekyll Build Errors
- Check YAML front-matter syntax
- Verify all required fields are present
- Look for special characters in content

### Getting Help
- Check Jekyll documentation
- Review existing posts for examples
- Test with simple post first
- Use Jekyll's built-in error messages

## Best Practices

### Content Quality
- Write for your audience
- Provide value and insights
- Use clear, engaging language
- Include practical examples
- End with actionable takeaways

### Technical Quality
- Test all links and code examples
- Optimize images for web
- Use semantic HTML when needed
- Follow accessibility guidelines
- Ensure mobile responsiveness

### SEO Best Practices
- Use descriptive, keyword-rich titles
- Write compelling meta descriptions
- Include relevant tags
- Link to related content
- Use proper heading hierarchy

---

*This workflow is designed for local development. Posts will be included in the Jekyll build when deployed.*

