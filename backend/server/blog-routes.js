// Blog Routes - Simple Firebase-based blog management
const { db } = require('./firebase-admin');
const { createError, ERROR_CODES } = require('./error-handler');
const { logger } = require('./logger');

// Collection name for blog posts
const BLOG_COLLECTION = 'blogQueue';

// Helper: Slugify text for URL-friendly slugs
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Helper: Validate post data
function validatePostData(data, isUpdate = false) {
    const errors = [];
    
    if (!isUpdate) {
        if (!data.title || !data.title.trim()) {
            errors.push('Title is required');
        }
        if (!data.content || !data.content.trim()) {
            errors.push('Content is required');
        }
        if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
            errors.push('Date must be in YYYY-MM-DD format');
        }
    }
    
    if (data.description && data.description.length > 160) {
        errors.push('Description must be 160 characters or less');
    }
    
    if (errors.length > 0) {
        throw new Error(errors.join('; '));
    }
}

// Route: Create new blog post
async function createPost(req, res, next) {
    const requestId = req.requestId || `blog-create-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId }, '[blog-routes] Creating blog post');
    
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
            seoDescription
        } = req.body;
        
        // Validate required fields
        validatePostData({ title, content, date, description });

        // Generate slug if not provided
        const postSlug = slug ? slugify(slug) : slugify(title);
        if (!postSlug) {
            return next(createError('Unable to generate slug from title', ERROR_CODES.INVALID_INPUT, 400));
        }

        // Check if slug already exists in blogQueue (check postData.slug)
        const snapshot = await db.collection(BLOG_COLLECTION).get();
        const existingPost = snapshot.docs.find(doc => {
            const data = doc.data();
            const postData = data.postData || data;
            return postData.slug === postSlug;
        });

        if (existingPost) {
            return next(createError('A post with this slug already exists', ERROR_CODES.DUPLICATE_RESOURCE, 409));
        }

        // Create post data (will be stored in postData field)
        const postData = {
            title: title.trim(),
            description: description ? description.trim() : '',
            content: content.trim(),
            date: date,
            author: author || 'specifys.ai Team',
            tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
            slug: postSlug,
            seoTitle: seoTitle ? seoTitle.trim() : null,
            seoDescription: seoDescription ? seoDescription.trim() : null,
            published: true
        };

        // Generate URL based on Jekyll permalink format: /:year/:month/:day/:title/
        const dateParts = date.split('-');
        const year = dateParts[0];
        const month = dateParts[1];
        const day = dateParts[2];
        postData.url = `https://specifys-ai.com/${year}/${month}/${day}/${postSlug}/`;

        // Create queue document with postData and status
        const queueDocument = {
            postData: postData,
            status: 'completed', // Mark as completed so it appears in blog
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // Save to Firestore blogQueue collection
        const docRef = await db.collection(BLOG_COLLECTION).add(queueDocument);
        
        logger.info({ requestId, postId: docRef.id, slug: postSlug }, '[blog-routes] POST created - Success');
        
        res.json({
            success: true,
            message: 'Blog post created successfully',
            post: {
                id: docRef.id,
                ...postData,
                status: 'completed'
            }
        });

    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[blog-routes] POST create - Error');
        
        if (error.message.includes('required') || error.message.includes('format')) {
            return next(createError(error.message, ERROR_CODES.INVALID_INPUT, 400));
        }
        
        next(createError(error.message || 'Failed to create blog post', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: List all blog posts
async function listPosts(req, res, next) {
    const requestId = req.requestId || `blog-list-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId }, '[blog-routes] Listing blog posts');
    
    try {
        const { limit = 50, published = true } = req.query;
        
        // Fetch all posts from blogQueue and filter in memory
        // This avoids needing a Firestore index for the status field
        const snapshot = await db.collection(BLOG_COLLECTION).get();

        let posts = snapshot.docs
            .map(doc => {
                const data = doc.data();
                // Extract postData from queue structure
                const postData = data.postData || data;
                
                // Filter: only include completed posts
                if (data.status !== 'completed') {
                    return null;
                }
                
                return {
                    id: doc.id,
                    ...postData,
                    status: data.status || 'completed',
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
                };
            })
            .filter(post => {
                // Remove null entries first
                if (post === null) return false;
                
                // Only return posts that are published and completed
                if (published === 'true' || published === true) {
                    return post.published === true && post.status === 'completed';
                }
                return true;
            })
            .sort((a, b) => {
                // Sort by date descending (newest first)
                const dateA = new Date(a.date || 0);
                const dateB = new Date(b.date || 0);
                if (dateB - dateA !== 0) return dateB - dateA;
                // If dates are equal, sort by createdAt
                const createdA = a.createdAt?.getTime() || 0;
                const createdB = b.createdAt?.getTime() || 0;
                return createdB - createdA;
            });

        logger.info({ requestId, count: posts.length }, '[blog-routes] GET list - Success');

        res.json({
            success: true,
            posts,
            total: posts.length
        });

    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[blog-routes] GET list - Error');
        next(createError(error.message || 'Failed to list blog posts', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: Get single blog post
async function getPost(req, res, next) {
    const requestId = req.requestId || `blog-get-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId }, '[blog-routes] Getting blog post');
    
    try {
        const { id, slug } = req.query;
        
        let doc;
        
        if (id) {
            doc = await db.collection(BLOG_COLLECTION).doc(id).get();
        } else if (slug) {
            // Search in blogQueue - fetch all and filter in memory (avoids needing Firestore index)
            const snapshot = await db.collection(BLOG_COLLECTION).get();
            
            const matchingDoc = snapshot.docs.find(d => {
                const data = d.data();
                const postData = data.postData || data;
                // Filter: completed status and matching slug
                return data.status === 'completed' && postData.slug === slug;
            });
            
            if (!matchingDoc) {
                return next(createError('Post not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
            }
            
            doc = matchingDoc;
        } else {
            return next(createError('Either id or slug is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }

        if (!doc.exists) {
            return next(createError('Post not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }

        const data = doc.data();
        const postData = data.postData || data;
        const result = {
            id: doc.id,
            ...postData,
            status: data.status || 'completed',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt
        };

        logger.info({ requestId, postId: doc.id }, '[blog-routes] GET post - Success');
        
        res.json({
            success: true,
            post: result
        });

    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[blog-routes] GET post - Error');
        next(createError(error.message || 'Failed to get blog post', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: Update existing blog post
async function updatePost(req, res, next) {
    const requestId = req.requestId || `blog-update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    logger.info({ requestId }, '[blog-routes] Updating blog post');
    
    try {
        const { id, filename } = req.body;
        const postId = id || filename;
        
        if (!postId) {
            return next(createError('Post ID is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }

        const docRef = db.collection(BLOG_COLLECTION).doc(postId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return next(createError('Post not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }

        const existingData = doc.data();
        const existingPostData = existingData.postData || existingData;
        const {
            title,
            description,
            content,
            date,
            author,
            tags,
            slug,
            seoTitle,
            seoDescription,
            published
        } = req.body;

        // Build update data for postData
        const postDataUpdate = {};
        if (title !== undefined) postDataUpdate.title = title.trim();
        if (description !== undefined) postDataUpdate.description = description ? description.trim() : '';
        if (content !== undefined) postDataUpdate.content = content.trim();
        if (date !== undefined) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                return next(createError('Date must be in YYYY-MM-DD format', ERROR_CODES.INVALID_INPUT, 400));
            }
            postDataUpdate.date = date;
        }
        if (author !== undefined) postDataUpdate.author = author;
        if (tags !== undefined) {
            postDataUpdate.tags = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);
        }
        if (published !== undefined) postDataUpdate.published = published === true || published === 'true';

        // Handle slug change
        let newSlug = existingPostData.slug;
        if (slug !== undefined && slug !== existingPostData.slug) {
            newSlug = slugify(slug);
            if (!newSlug) {
                return next(createError('Invalid slug', ERROR_CODES.INVALID_INPUT, 400));
            }
            
            // Check if new slug already exists
            const snapshot = await db.collection(BLOG_COLLECTION).get();
            const slugExists = snapshot.docs.find(doc => {
                if (doc.id === postId) return false;
                const data = doc.data();
                const postData = data.postData || data;
                return postData.slug === newSlug;
            });
            
            if (slugExists) {
                return next(createError('A post with this slug already exists', ERROR_CODES.DUPLICATE_RESOURCE, 409));
            }
            
            postDataUpdate.slug = newSlug;
        }

        if (seoTitle !== undefined) postDataUpdate.seoTitle = seoTitle ? seoTitle.trim() : null;
        if (seoDescription !== undefined) postDataUpdate.seoDescription = seoDescription ? seoDescription.trim() : null;

        // Recalculate URL if date or slug changed
        const finalDate = postDataUpdate.date || existingPostData.date;
        const finalSlug = postDataUpdate.slug || existingPostData.slug;
        const dateParts = finalDate.split('-');
        postDataUpdate.url = `https://specifys-ai.com/${dateParts[0]}/${dateParts[1]}/${dateParts[2]}/${finalSlug}/`;

        // Validate description length if provided
        if (postDataUpdate.description && postDataUpdate.description.length > 160) {
            return next(createError('Description must be 160 characters or less', ERROR_CODES.INVALID_INPUT, 400));
        }

        // Merge with existing postData
        const updatedPostData = {
            ...existingPostData,
            ...postDataUpdate
        };

        // Update the document
        const updateData = {
            postData: updatedPostData,
            updatedAt: new Date()
        };

        await docRef.update(updateData);

        const updatedDoc = await docRef.get();
        const updatedDocData = updatedDoc.data();
        const finalPostData = updatedDocData.postData || updatedDocData;
        const updatedData = {
            id: updatedDoc.id,
            ...finalPostData,
            status: updatedDocData.status || 'completed',
            createdAt: updatedDocData.createdAt?.toDate ? updatedDocData.createdAt.toDate() : updatedDocData.createdAt,
            updatedAt: updatedDocData.updatedAt?.toDate ? updatedDocData.updatedAt.toDate() : updatedDocData.updatedAt
        };

        logger.info({ requestId, postId }, '[blog-routes] POST update - Success');
        
        res.json({
            success: true,
            message: 'Blog post updated successfully',
            post: updatedData
        });

    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[blog-routes] POST update - Error');
        
        if (error.message.includes('format') || error.message.includes('characters')) {
            return next(createError(error.message, ERROR_CODES.INVALID_INPUT, 400));
        }

        next(createError(error.message || 'Failed to update blog post', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

// Route: Delete blog post
async function deletePost(req, res, next) {
        const requestId = req.requestId || `blog-delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        logger.info({ requestId }, '[blog-routes] Deleting blog post');
        
    try {
        const { id, filename } = req.body;
        const postId = id || filename;
        
        if (!postId) {
            return next(createError('Post ID is required', ERROR_CODES.MISSING_REQUIRED_FIELD, 400));
        }

        const docRef = db.collection(BLOG_COLLECTION).doc(postId);
        const doc = await docRef.get();

        if (!doc.exists) {
            return next(createError('Post not found', ERROR_CODES.RESOURCE_NOT_FOUND, 404));
        }

        await docRef.delete();

        logger.info({ requestId, postId }, '[blog-routes] DELETE post - Success');
        
        res.json({
            success: true,
            message: 'Blog post deleted successfully'
        });

    } catch (error) {
        logger.error({ requestId, error: { message: error.message, stack: error.stack } }, '[blog-routes] DELETE post - Error');
        next(createError(error.message || 'Failed to delete blog post', ERROR_CODES.DATABASE_ERROR, 500));
    }
}

module.exports = {
    createPost,
    listPosts,
    getPost,
    updatePost,
    deletePost
};

