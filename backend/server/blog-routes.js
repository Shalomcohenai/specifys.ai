// Blog Routes - Handle blog post creation and management with GitHub integration
const fs = require('fs').promises;
const path = require('path');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

// GitHub configuration
const GITHUB_CONFIG = {
    owner: 'Shalomcohenai',
    repo: 'specifys.ai',
    branch: 'main',
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
async function getFileFromGitHub(filePath, branch = null) {
    // Validate GitHub token
    if (!GITHUB_CONFIG.token) {
        console.warn('GITHUB_TOKEN is not configured. Cannot check if file exists.');
        return null;
    }

    const targetBranch = branch || 'main';
    try {
        const endpoint = `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}?ref=${targetBranch}`;
        return await githubRequest(endpoint);
    } catch (error) {
        if (error.message.includes('404')) {
            return null; // File doesn't exist
        }
        throw error;
    }
}

// Helper: Create or update file in GitHub
async function updateFileInGitHub(filePath, content, message, sha = null, branch = null) {
    // Validate GitHub token
    if (!GITHUB_CONFIG.token) {
        throw new Error('GITHUB_TOKEN is not configured. Please set it in environment variables.');
    }

    const targetBranch = branch || 'main';
    const endpoint = `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
    
    const data = {
        message,
        content: Buffer.from(content).toString('base64'),
        branch: targetBranch
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
async function deleteFileFromGitHub(filePath, message, branch = null) {
    const targetBranch = branch || 'main';
    const file = await getFileFromGitHub(filePath, targetBranch);
    if (!file) {
        throw new Error('File not found');
    }

    const endpoint = `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
    
    const data = {
        message,
        sha: file.sha,
        branch: targetBranch
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
    const slug = data.slug ? slugify(data.slug) : slugify(data.title);
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

    const frontMatterLines = [
        'layout: post',
        `title: "${escapeYaml(data.title)}"`,
        `description: "${escapeYaml(data.description)}"`,
        data.seoTitle ? `seo_title: "${escapeYaml(data.seoTitle)}"` : null,
        data.seoDescription ? `seo_description: "${escapeYaml(data.seoDescription)}"` : null,
        `date: ${data.date}`,
        `tags: [${tags}]`,
        `author: "${data.author || 'specifys.ai Team'}"`,
        `canonical_url: "${canonicalUrl}"`,
        `redirect_from: ["${blogUrl}"]`
    ].filter(Boolean);

    return `---
${frontMatterLines.join('\n')}
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
    const {
        title,
        description,
        date,
        author,
        tags,
        content,
        slug: providedSlug,
        seoTitle,
        seoDescription,
        branch
    } = postData;

    // Validate GitHub token
    if (!GITHUB_CONFIG.token) {
        throw new Error('GITHUB_TOKEN is not configured. Please set it in environment variables.');
    }

    // Always use main branch
    const targetBranch = 'main';

    // Create filename
    const slugSource = providedSlug || title;
    const slug = slugify(slugSource);
    if (!slug) {
        throw new Error('Unable to generate a valid slug for this post.');
    }
    const filename = `${date}-${slug}.md`;
    const filePath = `_posts/${filename}`;

    console.log(`[Blog Post] Publishing: ${filename} to branch: ${targetBranch}`);

    // Check if file already exists
    const existingFile = await getFileFromGitHub(filePath, targetBranch);
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
        content,
        slug,
        seoTitle,
        seoDescription
    });

    console.log(`[Blog Post] Created markdown content (${markdownContent.length} chars)`);

    // Upload to GitHub
    const commitMessage = `Add blog post: ${title}`;
    const result = await updateFileInGitHub(filePath, markdownContent, commitMessage, null, targetBranch);

    console.log(`[Blog Post] Successfully published: ${filename} to branch: ${targetBranch}`);
    console.log(`[Blog Post] GitHub commit: ${result.commit?.sha || 'N/A'}`);

    return {
        filename,
        url: `https://specifys-ai.com/blog/${slug}.html`,
        slug,
        commitSha: result.commit?.sha,
        branch: targetBranch
    };
}

// Helper: Parse front matter and content from markdown
function parsePostContent(filename, rawContent) {
    const match = rawContent.match(/^---\n([\s\S]+?)\n---\n?([\s\S]*)$/);
    if (!match) {
        throw new Error('Invalid blog post format.');
    }

    const [, frontMatter, bodyRaw] = match;
    const body = bodyRaw.trim();
    const data = {};

    const captureString = (key) => {
        const regex = new RegExp(`${key}:\\s*"([^"]*)"`);
        const m = frontMatter.match(regex);
        return m ? m[1] : '';
    };

    const captureArray = (key) => {
        const regex = new RegExp(`${key}:\\s*\\[(.*?)\\]`);
        const m = frontMatter.match(regex);
        if (!m) return [];
        return m[1]
            .split(',')
            .map((item) => item.trim().replace(/^"|"$/g, ''))
            .filter(Boolean);
    };

    const captureValue = (key) => {
        const regex = new RegExp(`${key}:\\s*([^\\n]+)`);
        const m = frontMatter.match(regex);
        return m ? m[1].trim() : '';
    };

    const filenameMatch = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    const derivedDate = filenameMatch ? filenameMatch[1] : '';
    const derivedSlug = filenameMatch ? filenameMatch[2] : '';

    data.title = captureString('title') || derivedSlug.replace(/-/g, ' ');
    data.description = captureString('description');
    data.date = captureValue('date') || derivedDate;
    data.author = captureString('author') || 'specifys.ai Team';
    data.tags = captureArray('tags');
    data.slug = derivedSlug;
    data.seoTitle = captureString('seo_title');
    data.seoDescription = captureString('seo_description');
    data.content = body;

    return data;
}

// Route: Create new blog post (adds to queue)
async function createPost(req, res, next) {
    try {
        const {
            title,
            description,
            date,
            author,
            tags,
            content,
            slug,
            seoTitle,
            seoDescription,
            branch
        } = req.body;

        const requestId = req.requestId || `blog-create-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        logger.info({ requestId, branch }, '[blog-routes] Creating blog post');
        
        // Validate required fields
        if (!title || !description || !date || !content) {
            logger.warn({ requestId }, '[blog-routes] Missing required fields');
            return next(createError('Missing required fields: title, description, date, content', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            logger.warn({ requestId, date }, '[blog-routes] Invalid date format');
            return next(createError('Date must be in YYYY-MM-DD format', ERROR_CODES.INVALID_INPUT, 400));
        }

        // Validate description length
        if (description.length > 160) {
            logger.warn({ requestId, descriptionLength: description.length }, '[blog-routes] Description too long');
            return next(createError('Description must be 160 characters or less', ERROR_CODES.INVALID_INPUT, 400));
        }

        // Always use main branch
        const targetBranch = 'main';

        const normalizedSlug = slugify((slug && slug.trim()) || title);
        if (!normalizedSlug) {
            logger.warn({ requestId, title, slug }, '[blog-routes] Unable to generate slug');
            return next(createError('Unable to generate slug from provided values', ERROR_CODES.INVALID_INPUT, 400));
        }

        // Add to queue
        const queueItem = await addToQueue({
            title,
            description,
            date,
            author: author || 'specifys.ai Team',
            tags,
            content,
            slug: normalizedSlug,
            seoTitle: typeof seoTitle === 'string' && seoTitle.trim() ? seoTitle.trim() : null,
            seoDescription:
                typeof seoDescription === 'string' && seoDescription.trim()
                    ? seoDescription.trim()
                    : null,
            branch: targetBranch
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
            status: queueItem.status,
            slug: normalizedSlug
        });

    } catch (error) {
        const requestId = req.requestId || `blog-create-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[blog-routes] Error adding post to queue');

        if (error.code === 'duplicate-slug') {
            return next(createError('A blog post with this slug is already queued or publishing. Wait for it to complete before trying again.', ERROR_CODES.DUPLICATE_RESOURCE, 409));
        }

        next(createError(error.message || 'Failed to add blog post to queue', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: Get single post details
async function getPost(req, res, next) {
    const requestId = req.requestId || `blog-get-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const branch = 'main';
    logger.info({ requestId, branch }, '[blog-routes] Getting blog post');
    
    try {
        const { filename } = req.query;
        if (!filename) {
            logger.warn({ requestId }, '[blog-routes] Filename is required');
            return next(createError('Filename is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }

        const filePath = `_posts/${filename}`;
        const file = await getFileFromGitHub(filePath, branch);
        if (!file || !file.content) {
            logger.warn({ requestId, filename, branch }, '[blog-routes] Post not found');
            return next(createError('Post not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }

        const rawContent = Buffer.from(file.content, 'base64').toString('utf-8');
        const parsed = parsePostContent(filename, rawContent);

        logger.info({ requestId, filename }, '[blog-routes] GET post - Success');
        res.json({
            success: true,
            post: {
                filename,
                ...parsed
            }
        });
    } catch (error) {
        const requestId = req.requestId || `blog-get-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[blog-routes] GET post - Error');
        next(createError(error.message || 'Failed to load blog post', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: Update existing blog post
async function updatePost(req, res, next) {
    try {
        const {
            filename,
            title,
            description,
            date,
            author,
            tags,
            content,
            slug,
            seoTitle,
            seoDescription
        } = req.body;

        const requestId = req.requestId || `blog-update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const targetBranch = 'main';
        logger.info({ requestId, filename, branch: targetBranch }, '[blog-routes] Updating blog post');
        
        if (!filename || !title || !description || !date || !content) {
            logger.warn({ requestId }, '[blog-routes] Missing required fields');
            return next(createError('Missing required fields: filename, title, description, date, content', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }

        if (description.length > 160) {
            logger.warn({ requestId, descriptionLength: description.length }, '[blog-routes] Description too long');
            return next(createError('Description must be 160 characters or less', ERROR_CODES.INVALID_INPUT, 400));
        }

        const filenameMatch = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
        if (!filenameMatch) {
            logger.warn({ requestId, filename }, '[blog-routes] Invalid filename format');
            return next(createError('Invalid filename format', ERROR_CODES.INVALID_INPUT, 400));
        }

        const [ , filenameDate, filenameSlug ] = filenameMatch;

        if (date !== filenameDate) {
            logger.warn({ requestId, date, filenameDate }, '[blog-routes] Date mismatch');
            return next(createError('Date cannot be changed. It must match the filename.', ERROR_CODES.INVALID_INPUT, 400));
        }

        const normalizedSlug = slugify(slug || filenameSlug);
        if (normalizedSlug !== filenameSlug) {
            logger.warn({ requestId, normalizedSlug, filenameSlug }, '[blog-routes] Slug mismatch');
            return next(createError('Slug cannot be changed. It must match the filename.', ERROR_CODES.INVALID_INPUT, 400));
        }

        const filePath = `_posts/${filename}`;
        const existingFile = await getFileFromGitHub(filePath, targetBranch);
        if (!existingFile) {
            logger.warn({ requestId, filename, branch: targetBranch }, '[blog-routes] Post not found');
            return next(createError('Post not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }

        const markdownContent = createPostMarkdown({
            title,
            description,
            date,
            author: author || 'specifys.ai Team',
            tags,
            content,
            slug: filenameSlug,
            seoTitle: typeof seoTitle === 'string' && seoTitle.trim() ? seoTitle.trim() : null,
            seoDescription:
                typeof seoDescription === 'string' && seoDescription.trim()
                    ? seoDescription.trim()
                    : null
        });

        const result = await updateFileInGitHub(
            filePath,
            markdownContent,
            `Update blog post: ${title}`,
            existingFile.sha,
            targetBranch
        );

        logger.info({ requestId, filename }, '[blog-routes] UPDATE post - Success');
        res.json({
            success: true,
            message: 'Blog post updated successfully',
            commitSha: result.commit?.sha || null
        });
    } catch (error) {
        const requestId = req.requestId || `blog-update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[blog-routes] UPDATE post - Error');
        next(createError(error.message || 'Failed to update blog post', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
    }
}

// Route: List all blog posts
async function listPosts(req, res, next) {
    const requestId = req.requestId || `blog-list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const branch = 'main';
    logger.info({ requestId, branch }, '[blog-routes] Listing blog posts');
    
    try {
        // Get all files from _posts directory
        const endpoint = `/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/_posts?ref=${branch}`;
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
                    const fileData = await getFileFromGitHub(`_posts/${post.filename}`, branch);
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
async function deletePost(req, res, next) {
    try {
        const requestId = req.requestId || `blog-delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        logger.info({ requestId }, '[blog-routes] Deleting blog post');
        
        const { filename } = req.body;
        const targetBranch = 'main';

        if (!filename) {
            logger.warn({ requestId }, '[blog-routes] Filename is required');
            return next(createError('Filename is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }

        const filePath = `_posts/${filename}`;
        const commitMessage = `Delete blog post: ${filename}`;

        await deleteFileFromGitHub(filePath, commitMessage, targetBranch);

        // Note: Sitemap will be auto-updated by Jekyll build
        // await removeFromSitemap(filename);

        logger.info({ requestId, filename }, '[blog-routes] DELETE post - Success');
        res.json({
            success: true,
            message: 'Blog post deleted successfully'
        });

    } catch (error) {
        const requestId = req.requestId || `blog-delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[blog-routes] DELETE post - Error');
        next(createError(error.message || 'Failed to delete blog post', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
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
async function getQueueStatusRoute(req, res, next) {
    try {
        const status = getQueueStatus();
        const items = await getQueueItems(20);
        
        const requestId = req.requestId || `blog-queue-status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        logger.info({ requestId }, '[blog-routes] GET queue status - Success');
        res.json({
            success: true,
            status,
            items
        });
    } catch (error) {
        const requestId = req.requestId || `blog-queue-status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[blog-routes] GET queue status - Error');
        next(createError(error.message || 'Failed to get queue status', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

module.exports = {
    createPost,
    listPosts,
    getPost,
    updatePost,
    deletePost,
    getQueueStatus: getQueueStatusRoute,
    getBranches
};

