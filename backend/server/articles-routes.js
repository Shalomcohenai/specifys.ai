// Articles Routes - Firebase-based articles management with Cloudflare Worker integration
const { db, admin } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { generateAndSaveSitemap } = require('./sitemap-generator');

// Use built-in fetch for Node.js 18+ or fallback to node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
  fetch = globalThis.fetch;
} else {
  fetch = require('node-fetch');
}

// Collection name for articles
const ARTICLES_COLLECTION = 'articles';

// Worker URL
const WORKER_URL = 'https://articles.shalom-cohen-111.workers.dev/';

// Helper: Slugify text for URL-friendly slugs
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Helper: Validate article data from worker
function validateArticleData(data) {
    const requiredFields = ['title', 'seo_title', 'short_title', 'teaser_90', 'description_160', 'content_markdown', 'tags'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
    
    if (!Array.isArray(data.tags)) {
        throw new Error('Tags must be an array');
    }
    
    return true;
}

// Helper: Safely convert Firestore Timestamp to Date
function convertTimestamp(timestamp) {
    if (!timestamp) return null;
    
    // If it's already a Date, return it
    if (timestamp instanceof Date) {
        return timestamp;
    }
    
    // If it's a Firestore Timestamp (has toDate method)
    if (timestamp && typeof timestamp.toDate === 'function') {
        try {
            return timestamp.toDate();
        } catch (e) {
            logger.warn({ error: e.message }, '[articles-routes] Error converting timestamp with toDate()');
            return null;
        }
    }
    
    // If it's a Firestore Timestamp object (has seconds property)
    if (timestamp && typeof timestamp === 'object' && timestamp.seconds !== undefined) {
        try {
            return new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000);
        } catch (e) {
            logger.warn({ error: e.message }, '[articles-routes] Error converting timestamp from seconds');
            return null;
        }
    }
    
    // If it's a number (milliseconds), convert to Date
    if (typeof timestamp === 'number') {
        return new Date(timestamp);
    }
    
    // If it's a string, try to parse it
    if (typeof timestamp === 'string') {
        const parsed = Date.parse(timestamp);
        return isNaN(parsed) ? null : new Date(parsed);
    }
    
    return null;
}

