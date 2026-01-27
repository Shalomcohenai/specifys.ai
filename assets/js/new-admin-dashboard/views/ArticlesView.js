/**
 * Articles View - Complete articles management
 * Create, edit, and manage blog articles with view tracking
 */

import { helpers } from '../utils/helpers.js';
import { apiService } from '../services/ApiService.js';

export class ArticlesView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.table = null;
    this.articles = [];
    this.currentFilter = 'all';
    
    this.init();
  }
  
  /**
   * Initialize view
   */
  init() {
    this.table = helpers.dom('#articles-table tbody');
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Don't load articles automatically - wait for show() to be called
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Form submission
    const form = helpers.dom('#articles-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit();
      });
    }
    
    // Search
    const searchInput = helpers.dom('#articles-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', helpers.debounce(() => {
        this.render();
      }, 300));
    }
    
    // Status filter
    const statusFilter = helpers.dom('#articles-status-filter-select');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.render();
      });
    }
    
    // Refresh button
    const refreshBtn = helpers.dom('#refresh-articles-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadArticles();
      });
    }
    
    // Run automation button
    const runBtn = helpers.dom('#run-article-automation-btn');
    if (runBtn) {
      runBtn.addEventListener('click', () => {
        this.runAutomation();
      });
    }
    
    // View logs button
    const logsBtn = helpers.dom('#view-article-automation-logs-btn');
    if (logsBtn) {
      logsBtn.addEventListener('click', () => {
        this.viewAutomationLogs();
      });
    }
  }
  
  /**
   * Handle form submission
   */
  async handleFormSubmit() {
    const topicInput = helpers.dom('#article-topic');
    const topic = topicInput?.value.trim();
    
    if (!topic) {
      this.setFeedback('Please enter a topic for the article', 'error');
      return;
    }
    
    const submitBtn = helpers.dom('#generate-article-btn');
    const originalHTML = submitBtn?.innerHTML || '';
    
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    }
    
    try {
      // window.api already includes baseUrl, so just use the endpoint
      const result = await window.api.post('/api/articles/generate', { topic });
      
      if (result.success) {
        this.setFeedback('Article generated successfully! The article is being generated and will appear in the list shortly.', 'success');
        if (topicInput) topicInput.value = '';
        
        // Reload articles after a short delay
        setTimeout(() => {
          this.loadArticles();
        }, 2000);
      } else {
        throw new Error(result.error || result.message || 'Failed to generate article');
      }
    } catch (error) {
      console.error('[ArticlesView] Error generating article:', error);
      this.setFeedback(`Error: ${error.message}`, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
      }
    }
  }
  
  /**
   * Set feedback message
   */
  setFeedback(message, type = 'info') {
    const feedback = helpers.dom('#articles-feedback');
    if (!feedback) return;
    
    feedback.textContent = message;
    feedback.className = `form-feedback ${type}`;
    feedback.style.display = 'block';
    feedback.style.padding = 'var(--spacing-sm) var(--spacing-md)';
    feedback.style.borderRadius = 'var(--radius)';
    feedback.style.marginTop = 'var(--spacing-md)';
    
    if (type === 'success') {
      feedback.style.background = 'rgba(16, 185, 129, 0.1)';
      feedback.style.color = '#10b981';
      feedback.style.border = '1px solid rgba(16, 185, 129, 0.2)';
    } else if (type === 'error') {
      feedback.style.background = 'rgba(239, 68, 68, 0.1)';
      feedback.style.color = '#ef4444';
      feedback.style.border = '1px solid rgba(239, 68, 68, 0.2)';
    } else {
      feedback.style.background = 'rgba(59, 130, 246, 0.1)';
      feedback.style.color = '#3b82f6';
      feedback.style.border = '1px solid rgba(59, 130, 246, 0.2)';
    }
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      feedback.style.display = 'none';
    }, 5000);
  }
  
  /**
   * Load articles from API
   */
  async loadArticles() {
    if (!this.table) return;
    
    this.table.innerHTML = '<tr><td colspan="5" class="table-empty-state">Loading articles...</td></tr>';
    
    try {
      // window.api already includes baseUrl, so just use the endpoint
      const result = await window.api.get('/api/articles/list?status=all&limit=1000');
      
      // API response received
      
      if (result && result.success && result.articles) {
        this.articles = result.articles
          .filter(article => article !== null) // Filter out null entries
          .map(article => ({
            id: article.id,
            title: article.title || 'Untitled',
            status: article.status || 'draft',
            views: article.views || 0,
            createdAt: article.createdAt ? (article.createdAt instanceof Date ? article.createdAt : new Date(article.createdAt)) : new Date(),
            slug: article.slug || '',
            description: article.description || article.description_160 || ''
          }));
        
        // Articles loaded
        this.updateSummary();
        this.render();
      } else {
        // Invalid response structure
        // Try to handle case where articles might be directly in result
        if (result && Array.isArray(result)) {
          this.articles = result.map(article => ({
            id: article.id,
            title: article.title || 'Untitled',
            status: article.status || 'draft',
            views: article.views || 0,
            createdAt: article.createdAt ? (article.createdAt instanceof Date ? article.createdAt : new Date(article.createdAt)) : new Date(),
            slug: article.slug || '',
            description: article.description || article.description_160 || ''
          }));
          this.updateSummary();
          this.render();
        } else {
          throw new Error('Invalid response from server');
        }
      }
    } catch (error) {
      console.error('[ArticlesView] Error loading articles:', error);
      this.table.innerHTML = '<tr><td colspan="5" class="table-empty-state">Error loading articles</td></tr>';
    }
  }
  
  /**
   * Update summary stats
   */
  updateSummary() {
    const totalArticles = this.articles.length;
    const publishedArticles = this.articles.filter(a => a.status === 'published').length;
    const draftArticles = this.articles.filter(a => a.status === 'draft').length;
    const totalViews = this.articles.reduce((sum, a) => sum + (a.views || 0), 0);
    
    this.updateSummaryValue('stat-total-articles', totalArticles);
    this.updateSummaryValue('stat-published-articles', publishedArticles);
    this.updateSummaryValue('stat-draft-articles', draftArticles);
    this.updateSummaryValue('stat-articles-views', totalViews);
  }
  
  /**
   * Update summary value
   */
  updateSummaryValue(id, value) {
    const element = helpers.dom(`#${id}`);
    if (element) {
      element.textContent = typeof value === 'number' ? value.toLocaleString() : value;
    }
  }
  
  /**
   * Render articles table
   */
  render() {
    if (!this.table) {
      // Table element not found
      return;
    }
    
    // Rendering articles
    
    // Apply filters
    let filteredArticles = [...this.articles];
    
    // Search filter
    const searchInput = helpers.dom('#articles-search-input');
    const searchTerm = searchInput?.value.trim().toLowerCase() || '';
    if (searchTerm) {
      filteredArticles = filteredArticles.filter(article => {
        const haystack = `${article.title} ${article.description} ${article.slug}`.toLowerCase();
        return haystack.includes(searchTerm);
      });
    }
    
    // Status filter
    if (this.currentFilter !== 'all') {
      filteredArticles = filteredArticles.filter(article => article.status === this.currentFilter);
    }
    
    // Sort by date (newest first)
    filteredArticles.sort((a, b) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
    
    if (filteredArticles.length === 0) {
      this.table.innerHTML = '<tr><td colspan="5" class="table-empty-state">No articles found</td></tr>';
      return;
    }
    
    // Rendering filtered articles
    
    // Render table
    const html = filteredArticles.map(article => {
      const statusClass = article.status === 'published' ? 'status-paid' : 
                         article.status === 'generating' ? 'status-pending' : 
                         'status-failed';
      
      return `
        <tr>
          <td>
            <div class="user-info">
              <div class="user-name">${this.escapeHtml(article.title)}</div>
              ${article.description ? `<div class="user-email">${this.escapeHtml(article.description.substring(0, 60))}${article.description.length > 60 ? '...' : ''}</div>` : ''}
            </div>
          </td>
          <td><span class="status-badge ${statusClass}">${article.status}</span></td>
          <td>${helpers.formatDate(article.createdAt)}</td>
          <td>${(article.views || 0).toLocaleString()}</td>
          <td>
            <div class="action-buttons">
              <button class="action-btn small" data-article-id="${article.id}" data-action="edit" title="Edit article">
                <i class="fas fa-edit"></i>
              </button>
              <button class="action-btn small" data-article-id="${article.id}" data-action="view" title="View article">
                <i class="fas fa-eye"></i>
              </button>
              ${article.slug ? `<a href="/articles/${article.slug}.html" target="_blank" class="action-btn small" title="Open article">
                <i class="fas fa-external-link-alt"></i>
              </a>` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
    
    this.table.innerHTML = html;
    
    // Add action listeners
    this.table.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        const articleId = e.currentTarget.dataset.articleId;
        this.handleAction(action, articleId);
      });
    });
  }
  
  /**
   * Handle action
   */
  handleAction(action, articleId) {
    const article = this.articles.find(a => a.id === articleId);
    if (!article) return;
    
    switch (action) {
      case 'edit':
        this.editArticle(article);
        break;
      case 'view':
        if (article.slug) {
          window.open(`/articles/${article.slug}.html`, '_blank');
        }
        break;
      default:
        console.error(`[ArticlesView] Unknown action: ${action}`);
    }
  }
  
  /**
   * Edit article
   */
  editArticle(article) {
    // TODO: Implement edit modal or redirect to edit page
    // Editing article
    alert('Edit functionality coming soon. Article ID: ' + article.id);
  }
  
  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Show view
   */
  async show() {
    // Showing articles view
    if (!this.table) {
      this.table = helpers.dom('#articles-table tbody');
    }
    await this.loadArticles();
    await this.loadAutomationStatus();
  }
  
  /**
   * Load automation status
   */
  async loadAutomationStatus() {
    try {
      const status = await window.api.get('/api/automation/jobs/article-writer/status');
      
      if (status.success && status.status) {
        const lastStatus = status.status;
        const statusEl = helpers.dom('#article-automation-status');
        const lastRunEl = helpers.dom('#article-automation-last-run');
        
        if (statusEl) {
          statusEl.textContent = lastStatus.status === 'success' ? 'Active' : 
                                 lastStatus.status === 'error' ? 'Error' : 'Unknown';
          statusEl.className = `info-value ${lastStatus.status === 'success' ? 'text-success' : 
                                                      lastStatus.status === 'error' ? 'text-error' : 'text-muted'}`;
        }
        
        if (lastRunEl && lastStatus.completedAt) {
          const date = new Date(lastStatus.completedAt);
          lastRunEl.textContent = date.toLocaleString();
        }
        
        // Calculate next run (24 hours from last run)
        if (lastStatus.completedAt) {
          const nextRunEl = helpers.dom('#article-automation-next-run');
          if (nextRunEl) {
            const lastRun = new Date(lastStatus.completedAt);
            const nextRun = new Date(lastRun.getTime() + 24 * 60 * 60 * 1000);
            nextRunEl.textContent = nextRun.toLocaleString();
          }
        }
      } else {
        const statusEl = helpers.dom('#article-automation-status');
        if (statusEl) {
          statusEl.textContent = 'Not run yet';
          statusEl.className = 'info-value text-muted';
        }
      }
    } catch (error) {
      console.error('[ArticlesView] Error loading automation status:', error);
      const statusEl = helpers.dom('#article-automation-status');
      if (statusEl) {
        statusEl.textContent = 'Error';
        statusEl.className = 'info-value text-error';
      }
    }
  }
  
  /**
   * Run automation manually
   */
  async runAutomation() {
    const btn = helpers.dom('#run-article-automation-btn');
    if (!btn) return;
    
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running...';
    
    try {
      const result = await window.api.post('/api/automation/jobs/article-writer/run', {});
      
      if (result.success) {
        alert('Article automation completed successfully!');
        await this.loadAutomationStatus();
        await this.loadArticles();
      } else {
        throw new Error(result.error || 'Automation failed');
      }
    } catch (error) {
      console.error('[ArticlesView] Error running automation:', error);
      alert(`Error: ${error.message}`);
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }
  
  /**
   * View automation logs
   */
  async viewAutomationLogs() {
    try {
      const logs = await window.api.get('/api/automation/jobs/article-writer/history?limit=10');
      
      if (logs.success) {
        const logsText = logs.history.map(log => {
          const date = new Date(log.completedAt || log.startedAt).toLocaleString();
          const status = log.status === 'success' ? '✅' : log.status === 'error' ? '❌' : '⏳';
          return `${status} ${date} - ${log.status}`;
        }).join('\n');
        
        alert(`Automation Logs:\n\n${logsText || 'No logs found'}`);
      }
    } catch (error) {
      console.error('[ArticlesView] Error loading logs:', error);
      alert(`Error loading logs: ${error.message}`);
    }
  }
  
  /**
   * Hide view
   */
  hide() {
    // Cleanup if needed
  }
  
  /**
   * Update view
   */
  update() {
    this.loadArticles();
  }
}

