// Public Blog Routes - No authentication required for published posts
const { db } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

const BLOG_COLLECTION = 'blogPosts';

// Public route: List published blog posts (no auth required)
async function listPublishedPosts(req, res, next) {
    const requestId = `blog-public-list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId }, '[blog-routes-public] Listing published blog posts');
    
    try {
        const { limit = 50 } = req.query;
        
        // Only get published posts
        // Fetch all published posts and sort in memory (avoids Firestore index requirement)
        const snapshot = await db.collection(BLOG_COLLECTION)
            .where('published', '==', true)
            .get();

        let posts = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title,
                description: data.description,
                content: data.content,
                date: data.date,
                author: data.author,
                tags: data.tags,
                slug: data.slug,
                url: data.url,
                published: data.published,
                seoTitle: data.seoTitle,
                seoDescription: data.seoDescription,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
            };
        });

        // Sort by date descending (newest first)
        posts.sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateB - dateA;
        });
        
        // Apply limit after sorting
        posts = posts.slice(0, parseInt(limit));

        logger.info({ requestId, count: posts.length }, '[blog-routes-public] GET list - Success');

        res.json({
            success: true,
            posts,
            total: posts.length
        });

    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[blog-routes-public] GET list - Error');
        next(createError(error.message || 'Failed to list blog posts', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Public route: Get single published blog post by slug (no auth required)
async function getPublishedPost(req, res, next) {
    const requestId = `blog-public-get-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId }, '[blog-routes-public] Getting published blog post');
    
    try {
        const { slug } = req.query;
        
        if (!slug) {
            return next(createError('Slug is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }

        const snapshot = await db.collection(BLOG_COLLECTION)
            .where('slug', '==', slug)
            .where('published', '==', true)
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return next(createError('Post not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        const postData = {
            id: doc.id,
            title: data.title,
            description: data.description,
            content: data.content,
            date: data.date,
            author: data.author,
            tags: data.tags,
            slug: data.slug,
            url: data.url,
            published: data.published,
            seoTitle: data.seoTitle,
            seoDescription: data.seoDescription,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
        };

        logger.info({ requestId, postId: doc.id }, '[blog-routes-public] GET post - Success');
        
        res.json({
            success: true,
            post: postData
        });

    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[blog-routes-public] GET post - Error');
        next(createError(error.message || 'Failed to get blog post', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

module.exports = {
    listPublishedPosts,
    getPublishedPost
};

