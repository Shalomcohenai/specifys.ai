// Articles Routes - Firebase-based articles management
const { db, admin } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');
const { generateAndSaveSitemap, generateSitemapXml } = require('./sitemap-generator');
const { recordArticleView } = require('./analytics-service');
const { jobRegistry } = require('./automation-service');
const { ArticleWriterJob } = require('./articles-automation');

// Collection name for articles
const ARTICLES_COLLECTION = 'articles';

// Helper: Slugify text for URL-friendly slugs
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
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

// Route: Generate new article (admin manual trigger)
// Uses the same ArticleWriterJob as the daily scheduler — no external worker.
async function generateArticle(req, res, next) {
    const requestId = req.requestId || `article-generate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId }, '[articles-routes] Generating article via ArticleWriterJob');

    try {
        const { topic } = req.body;

        if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
            return next(createError('Topic is required and must be a non-empty string', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return next(createError('OPENAI_API_KEY is not configured on the server', ERROR_CODES.CONFIGURATION_ERROR, 500));
        }

        // Ensure the job is registered (the scheduler registers it too; this is a fallback for admin triggers).
        try {
            jobRegistry.getJob('article-writer');
        } catch (notRegistered) {
            const job = new ArticleWriterJob({ openaiApiKey: apiKey });
            jobRegistry.registerJob('article-writer', job);
            logger.info({ requestId }, '[articles-routes] Article writer job registered on-demand');
        }

        const execResult = await jobRegistry.executeJob('article-writer', {
            dryRun: false,
            weeklyBatch: false,
            topic: topic.trim()
        });

        if (!execResult.success) {
            const errorMessage = execResult.error?.message || 'Article generation failed';
            logger.error({ requestId, topic, error: execResult.error }, '[articles-routes] Article generation failed');
            return next(createError(errorMessage, ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
        }

        const article = execResult.result?.article || null;

        if (!article || !article.id) {
            logger.error({ requestId, topic, result: execResult.result }, '[articles-routes] Article generation returned no article');
            return next(createError('Article generation returned no article', ERROR_CODES.EXTERNAL_SERVICE_ERROR, 500));
        }

        logger.info({
            requestId,
            articleId: article.id,
            slug: article.slug,
            duration: execResult.result?.duration
        }, '[articles-routes] Article generated successfully');

        // Sitemap regen is already triggered inside generateAndSaveArticle (skipSitemap=false),
        // but we run it again here defensively in case the underlying call failed silently.
        generateAndSaveSitemap().catch(err => {
            logger.warn({ requestId, error: err.message }, '[articles-routes] Sitemap refresh failed (non-critical)');
        });

        res.json({
            success: true,
            message: 'Article generated successfully',
            article: {
                id: article.id,
                topic: article.topic,
                title: article.title,
                slug: article.slug,
                status: article.status || 'published',
                seo_title: article.seo_title,
                short_title: article.short_title,
                teaser_90: article.teaser_90,
                description_160: article.description_160,
                metaDescription: article.metaDescription,
                tags: article.tags || [],
                views: 0,
                source: article.source || 'manual'
            }
        });

    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[articles-routes] Generate article error');
        next(createError(error.message || 'Failed to generate article', ERROR_CODES.INTERNAL_ERROR, 500));
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
        const snapshot = await db.collection(ARTICLES_COLLECTION).where('slug', '==', slug).limit(1).get();
        
        if (snapshot.empty) {
            return next(createError('Article not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }
        
        const matchingDoc = snapshot.docs[0];
        const articleData = matchingDoc.data();
        const articleId = matchingDoc.id;
        
        // Get user ID if authenticated (from token if available)
        let userId = null;
        try {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const { auth } = require('./firebase-admin');
                const idToken = authHeader.split('Bearer ')[1];
                const decodedToken = await auth.verifyIdToken(idToken).catch(() => null);
                if (decodedToken) userId = decodedToken.uid;
            }
        } catch (error) {
            // Ignore auth errors - view tracking works without auth
        }
        
        const ip = req.ip || req.connection?.remoteAddress || null;
        
        // Record view with timestamp using analytics service
        await recordArticleView(articleId, slug, userId, ip);
        
        logger.info({ requestId, articleId, slug, userId }, '[articles-routes] POST view - Success');
        
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
        const xml = await generateSitemapXml(baseUrl);
        res.set('Content-Type', 'application/xml');
        res.send(xml);
        
    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[articles-routes] Sitemap generation error');
        next(createError(error.message || 'Failed to generate sitemap', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: Cleanup articles stuck in `generating` status (admin only)
// Old worker-based flow could leave articles stuck in 'generating' if the worker timed out.
// This endpoint deletes (or marks as failed) any article that has been "generating" for too long.
async function cleanupStuckArticles(req, res, next) {
    const requestId = req.requestId || `articles-cleanup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId, body: req.body }, '[articles-routes] Cleaning up stuck articles');

    try {
        // Default: anything stuck for 10+ minutes is considered dead
        const maxAgeMinutes = Number.isFinite(req.body?.maxAgeMinutes) ? req.body.maxAgeMinutes : 10;
        const action = (req.body?.action === 'mark-failed') ? 'mark-failed' : 'delete';

        const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

        const snapshot = await db.collection(ARTICLES_COLLECTION)
            .where('status', '==', 'generating')
            .get();

        const matched = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const created = convertTimestamp(data.createdAt);
            if (!created || created < cutoff) {
                matched.push({ id: doc.id, ref: doc.ref, title: data.title || data.topic || '(no title)' });
            }
        }

        let processed = 0;
        for (const item of matched) {
            if (action === 'delete') {
                await item.ref.delete();
            } else {
                await item.ref.update({
                    status: 'failed',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
            processed++;
        }

        logger.info({ requestId, processed, action, maxAgeMinutes }, '[articles-routes] Cleanup completed');

        res.json({
            success: true,
            processed,
            action,
            maxAgeMinutes,
            items: matched.map(m => ({ id: m.id, title: m.title }))
        });
    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[articles-routes] Cleanup error');
        next(createError(error.message || 'Failed to clean up stuck articles', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

module.exports = {
    generateArticle,
    listArticles,
    getFeaturedArticles,
    getArticleBySlug,
    updateArticle,
    deleteArticle,
    incrementViewCount,
    generateSitemap,
    cleanupStuckArticles
};

