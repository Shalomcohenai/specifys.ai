// Articles Manager JavaScript
// Manages article generation and management in the admin dashboard

class ArticlesManager {
    constructor() {
        this.form = null;
        this.articles = [];
        this.filteredArticles = [];
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }

    setup() {
        // Get DOM elements
        this.form = document.getElementById('articles-form');
        this.tableBody = document.querySelector('#articles-table tbody');
        this.searchInput = document.getElementById('articles-search');
        this.statusFilter = document.getElementById('articles-status-filter');
        this.refreshBtn = document.getElementById('refresh-articles-btn');
        this.feedback = document.getElementById('articles-feedback');
        
        // Only initialize if articles section exists
        const articlesSection = document.getElementById('articles-section');
        if (!articlesSection) {
            return; // Articles section not visible yet
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Load existing articles
        this.loadArticles();
    }

    setupEventListeners() {
        // Form submission
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Search input
        if (this.searchInput) {
            this.searchInput.addEventListener('input', () => this.filterArticles());
        }

        // Status filter
        if (this.statusFilter) {
            this.statusFilter.addEventListener('change', () => this.filterArticles());
        }

        // Refresh button
        if (this.refreshBtn) {
            this.refreshBtn.addEventListener('click', () => this.loadArticles());
        }

        // Listen for section visibility changes (when user switches tabs)
        const observer = new MutationObserver(() => {
            const articlesSection = document.getElementById('articles-section');
            if (articlesSection && articlesSection.classList.contains('active')) {
                // Section is now visible, ensure setup is complete
                if (!this.form || !this.tableBody) {
                    this.setup();
                }
                this.loadArticles();
            }
        });

        const adminContent = document.getElementById('admin-content');
        if (adminContent) {
            observer.observe(adminContent, {
                attributes: true,
                attributeFilter: ['class'],
                subtree: true
            });
        }
    }

    // Handle form submission
    async handleFormSubmit(e) {
        e.preventDefault();

        const topicInput = document.getElementById('article-topic');
        const topic = topicInput?.value.trim();

        if (!topic) {
            this.setFeedback('Please enter a topic for the article', 'error');
            return;
        }

        // Show loading state
        const submitBtn = document.getElementById('generate-article-btn');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        submitBtn.disabled = true;

        try {
            const apiBaseUrl = this.getApiBaseUrl();
            const token = await this.getAuthToken();

            const response = await fetch(`${apiBaseUrl}/api/articles/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ topic })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || result.message || `HTTP ${response.status}`);
            }

            if (result.success) {
                this.setFeedback('Article generated successfully!', 'success');
                topicInput.value = '';
                
                // Reload articles after a short delay
                setTimeout(() => {
                    this.loadArticles();
                }, 1000);
            } else {
                throw new Error(result.error || result.message || 'Failed to generate article');
            }
        } catch (error) {
            console.error('Error generating article:', error);
            this.setFeedback(`Error: ${error.message}`, 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    // Load articles from API
    async loadArticles() {
        if (!this.tableBody) return;

        this.tableBody.innerHTML = '<tr><td colspan="5" class="table-empty">Loading articles…</td></tr>';

        try {
            const apiBaseUrl = this.getApiBaseUrl();
            const response = await fetch(`${apiBaseUrl}/api/articles/list?status=all&limit=100`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                this.articles = result.articles || [];
                this.filterArticles();
            } else {
                throw new Error(result.error || result.message || 'Failed to load articles');
            }
        } catch (error) {
            console.error('Error loading articles:', error);
            this.tableBody.innerHTML = `<tr><td colspan="5" class="table-empty" style="color: #ff6b6b;">Error loading articles: ${error.message}</td></tr>`;
        }
    }

    // Filter articles
    filterArticles() {
        const searchTerm = this.searchInput?.value.toLowerCase() || '';
        const statusFilter = this.statusFilter?.value || 'all';

        this.filteredArticles = this.articles.filter(article => {
            const matchesSearch = !searchTerm || 
                article.title?.toLowerCase().includes(searchTerm) ||
                article.topic?.toLowerCase().includes(searchTerm) ||
                article.tags?.some(tag => tag.toLowerCase().includes(searchTerm));
            
            const matchesStatus = statusFilter === 'all' || article.status === statusFilter;

            return matchesSearch && matchesStatus;
        });

        this.renderArticlesTable();
    }

    // Render articles table
    renderArticlesTable() {
        if (!this.tableBody) return;

        if (this.filteredArticles.length === 0) {
            this.tableBody.innerHTML = '<tr><td colspan="5" class="table-empty">No articles found</td></tr>';
            return;
        }

        this.tableBody.innerHTML = this.filteredArticles.map(article => {
            const statusBadge = this.getStatusBadge(article.status);
            const createdAt = this.formatDate(article.createdAt);
            const views = article.views || 0;

            return `
                <tr>
                    <td>
                        <strong>${this.escapeHTML(article.title || 'Untitled')}</strong>
                        ${article.topic ? `<br><small style="color: #666;">Topic: ${this.escapeHTML(article.topic)}</small>` : ''}
                    </td>
                    <td>${statusBadge}</td>
                    <td>${createdAt}</td>
                    <td>${views}</td>
                    <td>
                        <div class="action-buttons">
                            ${article.status === 'published' ? `
                                <button class="action-btn" onclick="articlesManager.viewArticle('${article.slug}')" title="View Article">
                                    <i class="fas fa-eye"></i>
                                </button>
                            ` : ''}
                            <button class="action-btn" onclick="articlesManager.editArticle('${article.id}')" title="Edit Article">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn critical" onclick="articlesManager.deleteArticle('${article.id}')" title="Delete Article">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Get status badge HTML
    getStatusBadge(status) {
        const badges = {
            'published': '<span class="status-badge status-published">Published</span>',
            'generating': '<span class="status-badge status-generating">Generating</span>',
            'draft': '<span class="status-badge status-draft">Draft</span>'
        };
        return badges[status] || `<span class="status-badge">${status || 'Unknown'}</span>`;
    }

    // View article
    viewArticle(slug) {
        window.open(`/article.html?slug=${slug}`, '_blank');
    }

    // Edit article
    async editArticle(id) {
        const article = this.articles.find(a => a.id === id);
        if (!article) {
            this.setFeedback('Article not found', 'error');
            return;
        }

        // Simple edit: toggle status between published and draft
        const newStatus = article.status === 'published' ? 'draft' : 'published';
        
        try {
            const apiBaseUrl = this.getApiBaseUrl();
            const token = await this.getAuthToken();

            const response = await fetch(`${apiBaseUrl}/api/articles/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            const result = await response.json();

            if (result.success) {
                this.setFeedback(`Article status updated to ${newStatus}`, 'success');
                this.loadArticles();
            } else {
                throw new Error(result.error || result.message || 'Failed to update article');
            }
        } catch (error) {
            console.error('Error updating article:', error);
            this.setFeedback(`Error: ${error.message}`, 'error');
        }
    }

    // Delete article
    async deleteArticle(id) {
        const article = this.articles.find(a => a.id === id);
        if (!article) {
            this.setFeedback('Article not found', 'error');
            return;
        }

        if (!confirm(`Are you sure you want to delete "${article.title || 'this article'}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const apiBaseUrl = this.getApiBaseUrl();
            const token = await this.getAuthToken();

            const response = await fetch(`${apiBaseUrl}/api/articles/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (result.success) {
                this.setFeedback('Article deleted successfully', 'success');
                this.loadArticles();
            } else {
                throw new Error(result.error || result.message || 'Failed to delete article');
            }
        } catch (error) {
            console.error('Error deleting article:', error);
            this.setFeedback(`Error: ${error.message}`, 'error');
        }
    }

    // Set feedback message
    setFeedback(message, type = 'success') {
        if (!this.feedback) return;

        this.feedback.textContent = message;
        this.feedback.className = `form-feedback ${type}`;
        this.feedback.style.display = 'block';

        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (this.feedback) {
                this.feedback.style.display = 'none';
            }
        }, 5000);
    }

    // Get API base URL
    getApiBaseUrl() {
        if (window.getApiBaseUrl) {
            return window.getApiBaseUrl();
        }
        // Try to detect from current location
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:10000';
        }
        return 'https://specifys-ai.onrender.com';
    }

    // Get auth token
    async getAuthToken() {
        // Try to get token from Firebase Auth (admin-dashboard.js uses Firebase Auth)
        try {
            // Check if auth is available from admin-dashboard.js
            // admin-dashboard.js exports auth as a const, so we need to access it via window or import
            if (typeof auth !== 'undefined' && auth && auth.currentUser) {
                return await auth.currentUser.getIdToken();
            }
            
            // Try to import Firebase Auth
            const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
            const { getApps } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
            
            const apps = getApps();
            if (apps.length > 0) {
                const authInstance = getAuth(apps[0]);
                if (authInstance && authInstance.currentUser) {
                    return await authInstance.currentUser.getIdToken();
                }
            }
        } catch (e) {
            console.warn('Failed to get auth token:', e);
        }

        throw new Error('Not authenticated. Please sign in.');
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
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// Initialize articles manager
let articlesManager;

// Wait for page to be ready and admin dashboard to be initialized
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Wait a bit for admin-dashboard.js to initialize
        setTimeout(() => {
            articlesManager = new ArticlesManager();
            window.articlesManager = articlesManager; // Make available globally
        }, 500);
    });
} else {
    setTimeout(() => {
        articlesManager = new ArticlesManager();
        window.articlesManager = articlesManager; // Make available globally
    }, 500);
}

