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
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:10000';
        }
        return 'https://specifys-ai.onrender.com';
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
            console.error('Error loading article:', error);
            this.showError(error.message);
        }
    }

    // Render article
    async renderArticle(article) {
        const articleContent = document.getElementById('article-content');
        if (!articleContent) return;

        // Update page title
        document.title = `${article.title || article.short_title || 'Article'} - Specifys.ai`;
        
        // Update meta description
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && article.description_160) {
            metaDesc.content = article.description_160;
        }

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
                console.warn('Failed to load marked.js:', e);
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
                console.error('Error parsing markdown:', e);
                contentHtml = `<pre>${this.escapeHTML(article.content_markdown)}</pre>`;
            }
        } else if (article.content_markdown) {
            contentHtml = `<pre>${this.escapeHTML(article.content_markdown)}</pre>`;
        }

        // Render article HTML
        articleContent.innerHTML = `
            <header class="article-header">
                <div class="article-meta">
                    <span class="article-date">${date}</span>
                    ${views > 0 ? `<span class="article-views"><i class="fas fa-eye"></i> ${views}</span>` : ''}
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
            console.debug('View count update failed:', error);
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
            console.error('Error loading related articles:', error);
            // Don't show error - related articles are optional
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
                    <a href="/articles.html" class="btn-back">Back to Articles</a>
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

