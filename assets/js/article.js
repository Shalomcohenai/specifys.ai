// Article JavaScript - Single article page functionality

class ArticlePage {
    constructor() {
        this.article = null;
        this.slug = null;
        this.init();
    }

    init() {
        // Get slug from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.slug = urlParams.get('slug');

        if (!this.slug) {
            this.showError('Article slug is required');
            return;
        }

        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.loadArticle());
        } else {
            this.loadArticle();
        }
    }

    // Get API base URL
    getApiBaseUrl() {
        // Always use Render backend URL
        return window.getApiBaseUrl ? window.getApiBaseUrl() : 'https://specifys-ai.onrender.com';
    }

    // Load article from API
    async loadArticle() {
        const articleContent = document.getElementById('article-content');
        if (!articleContent) return;

        articleContent.innerHTML = '<div class="article-loading"><p>Loading article...</p></div>';

        try {
            const apiBaseUrl = this.getApiBaseUrl();
            const response = await fetch(`${apiBaseUrl}/api/articles/${this.slug}`);

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('Article not found');
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.article) {
                this.article = result.article;
                this.renderArticle(this.article);
                this.updateViewCount();
                this.loadRelatedArticles();
            } else {
                throw new Error(result.error || result.message || 'Failed to load article');
            }
        } catch (error) {
            // Error loading article
            this.showError(error.message);
        }
    }

    // Update SEO meta tags
    updateSEOTags(article) {
        const baseUrl = window.location.origin;
        const articleUrl = `${baseUrl}/article.html?slug=${article.slug}`;
        const articleTitle = article.seo_title || article.title || article.short_title || 'Article';
        const articleDescription = article.description_160 || article.teaser_90 || '';
        const articleImage = `${baseUrl}/assets/images/og-image.png`; // Default OG image
        const publishedDate = article.publishedAt || article.createdAt;
        const tags = article.tags || [];

        // Update page title
        document.title = `${articleTitle} - Specifys.ai`;

        // Update or create meta description
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', articleDescription);

        // Update or create meta keywords
        let metaKeywords = document.querySelector('meta[name="keywords"]');
        if (!metaKeywords) {
            metaKeywords = document.createElement('meta');
            metaKeywords.setAttribute('name', 'keywords');
            document.head.appendChild(metaKeywords);
        }
        const keywordsContent = tags.length > 0 
            ? tags.join(', ') + ', AI development tools, vibe coding, software innovation'
            : 'AI development tools, vibe coding, software innovation';
        metaKeywords.setAttribute('content', keywordsContent);

        // Update or create canonical URL
        let canonical = document.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', articleUrl);

        // Open Graph tags
        const ogTags = {
            'og:title': articleTitle,
            'og:description': articleDescription,
            'og:type': 'article',
            'og:url': articleUrl,
            'og:image': articleImage,
            'og:site_name': 'Specifys.ai',
            'og:locale': 'en_US'
        };

        if (publishedDate) {
            const dateObj = publishedDate instanceof Date ? publishedDate : 
                          (publishedDate.toDate ? publishedDate.toDate() : new Date(publishedDate));
            if (!isNaN(dateObj.getTime())) {
                ogTags['article:published_time'] = dateObj.toISOString();
                ogTags['article:modified_time'] = dateObj.toISOString();
            }
        }

        ogTags['article:author'] = 'Specifys.ai';

        // Update or create Open Graph tags
        Object.keys(ogTags).forEach(key => {
            let ogTag = document.querySelector(`meta[property="${key}"]`);
            if (!ogTag) {
                ogTag = document.createElement('meta');
                ogTag.setAttribute('property', key);
                document.head.appendChild(ogTag);
            }
            ogTag.setAttribute('content', ogTags[key]);
        });

        // Add article:tag tags (multiple tags are allowed, each gets its own meta tag)
        if (tags.length > 0) {
            // Remove existing article:tag tags first
            const existingTags = document.querySelectorAll('meta[property="article:tag"]');
            existingTags.forEach(tag => tag.remove());
            
            // Add new article:tag tags
            tags.forEach((tag) => {
                const tagMeta = document.createElement('meta');
                tagMeta.setAttribute('property', 'article:tag');
                tagMeta.setAttribute('content', tag);
                document.head.appendChild(tagMeta);
            });
        }

        // Twitter Card tags
        const twitterTags = {
            'twitter:card': 'summary_large_image',
            'twitter:site': '@specifysai',
            'twitter:creator': '@specifysai',
            'twitter:title': articleTitle,
            'twitter:description': articleDescription,
            'twitter:image': articleImage
        };

        // Update or create Twitter Card tags
        Object.keys(twitterTags).forEach(key => {
            let twitterTag = document.querySelector(`meta[name="${key}"]`);
            if (!twitterTag) {
                twitterTag = document.createElement('meta');
                twitterTag.setAttribute('name', key);
                document.head.appendChild(twitterTag);
            }
            twitterTag.setAttribute('content', twitterTags[key]);
        });

        // Add Structured Data (JSON-LD)
        this.addStructuredData(article, articleUrl, publishedDate);
    }

    // Add Structured Data (JSON-LD) for SEO
    addStructuredData(article, articleUrl, publishedDate) {
        // Remove existing article structured data if any
        const existingScript = document.querySelector('script[type="application/ld+json"][data-article-seo]');
        if (existingScript) {
            existingScript.remove();
        }

        const articleTitle = article.seo_title || article.title || article.short_title || 'Article';
        const articleDescription = article.description_160 || article.teaser_90 || '';
        const tags = article.tags || [];

        let datePublished = null;
        let dateModified = null;
        
        if (publishedDate) {
            const dateObj = publishedDate instanceof Date ? publishedDate : 
                          (publishedDate.toDate ? publishedDate.toDate() : new Date(publishedDate));
            if (!isNaN(dateObj.getTime())) {
                datePublished = dateObj.toISOString();
                dateModified = dateObj.toISOString();
            }
        }

        const structuredData = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": articleTitle,
            "description": articleDescription,
            "url": articleUrl,
            "author": {
                "@type": "Organization",
                "name": "Specifys.ai",
                "url": "https://specifys-ai.com"
            },
            "publisher": {
                "@type": "Organization",
                "name": "Specifys.ai",
                "logo": {
                    "@type": "ImageObject",
                    "url": "https://specifys-ai.com/favicon.ico"
                }
            },
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": articleUrl
            }
        };

        if (datePublished) {
            structuredData.datePublished = datePublished;
        }
        if (dateModified) {
            structuredData.dateModified = dateModified;
        }
        if (tags.length > 0) {
            structuredData.keywords = tags.join(', ');
        }

        const script = document.createElement('script');
        script.setAttribute('type', 'application/ld+json');
        script.setAttribute('data-article-seo', 'true');
        script.textContent = JSON.stringify(structuredData);
        document.head.appendChild(script);
    }

    // Render article
    async renderArticle(article) {
        const articleContent = document.getElementById('article-content');
        if (!articleContent) return;

        // Update SEO tags first
        this.updateSEOTags(article);

        const date = this.formatDate(article.publishedAt || article.createdAt);
        const views = article.views || 0;

        // Load marked.js for markdown rendering
        let markedLib = null;
        if (typeof marked !== 'undefined') {
            markedLib = marked;
        } else {
            // Try to load marked.js dynamically
            try {
                const module = await import('https://cdn.jsdelivr.net/npm/marked@11.2.0/lib/marked.esm.js');
                markedLib = module.marked || module.default || null;
            } catch (e) {
                // Failed to load marked.js
            }
        }

        // Convert markdown to HTML
        let contentHtml = '';
        if (markedLib && article.content_markdown) {
            try {
                if (typeof markedLib === 'function') {
                    contentHtml = markedLib(article.content_markdown);
                } else if (typeof markedLib.parse === 'function') {
                    contentHtml = markedLib.parse(article.content_markdown);
                } else {
                    contentHtml = `<pre>${this.escapeHTML(article.content_markdown)}</pre>`;
                }
            } catch (e) {
                // Error parsing markdown
                contentHtml = `<pre>${this.escapeHTML(article.content_markdown)}</pre>`;
            }
        } else if (article.content_markdown) {
            contentHtml = `<pre>${this.escapeHTML(article.content_markdown)}</pre>`;
        }

        // Render article HTML
        articleContent.innerHTML = `
            <header class="article-header">
                <div class="article-meta">
                    <div class="article-meta-left">
                        <span class="article-date">${date}</span>
                        ${views > 0 ? `<span class="article-views"><i class="fas fa-eye"></i> ${views}</span>` : ''}
                    </div>
                    <a href="/pages/articles.html" class="back-to-articles-btn">
                        <i class="fas fa-arrow-left"></i>
                        <span>Back to Articles</span>
                    </a>
                </div>
                ${article.tags && article.tags.length > 0 ? `
                    <div class="article-tags">
                        ${article.tags.map(tag => `<span class="tag">${this.escapeHTML(tag)}</span>`).join('')}
                    </div>
                ` : ''}
                <h1 class="article-title">${this.escapeHTML(article.title || article.short_title || 'Untitled')}</h1>
                ${article.description_160 ? `<p class="article-description">${this.escapeHTML(article.description_160)}</p>` : ''}
            </header>
            <div class="article-body">
                ${contentHtml}
            </div>
        `;

        // Initialize Mermaid diagrams if available
        if (typeof mermaid !== 'undefined') {
            const mermaidElements = articleContent.querySelectorAll('.mermaid, pre code.language-mermaid');
            if (mermaidElements.length > 0) {
                mermaid.initialize({ startOnLoad: true });
                mermaid.init(undefined, mermaidElements);
            }
        }
    }

    // Update view count
    async updateViewCount() {
        if (!this.slug) return;

        try {
            const apiBaseUrl = this.getApiBaseUrl();
            await fetch(`${apiBaseUrl}/api/articles/${this.slug}/view`, {
                method: 'POST'
            });
            // Don't wait for response or show errors - view tracking is non-critical
        } catch (error) {
            // Silently fail - view tracking is not critical
            // View count update failed
        }
    }

    // Load related articles
    async loadRelatedArticles() {
        if (!this.article) return;

        const relatedSection = document.getElementById('related-articles');
        const relatedGrid = document.getElementById('related-articles-grid');
        
        if (!relatedSection || !relatedGrid) return;

        try {
            const apiBaseUrl = this.getApiBaseUrl();
            const response = await fetch(`${apiBaseUrl}/api/articles/list?status=published&limit=4`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.articles) {
                // Filter out current article and get up to 3 related articles
                const related = result.articles
                    .filter(a => a.slug !== this.slug)
                    .slice(0, 3);

                if (related.length > 0) {
                    this.renderRelatedArticles(related);
                    relatedSection.style.display = 'block';
                }
            }
        } catch (error) {
            // Error loading related articles - optional feature
        }
    }

    // Render related articles
    renderRelatedArticles(articles) {
        const relatedGrid = document.getElementById('related-articles-grid');
        if (!relatedGrid) return;

        relatedGrid.innerHTML = articles.map(article => {
            const date = this.formatDate(article.publishedAt || article.createdAt);
            const teaser = article.teaser_90 || article.description_160 || '';

            return `
                <article class="related-article-card">
                    <div class="related-article-meta">
                        <span class="related-article-date">${date}</span>
                    </div>
                    <h3 class="related-article-title">
                        <a href="/article.html?slug=${article.slug}">${this.escapeHTML(article.title || article.short_title || 'Untitled')}</a>
                    </h3>
                    ${teaser ? `<p class="related-article-teaser">${this.escapeHTML(teaser)}</p>` : ''}
                    <a href="/article.html?slug=${article.slug}" class="related-article-link">
                        Read More <i class="fas fa-arrow-right"></i>
                    </a>
                </article>
            `;
        }).join('');
    }

    // Show error
    showError(message) {
        const articleContent = document.getElementById('article-content');
        if (articleContent) {
            articleContent.innerHTML = `
                <div class="article-error">
                    <h2>Error Loading Article</h2>
                    <p>${this.escapeHTML(message)}</p>
                    <a href="/pages/articles.html" class="btn-back">Back to Articles</a>
                </div>
            `;
        }
    }

    // Utility: Escape HTML
    escapeHTML(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Utility: Format date
    formatDate(date) {
        if (!date) return '—';
        
        let dateObj;
        if (date instanceof Date) {
            dateObj = date;
        } else if (date.toDate) {
            dateObj = date.toDate();
        } else {
            dateObj = new Date(date);
        }

        if (isNaN(dateObj.getTime())) {
            return '—';
        }

        return dateObj.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// Initialize article page
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ArticlePage();
    });
} else {
    new ArticlePage();
}

