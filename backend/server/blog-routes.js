// Blog Routes - Handle blog post creation and management with GitHub integration
const fs = require('fs').promises;
const path = require('path');

// GitHub configuration
const GITHUB_CONFIG = {
    owner: 'Shalomcohenai',
    repo: 'specifys.ai',
    branch: 'jekyll',
    token: process.env.GITHUB_TOKEN || '' // GitHub Personal Access Token (use environment variable)
};

// Helper: Slugify text for URL-friendly filenames
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Helper: Create GitHub API request
async function githubRequest(endpoint, method = 'GET', data = null) {
    const fetch = (await import('node-fetch')).default;
    
    const options = {
        method,
        headers: {
            'Authorization': `token ${GITHUB_CONFIG.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Specifys-Blog-Manager'
        }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(`https://api.github.com${endpoint}`, options);
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(`${response.status}: ${error.message || 'GitHub API error'}`);
    }

    return response.json();
}

// Helper: Get file from GitHub
async function getFileFromGitHub(filePath) {
    try {
        const endpoint = `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}?ref=${GITHUB_CONFIG.branch}`;
        return await githubRequest(endpoint);
    } catch (error) {
        if (error.message.includes('404')) {
            return null; // File doesn't exist
        }
        throw error;
    }
}

// Helper: Create or update file in GitHub
async function updateFileInGitHub(filePath, content, message, sha = null) {
    const endpoint = `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
    
    const data = {
        message,
        content: Buffer.from(content).toString('base64'),
        branch: GITHUB_CONFIG.branch
    };

    if (sha) {
        data.sha = sha;
    }

    return await githubRequest(endpoint, 'PUT', data);
}

// Helper: Delete file from GitHub
async function deleteFileFromGitHub(filePath, message) {
    const file = await getFileFromGitHub(filePath);
    if (!file) {
        throw new Error('File not found');
    }

    const endpoint = `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
    
    const data = {
        message,
        sha: file.sha,
        branch: GITHUB_CONFIG.branch
    };

    return await githubRequest(endpoint, 'DELETE', data);
}

// Helper: Create blog post markdown content
function createPostMarkdown(data) {
    const tags = data.tags ? data.tags.split(',').map(t => `"${t.trim()}"`).join(', ') : '';
    const slug = slugify(data.title);
    const canonicalUrl = `https://specifys-ai.com/blog/${slug}.html`;

    return `---
layout: post
title: "${data.title}"
description: "${data.description}"
date: ${data.date}
tags: [${tags}]
author: "${data.author}"
canonical_url: "${canonicalUrl}"
---

# ${data.title}

${data.description}

${data.content}

---

*Published on ${new Date(data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*
`;
}

// Route: Create new blog post
async function createPost(req, res) {
    try {
        const { title, description, date, author, tags, content } = req.body;

        // Validate required fields
        if (!title || !description || !date || !content) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: title, description, date, content'
            });
        }

        // Validate description length
        if (description.length > 160) {
            return res.status(400).json({
                success: false,
                error: 'Description must be 160 characters or less'
            });
        }

        // Create filename
        const slug = slugify(title);
        const filename = `${date}-${slug}.md`;
        const filePath = `_posts/${filename}`;

        // Check if file already exists
        const existingFile = await getFileFromGitHub(filePath);
        if (existingFile) {
            return res.status(400).json({
                success: false,
                error: 'A post with this title and date already exists'
            });
        }

        // Create markdown content
        const markdownContent = createPostMarkdown({
            title,
            description,
            date,
            author: author || 'specifys.ai Team',
            tags,
            content
        });

        // Upload to GitHub
        const commitMessage = `Add blog post: ${title}`;
        await updateFileInGitHub(filePath, markdownContent, commitMessage);

        // Update sitemap
        await updateSitemap(date, slug, title);

        res.json({
            success: true,
            message: 'Blog post created successfully',
            filename,
            url: `https://specifys-ai.com/blog/${slug}.html`
        });

    } catch (error) {
        console.error('Error creating blog post:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create blog post'
        });
    }
}

