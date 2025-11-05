// Blog Manager JavaScript
// Manages blog post creation and management in the admin dashboard

class BlogManager {
    constructor() {
        this.form = null;
        this.formContainer = null;
        this.previewModal = null;
        this.posts = [];
        this.init();
    }

    init() {
        // Get DOM elements
        this.form = document.getElementById('create-post-form');
        this.formContainer = document.getElementById('post-form-container');
        this.previewModal = document.getElementById('preview-modal');
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Set default date to today
        const dateInput = document.getElementById('post-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        
        // Load existing posts
        this.loadPosts();
    }

    setupEventListeners() {
        // Form submission
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        }

        // Character counter for description
        const descInput = document.getElementById('post-description');
        if (descInput) {
            descInput.addEventListener('input', () => this.updateCharCount());
        }

        // Search and filters
        const searchInput = document.getElementById('posts-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.filterPosts());
        }

        const dateFrom = document.getElementById('posts-date-from');
        const dateTo = document.getElementById('posts-date-to');
        if (dateFrom) dateFrom.addEventListener('change', () => this.filterPosts());
        if (dateTo) dateTo.addEventListener('change', () => this.filterPosts());
    }

    // Toggle form visibility
    toggleForm() {
        if (!this.formContainer) return;
        
        const isVisible = this.formContainer.style.display !== 'none';
        this.formContainer.style.display = isVisible ? 'none' : 'block';
        
        const btn = document.getElementById('toggle-form-btn');
        if (btn) {
            btn.innerHTML = isVisible 
                ? '<i class="fas fa-plus"></i> New Post'
                : '<i class="fas fa-minus"></i> Close Form';
        }
    }

    // Update character count for description
    updateCharCount() {
        const descInput = document.getElementById('post-description');
        const charCount = document.getElementById('desc-char-count');
        
        if (descInput && charCount) {
            const count = descInput.value.length;
            charCount.textContent = count;
            charCount.style.color = count > 160 ? '#ff6b6b' : '#667eea';
        }
    }

    // Insert markdown formatting
    insertMarkdown(before, after = '') {
        const textarea = document.getElementById('post-content');
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selectedText = text.substring(start, end);

        const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
        textarea.value = newText;

        // Set cursor position
        const newCursorPos = start + before.length + selectedText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
    }

    // Preview post
    async previewPost() {
        const title = document.getElementById('post-title').value;
        const content = document.getElementById('post-content').value;
        
        if (!title || !content) {
            this.showMessage('Please fill in title and content to preview', 'error');
            return;
        }

        // Render markdown to HTML using marked.js
        const previewContent = document.getElementById('preview-content');
        if (previewContent && typeof marked !== 'undefined') {
            const html = `
                <h1>${this.escapeHTML(title)}</h1>
                ${marked.parse(content)}
            `;
            previewContent.innerHTML = html;
        }

        // Show modal
        if (this.previewModal) {
            this.previewModal.style.display = 'flex';
        }
    }

    // Close preview modal
    closePreviewModal() {
        if (this.previewModal) {
            this.previewModal.style.display = 'none';
        }
    }

