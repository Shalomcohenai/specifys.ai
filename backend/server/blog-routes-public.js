// Public Blog Routes - No authentication required for published posts
const { db } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

const BLOG_COLLECTION = 'blogQueue';

// Public route: List published blog posts (no auth required)
async function listPublishedPosts(req, res, next) {
    const requestId = `blog-public-list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId }, '[blog-routes-public] Listing published blog posts');
    
    try {
        const { limit = 50 } = req.query;
        
        // Fetch all posts from blogQueue and filter in memory
        // This avoids needing a Firestore index for the status field
        const snapshot = await db.collection(BLOG_COLLECTION).get();
        
        logger.info({ requestId, totalDocs: snapshot.docs.length }, '[blog-routes-public] Fetched all documents from blogQueue');

        let posts = snapshot.docs
            .map(doc => {
                const data = doc.data();
                const postData = data.postData || data;
                
                // Debug logging
                const status = data.status;
                const published = postData.published;
                
                // Filter: only include completed and published posts
                if (status !== 'completed' || published !== true) {
                    logger.debug({ 
                        requestId, 
                        docId: doc.id, 
                        status, 
                        published, 
                        hasPostData: !!data.postData,
                        postDataKeys: data.postData ? Object.keys(data.postData) : []
                    }, '[blog-routes-public] Filtered out post');
                    return null;
                }
                
                logger.debug({ requestId, docId: doc.id, title: postData.title }, '[blog-routes-public] Including post');
                return {
                    id: doc.id,
                    title: postData.title,
                    description: postData.description,
                    content: postData.content,
                    date: postData.date,
                    author: postData.author,
                    tags: postData.tags,
                    slug: postData.slug,
                    url: postData.url,
                    published: postData.published,
                    seoTitle: postData.seoTitle,
                    seoDescription: postData.seoDescription,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
                };
            })
            .filter(post => post !== null); // Remove null entries

        logger.info({ requestId, postsAfterFilter: posts.length }, '[blog-routes-public] Posts after filtering');

        // Sort by date descending (newest first)
        posts.sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateB - dateA;
        });
        
        // Apply limit after sorting
        posts = posts.slice(0, parseInt(limit));

        logger.info({ requestId, count: posts.length, samplePosts: posts.slice(0, 3).map(p => ({ id: p.id, title: p.title, published: p.published })) }, '[blog-routes-public] GET list - Success');

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

        // Fetch all posts and filter in memory (avoids needing Firestore index)
        const snapshot = await db.collection(BLOG_COLLECTION).get();
        
        const matchingDoc = snapshot.docs.find(doc => {
            const data = doc.data();
            const postData = data.postData || data;
            // Filter: completed status, published, and matching slug
            return data.status === 'completed' 
                && postData.published === true 
                && postData.slug === slug;
        });
        
        if (!matchingDoc) {
            return next(createError('Post not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }

        const doc = matchingDoc;
        const data = doc.data();
        const postDataObj = data.postData || data;

        const postData = {
            id: doc.id,
            title: postDataObj.title,
            description: postDataObj.description,
            content: postDataObj.content,
            date: postDataObj.date,
            author: postDataObj.author,
            tags: postDataObj.tags,
            slug: postDataObj.slug,
            url: postDataObj.url,
            published: postDataObj.published,
            seoTitle: postDataObj.seoTitle,
            seoDescription: postDataObj.seoDescription,
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

