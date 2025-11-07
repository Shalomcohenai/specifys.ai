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
    // Validate GitHub token
    if (!GITHUB_CONFIG.token) {
        console.warn('GITHUB_TOKEN is not configured. Cannot check if file exists.');
        return null;
    }

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
    // Validate GitHub token
    if (!GITHUB_CONFIG.token) {
        throw new Error('GITHUB_TOKEN is not configured. Please set it in environment variables.');
    }

    const endpoint = `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
    
    const data = {
        message,
        content: Buffer.from(content).toString('base64'),
        branch: GITHUB_CONFIG.branch
    };

    if (sha) {
        data.sha = sha;
    }

    try {
        return await githubRequest(endpoint, 'PUT', data);
    } catch (error) {
        console.error('Error uploading file to GitHub:', error);
        throw new Error(`Failed to upload file to GitHub: ${error.message}`);
    }
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
    // Parse tags - handle both comma-separated string and array
    let tagsArray = [];
    if (data.tags) {
        if (typeof data.tags === 'string') {
            tagsArray = data.tags.split(',').map(t => t.trim()).filter(t => t);
        } else if (Array.isArray(data.tags)) {
            tagsArray = data.tags;
        }
    }
    const tags = tagsArray.map(t => `"${t}"`).join(', ');
    
    const slug = slugify(data.title);
    const canonicalUrl = `https://specifys-ai.com/blog/${slug}.html`;
    const blogUrl = `/blog/${slug}.html`;

    // Escape quotes and special characters in title and description for YAML
    const escapeYaml = (str) => {
        if (!str) return '';
        // Escape backslashes first, then quotes, then newlines
        return str
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, ' ')
            .replace(/\r/g, '');
    };

    return `---
layout: post
title: "${escapeYaml(data.title)}"
description: "${escapeYaml(data.description)}"
date: ${data.date}
tags: [${tags}]
author: "${data.author || 'specifys.ai Team'}"
canonical_url: "${canonicalUrl}"
redirect_from: ["${blogUrl}"]
---

# ${data.title}

${data.content}

---

*Published on ${new Date(data.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}*
`;
}

// Import blog queue system
const { addToQueue, processQueueItem, getQueueStatus, getQueueItems, QUEUE_STATUS } = require('./blog-queue');

// Internal function to actually publish a post
async function publishPostToGitHub(postData) {
    const { title, description, date, author, tags, content } = postData;

    // Validate GitHub token
    if (!GITHUB_CONFIG.token) {
        throw new Error('GITHUB_TOKEN is not configured. Please set it in environment variables.');
    }

    // Create filename
    const slug = slugify(title);
    const filename = `${date}-${slug}.md`;
    const filePath = `_posts/${filename}`;

    console.log(`[Blog Post] Publishing: ${filename}`);

    // Check if file already exists
    const existingFile = await getFileFromGitHub(filePath);
    if (existingFile) {
        throw new Error(`A post with this title and date already exists: ${filename}`);
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

    console.log(`[Blog Post] Created markdown content (${markdownContent.length} chars)`);

    // Upload to GitHub
    const commitMessage = `Add blog post: ${title}`;
    const result = await updateFileInGitHub(filePath, markdownContent, commitMessage);

    console.log(`[Blog Post] Successfully published: ${filename}`);
    console.log(`[Blog Post] GitHub commit: ${result.commit?.sha || 'N/A'}`);

    return {
        filename,
        url: `https://specifys-ai.com/blog/${slug}.html`,
        slug,
        commitSha: result.commit?.sha
    };
}

// Route: Create new blog post (adds to queue)
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

        // Add to queue
        const queueItem = await addToQueue({
            title,
            description,
            date,
            author: author || 'specifys.ai Team',
            tags,
            content
        });

        // Process the queue item asynchronously (only if not already processing)
        const { getQueueStatus } = require('./blog-queue');
        const queueStatus = getQueueStatus();
        
        if (!queueStatus.processing) {
            processQueueItem(queueItem, publishPostToGitHub).catch(error => {
                console.error('Error processing queue item:', error);
            });
        }

        res.json({
            success: true,
            message: 'Blog post added to queue',
            queueId: queueItem.id,
            status: queueItem.status
        });

    } catch (error) {
        console.error('Error adding post to queue:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to add blog post to queue'
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

        // Fetch full metadata for all posts
        const recentPosts = await Promise.all(
            posts.map(async (post) => {
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

        // Note: Sitemap will be auto-updated by Jekyll build
        // await removeFromSitemap(filename);

        res.json({
            success: true,
            message: 'Blog post deleted successfully'
        });

    } catch (error) {

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

    } catch (error) {

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

    } catch (error) {

    }
}

// Route: Get queue status
async function getQueueStatusRoute(req, res) {
    try {
        const status = getQueueStatus();
        const items = await getQueueItems(20);
        
        res.json({
            success: true,
            status,
            items
        });
    } catch (error) {
        console.error('Error getting queue status:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get queue status'
        });
    }
}

module.exports = {
    createPost,
    listPosts,
    deletePost,
    getQueueStatus: getQueueStatusRoute
};