    // Handle form submission
    async handleFormSubmit(e) {
        e.preventDefault();

        const formData = {
            title: document.getElementById('post-title').value,
            description: document.getElementById('post-description').value,
            date: document.getElementById('post-date').value,
            author: document.getElementById('post-author').value || 'specifys.ai Team',
            tags: document.getElementById('post-tags').value,
            content: document.getElementById('post-content').value
        };

        // Validate
        if (!formData.title || !formData.description || !formData.date || !formData.content) {
            this.showMessage('Please fill in all required fields', 'error');
            return;
        }

        if (formData.description.length > 160) {
            this.showMessage('Description must be 160 characters or less', 'error');
            return;
        }

        // Show loading state
        const submitBtn = this.form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';
        submitBtn.disabled = true;

        try {
            // Send to backend
            const apiBaseUrl = (typeof window.getApiBaseUrl === 'function') ? window.getApiBaseUrl() : (window.API_BASE_URL || 'http://localhost:10000');
            const response = await fetch(`${apiBaseUrl}/api/blog/create-post`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Post published successfully! It will appear on your blog shortly.', 'success');
                this.resetForm();
                this.loadPosts();
                this.toggleForm();
            } else {
                throw new Error(result.error || 'Failed to publish post');
            }
        } catch (error) {

            this.showMessage(`Error: ${error.message}`, 'error');
        } finally {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }

    // Reset form
    resetForm() {
        if (this.form) {
            this.form.reset();
            const dateInput = document.getElementById('post-date');
            if (dateInput) {
                dateInput.value = new Date().toISOString().split('T')[0];
            }
            this.updateCharCount();
        }
    }

    // Load existing posts
    async loadPosts() {
        const tbody = document.getElementById('posts-table-body');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">Loading posts...</td></tr>';

        try {
            // For now, show a simple message that blog management is disabled
            // This prevents the API error and simplifies the interface
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="loading-cell" style="color: #666; font-style: italic;">
                        Blog management is currently disabled. 
                        Posts are managed through the _posts directory.
                    </td>
                </tr>
            `;
            
            // Initialize empty posts array
            this.posts = [];
            
        } catch (error) {

            tbody.innerHTML = `<tr><td colspan="5" class="loading-cell" style="color: #ff6b6b;">Blog management disabled</td></tr>`;
        }
    }

    // Render posts in table
    renderPosts(posts) {
        const tbody = document.getElementById('posts-table-body');
        if (!tbody) return;

        if (posts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-cell">No posts found</td></tr>';
            return;
        }

        tbody.innerHTML = posts.map(post => `
            <tr>
                <td>
                    <strong>${this.escapeHTML(post.title)}</strong>
                    <br>
                    <small style="color: #a0a0a0;">${this.escapeHTML(post.description || '')}</small>
                </td>
                <td>${this.formatDate(post.date)}</td>
                <td>${this.escapeHTML(post.author || 'specifys.ai Team')}</td>
                <td>
                    ${post.tags ? post.tags.split(',').map(tag => 
                        `<span class="tag" style="background: rgba(102, 126, 234, 0.2); color: #667eea; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem; margin-right: 0.25rem;">${this.escapeHTML(tag.trim())}</span>`
                    ).join('') : ''}
                </td>
                <td>
                    <button class="action-btn" onclick="window.open('${post.url}', '_blank')" title="View Post">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button class="action-btn delete" onclick="blogManager.deletePost('${this.escapeHTML(post.filename)}')" title="Delete Post">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Filter posts
    filterPosts() {
        const searchTerm = document.getElementById('posts-search')?.value.toLowerCase() || '';
        const dateFrom = document.getElementById('posts-date-from')?.value || '';
        const dateTo = document.getElementById('posts-date-to')?.value || '';

        const filtered = this.posts.filter(post => {
            const matchesSearch = post.title.toLowerCase().includes(searchTerm) ||
                                 (post.description && post.description.toLowerCase().includes(searchTerm));
            
            const matchesDateFrom = !dateFrom || post.date >= dateFrom;
            const matchesDateTo = !dateTo || post.date <= dateTo;

            return matchesSearch && matchesDateFrom && matchesDateTo;
        });

        this.renderPosts(filtered);
    }

    // Delete post
    async deletePost(filename) {
        if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            return;
        }

        try {
            const apiBaseUrl = (typeof window.getApiBaseUrl === 'function') ? window.getApiBaseUrl() : (window.API_BASE_URL || 'http://localhost:10000');
            const response = await fetch(`${apiBaseUrl}/api/blog/delete-post`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filename })
            });

            const result = await response.json();

            if (result.success) {
                this.showMessage('Post deleted successfully', 'success');
                this.loadPosts();
            } else {
                throw new Error(result.error || 'Failed to delete post');
            }
        } catch (error) {

            this.showMessage(`Error: ${error.message}`, 'error');
        }
    }

    // Show message
    showMessage(message, type = 'success') {
        const container = document.querySelector('.create-post-section');
        if (!container) return;

        // Remove existing messages
        const existing = container.querySelector('.message');
        if (existing) existing.remove();

        // Create new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
            <span>${message}</span>
        `;

        container.insertBefore(messageDiv, container.firstChild);

        // Auto remove after 5 seconds
        setTimeout(() => messageDiv.remove(), 5000);
    }

    // Utility: Escape HTML
    escapeHTML(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Utility: Format date
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
}

// Note: BlogManager is initialized in admin-dashboard.html after auth check
// Do not auto-initialize here to avoid conflicts

