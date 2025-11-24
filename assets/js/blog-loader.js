// Blog Loader - Loads blog posts from Firebase API
(function() {
  'use strict';

  const API_BASE_URL = typeof window.getApiBaseUrl === "function"
    ? window.getApiBaseUrl()
    : "https://specifys-ai.onrender.com";

  async function loadBlogPosts() {
    const container = document.getElementById('blog-posts-container');
    if (!container) return;

    try {
      // Fetch published posts from public API (no auth required)
      console.log('[Blog Loader] Fetching posts from:', `${API_BASE_URL}/api/blog/public/posts?limit=50`);
      const response = await fetch(`${API_BASE_URL}/api/blog/public/posts?limit=50`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Blog Loader] API Error:', response.status, errorText);
        throw new Error(`Failed to load posts: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('[Blog Loader] Received data:', { success: data.success, postsCount: data.posts?.length || 0, total: data.total });
      const posts = data.posts || [];

      if (posts.length === 0) {
        container.innerHTML = `
          <div class="loading-placeholder" style="text-align: center; padding: 40px;">
            <p style="color: #666;">No blog posts yet. Check back soon!</p>
          </div>
        `;
        return;
      }

      // Render posts
      const html = posts.map(post => {
        const date = post.date ? new Date(post.date + 'T00:00:00').toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }) : 'No date';
        
        const description = post.description || '';
        const url = post.url || `/${post.date.split('-')[0]}/${post.date.split('-')[1]}/${post.date.split('-')[2]}/${post.slug}/`;

        return `
          <div class="article-preview">
            <h2 class="article-title">
              <a href="${url}">${escapeHTML(post.title || 'Untitled')}</a>
            </h2>
            <div class="article-date">
              ${date}
            </div>
            ${description ? `
              <div class="article-intro">
                ${escapeHTML(description.substring(0, 150))}${description.length > 150 ? '...' : ''}
              </div>
            ` : ''}
            <a href="${url}" class="read-more-btn" onclick="if(typeof trackButtonClick === 'function') trackButtonClick('Read Article', 'Blog', 'article_preview', {'article_title': '${escapeHTML(post.title || 'Untitled')}'}); return true;">Read More</a>
          </div>
        `;
      }).join('');

      container.innerHTML = html;

    } catch (error) {
      console.error('Error loading blog posts:', error);
      container.innerHTML = `
        <div class="loading-placeholder" style="text-align: center; padding: 40px;">
          <p style="color: #dc3545;">Error loading blog posts. Please try again later.</p>
        </div>
      `;
    }
  }

  function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Load posts when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadBlogPosts);
  } else {
    loadBlogPosts();
  }
})();