// Helper: Format article data for Firebase
function formatArticleForFirebase(workerResponse, topic) {
    const articleSlug = slugify(workerResponse.title);
    
    return {
        topic: topic.trim(),
        title: workerResponse.title,
        seo_title: workerResponse.seo_title,
        short_title: workerResponse.short_title,
        teaser_90: workerResponse.teaser_90,
        description_160: workerResponse.description_160,
        content_markdown: workerResponse.content_markdown,
        tags: workerResponse.tags || [],
        slug: articleSlug,
        status: 'published', // Default to published after successful generation
        views: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        publishedAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

// Route: Generate new article
async function generateArticle(req, res, next) {
    const requestId = req.requestId || `article-generate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId }, '[articles-routes] Generating article');
    
    try {
        const { topic } = req.body;
        
        if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
            return next(createError('Topic is required and must be a non-empty string', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }
        
        // Create initial document with status "generating"
        const initialDoc = {
            topic: topic.trim(),
            status: 'generating',
            views: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = db.collection(ARTICLES_COLLECTION).doc();
        await docRef.set(initialDoc);
        
        logger.info({ requestId, articleId: docRef.id, topic }, '[articles-routes] Initial document created with status "generating"');
        
        // Call Cloudflare Worker
        let workerResponse;
        try {
            logger.info({ requestId, workerUrl: WORKER_URL }, '[articles-routes] Calling Cloudflare Worker');
            
            const workerRequestStart = Date.now();
            const fetchResponse = await fetch(WORKER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ topic: topic.trim() })
            });
            
            const workerRequestTime = Date.now() - workerRequestStart;
            logger.info({ requestId, status: fetchResponse.status, duration: `${workerRequestTime}ms` }, '[articles-routes] Worker response received');
            
            if (!fetchResponse.ok) {
                const errorText = await fetchResponse.text();
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    errorData = { error: errorText };
                }
                
                logger.error({ requestId, status: fetchResponse.status, error: errorData }, '[articles-routes] Worker returned error');
                
                // Update document with error status
                await docRef.update({
                    status: 'generating', // Keep as generating for retry
                    error: errorData.error || `Worker returned status ${fetchResponse.status}`,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                
                return next(createError(
                    errorData.error || `Failed to generate article: HTTP ${fetchResponse.status}`,
                    ERROR_CODES.EXTERNAL_SERVICE_ERROR,
                    500
                ));
            }
            
            workerResponse = await fetchResponse.json();
            logger.info({ requestId, hasTitle: !!workerResponse.title }, '[articles-routes] Worker response parsed');
            
        } catch (fetchError) {
            logger.error({ requestId, error: { message: fetchError.message, stack: fetchError.stack } }, '[articles-routes] Worker fetch error');
            
            // Update document with error status
            await docRef.update({
                status: 'generating', // Keep as generating for retry
                error: fetchError.message,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return next(createError(
                `Failed to connect to article generation service: ${fetchError.message}`,
                ERROR_CODES.EXTERNAL_SERVICE_ERROR,
                500
            ));
        }
        
        // Validate worker response
        try {
            validateArticleData(workerResponse);
        } catch (validationError) {
            logger.error({ requestId, error: validationError.message }, '[articles-routes] Worker response validation failed');
            
            await docRef.update({
                status: 'generating',
                error: validationError.message,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return next(createError(validationError.message, ERROR_CODES.VALIDATION_ERROR, 400));
        }
        
        // Format and save article data
        const articleData = formatArticleForFirebase(workerResponse, topic);
        
        // Check if slug already exists
        const snapshot = await db.collection(ARTICLES_COLLECTION).get();
        const existingArticle = snapshot.docs.find(doc => {
            if (doc.id === docRef.id) return false; // Skip current document
            const data = doc.data();
            return data.slug === articleData.slug;
        });
        
        if (existingArticle) {
            // Append timestamp to slug to make it unique
            articleData.slug = `${articleData.slug}-${Date.now()}`;
            logger.warn({ requestId, originalSlug: slugify(workerResponse.title), newSlug: articleData.slug }, '[articles-routes] Slug conflict resolved');
        }
        
        // Update document with article data
        await docRef.update({
            ...articleData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        logger.info({ requestId, articleId: docRef.id, slug: articleData.slug }, '[articles-routes] Article generated successfully');
        
        // Fetch updated document
        const updatedDoc = await docRef.get();
        const finalData = updatedDoc.data();
        
        // Update sitemap if article was published
        if (finalData.status === 'published') {
            generateAndSaveSitemap().catch(err => {
                logger.warn({ requestId, error: err.message }, '[articles-routes] Failed to update sitemap (non-critical)');
            });
        }
        
        res.json({
            success: true,
            message: 'Article generated successfully',
            article: {
                id: updatedDoc.id,
                ...finalData,
                createdAt: convertTimestamp(finalData.createdAt),
                publishedAt: convertTimestamp(finalData.publishedAt),
                updatedAt: convertTimestamp(finalData.updatedAt)
            }
        });
        
    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[articles-routes] Generate article error');
        next(createError(error.message || 'Failed to generate article', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: List articles with pagination
async function listArticles(req, res, next) {
    const requestId = req.requestId || `article-list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId }, '[articles-routes] Listing articles');
    
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status || 'published';
        
        // Fetch all articles and filter in memory (avoids needing Firestore index)
        const snapshot = await db.collection(ARTICLES_COLLECTION).get();
        
        let articles = snapshot.docs
            .map(doc => {
                try {
                    const data = doc.data();
                    
                    // Filter by status if specified
                    if (status !== 'all' && data.status !== status) {
                        return null;
                    }
                    
                    // Safely convert timestamps
                    const createdAt = convertTimestamp(data.createdAt);
                    const publishedAt = convertTimestamp(data.publishedAt);
                    const updatedAt = convertTimestamp(data.updatedAt);
                    
                    return {
                        id: doc.id,
                        ...data,
                        createdAt,
                        publishedAt,
                        updatedAt
                    };
                } catch (docError) {
                    // Log error for this specific document but don't fail the entire request
                    logger.warn({ requestId, docId: doc.id, error: docError.message }, '[articles-routes] Error processing document, skipping');
                    return null;
                }
            })
            .filter(article => article !== null)
            .sort((a, b) => {
                // Sort by publishedAt descending (newest first), fallback to createdAt
                const dateA = (a.publishedAt && a.publishedAt instanceof Date) ? a.publishedAt.getTime() : 
                             (a.createdAt && a.createdAt instanceof Date) ? a.createdAt.getTime() : 0;
                const dateB = (b.publishedAt && b.publishedAt instanceof Date) ? b.publishedAt.getTime() : 
                             (b.createdAt && b.createdAt instanceof Date) ? b.createdAt.getTime() : 0;
                return dateB - dateA;
            });
        
        // Pagination
        const total = articles.length;
        const totalPages = Math.ceil(total / limit);
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedArticles = articles.slice(startIndex, endIndex);
        
        logger.info({ requestId, total, page, limit, returned: paginatedArticles.length }, '[articles-routes] GET list - Success');
        
        res.json({
            success: true,
            articles: paginatedArticles,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        });
        
    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[articles-routes] GET list - Error');
        next(createError(error.message || 'Failed to list articles', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: Get featured articles for carousel
async function getFeaturedArticles(req, res, next) {
    const requestId = req.requestId || `article-featured-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId }, '[articles-routes] Getting featured articles');
    
    try {
        const limit = parseInt(req.query.limit) || 5;
        
        const snapshot = await db.collection(ARTICLES_COLLECTION).get();
        
        let articles = snapshot.docs
            .map(doc => {
                try {
                    const data = doc.data();
                    
                    // Only include published articles
                    if (data.status !== 'published') {
                        return null;
                    }
                    
                    // Safely convert timestamps
                    const createdAt = convertTimestamp(data.createdAt);
                    const publishedAt = convertTimestamp(data.publishedAt);
                    const updatedAt = convertTimestamp(data.updatedAt);
                    
                    return {
                        id: doc.id,
                        ...data,
                        createdAt,
                        publishedAt,
                        updatedAt
                    };
                } catch (docError) {
                    // Log error for this specific document but don't fail the entire request
                    logger.warn({ requestId, docId: doc.id, error: docError.message }, '[articles-routes] Error processing document in featured, skipping');
                    return null;
                }
            })
            .filter(article => article !== null)
            .sort((a, b) => {
                // Sort by views descending, then by publishedAt descending
                if (b.views !== a.views) {
                    return (b.views || 0) - (a.views || 0);
                }
                const dateA = (a.publishedAt && a.publishedAt instanceof Date) ? a.publishedAt.getTime() : 
                             (a.createdAt && a.createdAt instanceof Date) ? a.createdAt.getTime() : 0;
                const dateB = (b.publishedAt && b.publishedAt instanceof Date) ? b.publishedAt.getTime() : 
                             (b.createdAt && b.createdAt instanceof Date) ? b.createdAt.getTime() : 0;
                return dateB - dateA;
            })
            .slice(0, limit);
        
        logger.info({ requestId, count: articles.length }, '[articles-routes] GET featured - Success');
        
        res.json({
            success: true,
            articles
        });
        
    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[articles-routes] GET featured - Error');
        next(createError(error.message || 'Failed to get featured articles', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: Get article by slug
async function getArticleBySlug(req, res, next) {
    const requestId = req.requestId || `article-get-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId, slug: req.params.slug }, '[articles-routes] Getting article by slug');
    
    try {
        const { slug } = req.params;
        
        if (!slug) {
            return next(createError('Slug is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }
        
        // Search in articles collection
        const snapshot = await db.collection(ARTICLES_COLLECTION).get();
        
        const matchingDoc = snapshot.docs.find(doc => {
            const data = doc.data();
            return data.slug === slug;
        });
        
        if (!matchingDoc) {
            return next(createError('Article not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }
        
        const data = matchingDoc.data();
        const result = {
            id: matchingDoc.id,
            ...data,
            createdAt: convertTimestamp(data.createdAt),
            publishedAt: convertTimestamp(data.publishedAt),
            updatedAt: convertTimestamp(data.updatedAt)
        };
        
        logger.info({ requestId, articleId: matchingDoc.id }, '[articles-routes] GET article - Success');
        
        res.json({
            success: true,
            article: result
        });
        
    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[articles-routes] GET article - Error');
        next(createError(error.message || 'Failed to get article', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: Update article
async function updateArticle(req, res, next) {
    const requestId = req.requestId || `article-update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId, articleId: req.params.id }, '[articles-routes] Updating article');
    
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        if (!id) {
            return next(createError('Article ID is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }
        
        const docRef = db.collection(ARTICLES_COLLECTION).doc(id);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            return next(createError('Article not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }
        
        // Handle slug change
        if (updateData.slug && updateData.slug !== doc.data().slug) {
            const newSlug = slugify(updateData.slug);
            if (!newSlug) {
                return next(createError('Invalid slug', ERROR_CODES.INVALID_INPUT, 400));
            }
            
            // Check if new slug already exists
            const snapshot = await db.collection(ARTICLES_COLLECTION).get();
            const slugExists = snapshot.docs.find(d => {
                if (d.id === id) return false;
                return d.data().slug === newSlug;
            });
            
            if (slugExists) {
                return next(createError('An article with this slug already exists', ERROR_CODES.DUPLICATE_RESOURCE, 409));
            }
            
            updateData.slug = newSlug;
        }
        
        // Prepare update object
        const updateObj = {
            ...updateData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        // If status is being changed to published, update publishedAt
        if (updateData.status === 'published' && doc.data().status !== 'published') {
            updateObj.publishedAt = admin.firestore.FieldValue.serverTimestamp();
        }
        
        await docRef.update(updateObj);
        
        // Fetch updated document
        const updatedDoc = await docRef.get();
        const finalData = updatedDoc.data();
        
        // Update sitemap if status changed to published
        const wasPublished = doc.data().status === 'published';
        const isNowPublished = finalData.status === 'published';
        if (!wasPublished && isNowPublished) {
            generateAndSaveSitemap().catch(err => {
                logger.warn({ requestId, error: err.message }, '[articles-routes] Failed to update sitemap (non-critical)');
            });
        }
        
        logger.info({ requestId, articleId: id }, '[articles-routes] PUT update - Success');
        
        res.json({
            success: true,
            message: 'Article updated successfully',
            article: {
                id: updatedDoc.id,
                ...finalData,
                createdAt: convertTimestamp(finalData.createdAt),
                publishedAt: convertTimestamp(finalData.publishedAt),
                updatedAt: convertTimestamp(finalData.updatedAt)
            }
        });
        
    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[articles-routes] PUT update - Error');
        next(createError(error.message || 'Failed to update article', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: Delete article
async function deleteArticle(req, res, next) {
    const requestId = req.requestId || `article-delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId, articleId: req.params.id }, '[articles-routes] Deleting article');
    
    try {
        const { id } = req.params;
        
        if (!id) {
            return next(createError('Article ID is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }
        
        const docRef = db.collection(ARTICLES_COLLECTION).doc(id);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            return next(createError('Article not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }
        
        const articleData = doc.data();
        await docRef.delete();
        
        // Update sitemap if deleted article was published
        if (articleData.status === 'published') {
            generateAndSaveSitemap().catch(err => {
                logger.warn({ requestId, error: err.message }, '[articles-routes] Failed to update sitemap (non-critical)');
            });
        }
        
        logger.info({ requestId, articleId: id }, '[articles-routes] DELETE article - Success');
        
        res.json({
            success: true,
            message: 'Article deleted successfully'
        });
        
    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[articles-routes] DELETE article - Error');
        next(createError(error.message || 'Failed to delete article', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: Increment view count
async function incrementViewCount(req, res, next) {
    const requestId = req.requestId || `article-view-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.debug({ requestId, slug: req.params.slug }, '[articles-routes] Incrementing view count');
    
    try {
        const { slug } = req.params;
        
        if (!slug) {
            return next(createError('Slug is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }
        
        // Find article by slug
        const snapshot = await db.collection(ARTICLES_COLLECTION).get();
        const matchingDoc = snapshot.docs.find(doc => doc.data().slug === slug);
        
        if (!matchingDoc) {
            return next(createError('Article not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }
        
        // Increment views atomically
        await matchingDoc.ref.update({
            views: admin.firestore.FieldValue.increment(1)
        });
        
        res.json({
            success: true,
            message: 'View count incremented'
        });
        
    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[articles-routes] POST view - Error');
        next(createError(error.message || 'Failed to increment view count', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: Generate dynamic sitemap.xml
async function generateSitemap(req, res, next) {
    const requestId = req.requestId || `sitemap-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId }, '[articles-routes] Generating sitemap.xml');
    
    try {
        const baseUrl = process.env.SITE_URL || 'https://specifys-ai.com';
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Static URLs that should always be in sitemap
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
        
        // Get all published articles
        const articlesSnapshot = await db.collection(ARTICLES_COLLECTION)
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
        
        // Get all academy categories
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
        
        // Get all academy guides
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
        
        // Combine static and dynamic URLs
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
        
        logger.info({ 
            requestId, 
            urlCount: allUrls.length, 
            articleCount: articleUrls.length,
            categoryCount: categoryUrls.length,
            guideCount: guideUrls.length,
            staticCount: staticUrls.length
        }, '[articles-routes] Sitemap generated successfully');
        
        res.set('Content-Type', 'application/xml');
        res.send(xml);
        
    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[articles-routes] Sitemap generation error');
        next(createError(error.message || 'Failed to generate sitemap', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Helper: Escape XML special characters
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}


module.exports = {
    generateArticle,
    listArticles,
    getFeaturedArticles,
    getArticleBySlug,
    updateArticle,
    deleteArticle,
    incrementViewCount,
    generateSitemap
};