// Route: List all blog posts
async function listPosts(req, res) {
    try {
        // Get all files from _posts directory
        const endpoint = `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/_posts?ref=${GITHUB_CONFIG.branch}`;
        const files = await githubRequest(endpoint);

        // Filter only markdown files and extract metadata
        const posts = files
            .filter(file => file.name.endsWith('.md'))
            .map(file => {
                const match = file.name.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
                if (match) {
                    const [, date, slug] = match;
                    return {
                        filename: file.name,
                        date,
                        slug,
                        title: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        url: `https://specifys-ai.com/blog/${slug}.html`,
                        sha: file.sha
                    };
                }
                return null;
            })
            .filter(post => post !== null)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        // Fetch full metadata for recent posts (last 20)
        const recentPosts = await Promise.all(
            posts.slice(0, 20).map(async (post) => {
                try {
                    const fileData = await getFileFromGitHub(`_posts/${post.filename}`);
                    const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
                    
                    // Parse front matter
                    const frontMatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
                    if (frontMatterMatch) {
                        const frontMatter = frontMatterMatch[1];
                        const titleMatch = frontMatter.match(/title:\s*"([^"]+)"/);
                        const descMatch = frontMatter.match(/description:\s*"([^"]+)"/);
                        const authorMatch = frontMatter.match(/author:\s*"([^"]+)"/);
                        const tagsMatch = frontMatter.match(/tags:\s*\[(.*?)\]/);

                        return {
                            ...post,
                            title: titleMatch ? titleMatch[1] : post.title,
                            description: descMatch ? descMatch[1] : '',
                            author: authorMatch ? authorMatch[1] : 'specifys.ai Team',
                            tags: tagsMatch ? tagsMatch[1].replace(/"/g, '') : ''
                        };
                    }
                } catch (error) {
                    console.error(`Error fetching metadata for ${post.filename}:`, error);
                }
                return post;
            })
        );

        res.json({
            success: true,
            posts: recentPosts,
            total: posts.length
        });

    } catch (error) {
        console.error('Error listing blog posts:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to list blog posts'
        });
    }
}

// Route: Delete blog post
async function deletePost(req, res) {
    try {
        const { filename } = req.body;

        if (!filename) {
            return res.status(400).json({
                success: false,
                error: 'Filename is required'
            });
        }

        const filePath = `_posts/${filename}`;
        const commitMessage = `Delete blog post: ${filename}`;

        await deleteFileFromGitHub(filePath, commitMessage);

        // Update sitemap to remove the post
        await removeFromSitemap(filename);

        res.json({
            success: true,
            message: 'Blog post deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting blog post:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to delete blog post'
        });
    }
}

// Helper: Update sitemap with new post
async function updateSitemap(date, slug, title) {
    try {
        // Get current sitemap
        const sitemapFile = await getFileFromGitHub('sitemap.xml');
        if (!sitemapFile) {
            console.error('Sitemap file not found');
            return;
        }

        const sitemapContent = Buffer.from(sitemapFile.content, 'base64').toString('utf-8');

        // Create new post entry
        const postUrl = `https://specifys-ai.com/blog/${slug}.html`;
        const lastmod = new Date().toISOString().split('T')[0];
        
        const newEntry = `
  <url>
    <loc>${postUrl}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;

        // Insert before closing </urlset> tag
        const updatedSitemap = sitemapContent.replace('</urlset>', `${newEntry}\n\n</urlset>`);

        // Upload updated sitemap
        await updateFileInGitHub(
            'sitemap.xml',
            updatedSitemap,
            `Update sitemap: Add ${title}`,
            sitemapFile.sha
        );

        console.log('Sitemap updated successfully');
    } catch (error) {
        console.error('Error updating sitemap:', error);
        // Don't fail the post creation if sitemap update fails
    }
}

// Helper: Remove post from sitemap
async function removeFromSitemap(filename) {
    try {
        const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.md$/, '');
        const postUrl = `https://specifys-ai.com/blog/${slug}.html`;

        // Get current sitemap
        const sitemapFile = await getFileFromGitHub('sitemap.xml');
        if (!sitemapFile) {
            console.error('Sitemap file not found');
            return;
        }

        const sitemapContent = Buffer.from(sitemapFile.content, 'base64').toString('utf-8');

        // Remove the post entry (find the <url> block containing this loc)
        const urlPattern = new RegExp(
            `\\s*<url>\\s*<loc>${postUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</loc>[\\s\\S]*?</url>`,
            'g'
        );
        
        const updatedSitemap = sitemapContent.replace(urlPattern, '');

        // Upload updated sitemap
        await updateFileInGitHub(
            'sitemap.xml',
            updatedSitemap,
            `Update sitemap: Remove ${slug}`,
            sitemapFile.sha
        );

        console.log('Post removed from sitemap');
    } catch (error) {
        console.error('Error removing from sitemap:', error);
    }
}

module.exports = {
    createPost,
    listPosts,
    deletePost
};

