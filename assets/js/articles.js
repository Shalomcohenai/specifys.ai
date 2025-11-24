// Articles JavaScript - List page functionality

class ArticlesPage {
    constructor() {
        this.currentPage = 1;
        this.pageSize = 12;
        this.totalPages = 1;
        this.featuredArticles = [];
        this.allArticles = [];
        this.carouselIndex = 0;
        this.carouselInterval = null;
        
        this.init();
    }

    init() {
        // Wait for DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        // Setup carousel controls
        const prevBtn = document.getElementById('carousel-prev');
        const nextBtn = document.getElementById('carousel-next');
        
        if (prevBtn) prevBtn.addEventListener('click', () => this.carouselPrev());
        if (nextBtn) nextBtn.addEventListener('click', () => this.carouselNext());
        
        // Setup pagination
        const paginationPrev = document.getElementById('pagination-prev');
        const paginationNext = document.getElementById('pagination-next');
        
        if (paginationPrev) paginationPrev.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        if (paginationNext) paginationNext.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        
        // Load data
        this.loadFeaturedArticles();
        this.loadArticles(1);
    }

    // Get API base URL
    getApiBaseUrl() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:10000';
        }
        return 'https://specifys-ai.onrender.com';
    }

    // Load featured articles for carousel
    async loadFeaturedArticles() {
        const carouselTrack = document.getElementById('carousel-track');
        if (!carouselTrack) return;

        try {
            const apiBaseUrl = this.getApiBaseUrl();
            const response = await fetch(`${apiBaseUrl}/api/articles/featured?limit=5`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.articles && result.articles.length > 0) {
                this.featuredArticles = result.articles;
                this.renderCarousel(this.featuredArticles);
                this.startCarouselAutoPlay();
            } else {
                carouselTrack.innerHTML = '<div class="carousel-placeholder">No featured articles available</div>';
            }
        } catch (error) {
            console.error('Error loading featured articles:', error);
            carouselTrack.innerHTML = '<div class="carousel-placeholder">Error loading featured articles</div>';
        }
    }

    // Render carousel
    renderCarousel(articles) {
        const carouselTrack = document.getElementById('carousel-track');
        const indicators = document.getElementById('carousel-indicators');
        
        if (!carouselTrack) return;

        if (articles.length === 0) {
            carouselTrack.innerHTML = '<div class="carousel-placeholder">No featured articles available</div>';
            return;
        }

        carouselTrack.innerHTML = articles.map((article, index) => {
            const date = this.formatDate(article.publishedAt || article.createdAt);
            const teaser = article.teaser_90 || article.description_160 || '';
            
            return `
                <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
                    <div class="carousel-slide-content">
                        <div class="carousel-slide-image">
                            <div class="carousel-slide-overlay"></div>
                        </div>
                        <div class="carousel-slide-text">
                            <div class="carousel-slide-meta">
                                <span class="carousel-slide-date">${date}</span>
                                ${article.tags && article.tags.length > 0 ? `
                                    <span class="carousel-slide-tags">
                                        ${article.tags.slice(0, 2).map(tag => `<span class="tag">${this.escapeHTML(tag)}</span>`).join('')}
                                    </span>
                                ` : ''}
                            </div>
                            <h3 class="carousel-slide-title">
                                <a href="/article.html?slug=${article.slug}">${this.escapeHTML(article.title || article.short_title || 'Untitled')}</a>
                            </h3>
                            ${teaser ? `<p class="carousel-slide-teaser">${this.escapeHTML(teaser)}</p>` : ''}
                            <a href="/article.html?slug=${article.slug}" class="carousel-slide-link">
                                Read More <i class="fas fa-arrow-right"></i>
                            </a>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Render indicators
        if (indicators && articles.length > 1) {
            indicators.innerHTML = articles.map((_, index) => 
                `<button class="carousel-indicator ${index === 0 ? 'active' : ''}" data-index="${index}" aria-label="Go to slide ${index + 1}"></button>`
            ).join('');
            
            // Add click handlers for indicators
            indicators.querySelectorAll('.carousel-indicator').forEach(btn => {
                btn.addEventListener('click', () => {
                    const index = parseInt(btn.dataset.index);
                    this.goToSlide(index);
                });
            });
        }

        this.carouselIndex = 0;
    }

    // Carousel navigation
    carouselPrev() {
        if (this.featuredArticles.length === 0) return;
        const newIndex = (this.carouselIndex - 1 + this.featuredArticles.length) % this.featuredArticles.length;
        this.goToSlide(newIndex);
    }

    carouselNext() {
        if (this.featuredArticles.length === 0) return;
        const newIndex = (this.carouselIndex + 1) % this.featuredArticles.length;
        this.goToSlide(newIndex);
    }

    goToSlide(index) {
        if (this.featuredArticles.length === 0) return;
        
        this.carouselIndex = index;
        const carouselTrack = document.getElementById('carousel-track');
        const indicators = document.getElementById('carousel-indicators');
        
        if (carouselTrack) {
            const slides = carouselTrack.querySelectorAll('.carousel-slide');
            slides.forEach((slide, i) => {
                slide.classList.toggle('active', i === index);
            });
        }
        
        if (indicators) {
            const indicatorBtns = indicators.querySelectorAll('.carousel-indicator');
            indicatorBtns.forEach((btn, i) => {
                btn.classList.toggle('active', i === index);
            });
        }
        
        // Reset auto-play timer
        this.startCarouselAutoPlay();
    }

    // Start carousel auto-play
    startCarouselAutoPlay() {
        if (this.carouselInterval) {
            clearInterval(this.carouselInterval);
        }
        
        if (this.featuredArticles.length > 1) {
            this.carouselInterval = setInterval(() => {
                this.carouselNext();
            }, 5000); // Auto-advance every 5 seconds
        }
    }

    // Load articles with pagination
    async loadArticles(page = 1) {
        const articlesGrid = document.getElementById('articles-grid');
        if (!articlesGrid) return;

        this.currentPage = page;
        articlesGrid.innerHTML = '<div class="loading-placeholder">Loading articles...</div>';

        try {
            const apiBaseUrl = this.getApiBaseUrl();
            const response = await fetch(`${apiBaseUrl}/api/articles/list?page=${page}&limit=${this.pageSize}&status=published`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.allArticles = result.articles || [];
                this.totalPages = result.pagination?.totalPages || 1;
                this.renderArticlesGrid(this.allArticles);
                this.renderPagination();
            } else {
                throw new Error(result.error || result.message || 'Failed to load articles');
            }
        } catch (error) {
            console.error('Error loading articles:', error);
            articlesGrid.innerHTML = `<div class="loading-placeholder error">Error loading articles: ${error.message}</div>`;
        }
    }

    // Render articles grid
    renderArticlesGrid(articles) {
        const articlesGrid = document.getElementById('articles-grid');
        if (!articlesGrid) return;

        if (articles.length === 0) {
            articlesGrid.innerHTML = '<div class="loading-placeholder">No articles found</div>';
            return;
        }

        articlesGrid.innerHTML = articles.map(article => {
            const date = this.formatDate(article.publishedAt || article.createdAt);
            const teaser = article.teaser_90 || article.description_160 || '';
            const views = article.views || 0;

            return `
                <article class="article-card">
                    <div class="article-card-header">
                        <div class="article-card-meta">
                            <span class="article-card-date">${date}</span>
                            ${views > 0 ? `<span class="article-card-views"><i class="fas fa-eye"></i> ${views}</span>` : ''}
                        </div>
                        ${article.tags && article.tags.length > 0 ? `
                            <div class="article-card-tags">
                                ${article.tags.slice(0, 3).map(tag => `<span class="tag">${this.escapeHTML(tag)}</span>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                    <h3 class="article-card-title">
                        <a href="/article.html?slug=${article.slug}">${this.escapeHTML(article.title || article.short_title || 'Untitled')}</a>
                    </h3>
                    ${teaser ? `<p class="article-card-teaser">${this.escapeHTML(teaser)}</p>` : ''}
                    <a href="/article.html?slug=${article.slug}" class="article-card-link">
                        Read More <i class="fas fa-arrow-right"></i>
                    </a>
                </article>
            `;
        }).join('');
    }

    // Render pagination
    renderPagination() {
        const paginationWrapper = document.getElementById('pagination-wrapper');
        const paginationInfo = document.getElementById('pagination-info');
        const paginationPages = document.getElementById('pagination-pages');
        const paginationPrev = document.getElementById('pagination-prev');
        const paginationNext = document.getElementById('pagination-next');

        if (!paginationWrapper) return;

        if (this.totalPages <= 1) {
            paginationWrapper.style.display = 'none';
            return;
        }

        paginationWrapper.style.display = 'block';

        // Update info
        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.allArticles.length);
        if (paginationInfo) {
            paginationInfo.textContent = `Showing ${start}-${end} of ${this.allArticles.length}`;
        }

        // Update prev/next buttons
        if (paginationPrev) {
            paginationPrev.disabled = this.currentPage === 1;
        }
        if (paginationNext) {
            paginationNext.disabled = this.currentPage === this.totalPages;
        }

        // Render page numbers
        if (paginationPages) {
            const pages = [];
            const maxVisible = 5;
            let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
            let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);

            if (endPage - startPage < maxVisible - 1) {
                startPage = Math.max(1, endPage - maxVisible + 1);
            }

            if (startPage > 1) {
                pages.push(`<button class="pagination-page" onclick="articlesPage.goToPage(1)">1</button>`);
                if (startPage > 2) {
                    pages.push('<span class="pagination-ellipsis">...</span>');
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                pages.push(`
                    <button class="pagination-page ${i === this.currentPage ? 'active' : ''}" 
                            onclick="articlesPage.goToPage(${i})">
                        ${i}
                    </button>
                `);
            }

            if (endPage < this.totalPages) {
                if (endPage < this.totalPages - 1) {
                    pages.push('<span class="pagination-ellipsis">...</span>');
                }
                pages.push(`<button class="pagination-page" onclick="articlesPage.goToPage(${this.totalPages})">${this.totalPages}</button>`);
            }

            paginationPages.innerHTML = pages.join('');
        }
    }

    // Navigate to page
    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;
        this.loadArticles(page);
        
        // Scroll to top of articles section
        const articlesSection = document.querySelector('.articles-latest');
        if (articlesSection) {
            articlesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // Navigate to article
    navigateToArticle(slug) {
        window.location.href = `/article.html?slug=${slug}`;
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

// Initialize articles page
let articlesPage;
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        articlesPage = new ArticlesPage();
        window.articlesPage = articlesPage; // Make available globally
    });
} else {
    articlesPage = new ArticlesPage();
    window.articlesPage = articlesPage; // Make available globally
}

