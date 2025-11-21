// Post Loader - Loads individual blog post from Firebase API by slug
(function() {
  'use strict';

  const API_BASE_URL = typeof window.getApiBaseUrl === "function"
    ? window.getApiBaseUrl()
    : "https://specifys-ai.onrender.com";

  // Get slug from URL path
  function getSlugFromURL() {
    const path = window.location.pathname;
    // URL format: /2025/01/15/slug/
    const parts = path.split('/').filter(p => p);
    if (parts.length >= 4) {
      // Last part is the slug
      return parts[parts.length - 1];
    }
    return null;
  }

  async function loadPost() {
    const slug = getSlugFromURL();
    if (!slug) {
      showError('Invalid post URL');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/blog/public/post?slug=${encodeURIComponent(slug)}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          showError('Post not found');
        } else {
          throw new Error(`Failed to load post: ${response.status}`);
        }
        return;
      }

      const data = await response.json();
      const post = data.post;

      if (!post) {
        showError('Post not found');
        return;
      }

      await renderPost(post);

    } catch (error) {
      console.error('Error loading post:', error);
      showError('Error loading post. Please try again later.');
    }
  }

  async function renderPost(post) {
    // Update page title
    document.title = `${post.title} - Specifys.ai Blog`;
    
    // Update meta description
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && post.seoDescription) {
      metaDesc.content = post.seoDescription;
    } else if (metaDesc && post.description) {
      metaDesc.content = post.description;
    }

    // Format date
    const date = post.date ? new Date(post.date + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : 'No date';

    // Convert markdown to HTML
    let content = post.content || '';
    content = await convertMarkdownToHTML(content);

    // Calculate reading time
    const words = content.split(/\s+/).length;
    const readingTime = Math.ceil(words / 200); // Average reading speed: 200 words/min

    // Render breadcrumbs
    const breadcrumbs = document.querySelector('.breadcrumbs');
    if (breadcrumbs) {
      breadcrumbs.innerHTML = `
        <a href="/">Home</a>
        <span class="separator">/</span>
        <a href="/blog/">Blog</a>
        <span class="separator">/</span>
        <span class="current">${escapeHTML(post.title)}</span>
      `;
    }

    // Render post header
    const postHeader = document.querySelector('.post-header');
    if (postHeader) {
      postHeader.innerHTML = `
        <h1 class="post-title">${escapeHTML(post.title)}</h1>
        
        <div class="post-meta">
          <div class="meta-item">
            <i class="far fa-calendar-alt"></i>
            <time datetime="${post.date}" class="post-date">${date}</time>
          </div>
          
          ${post.author ? `
            <div class="meta-item">
              <i class="far fa-user"></i>
              <span class="post-author">${escapeHTML(post.author)}</span>
            </div>
          ` : ''}
          
          <div class="meta-item">
            <i class="far fa-clock"></i>
            <span class="reading-time">${readingTime} min read</span>
          </div>
        </div>
        
        ${post.tags && post.tags.length > 0 ? `
          <div class="post-tags-header">
            ${post.tags.slice(0, 5).map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}
          </div>
        ` : ''}
        
        ${post.description ? `
          <div class="post-description">
            <i class="fas fa-quote-left quote-icon"></i>
            <p>${escapeHTML(post.description)}</p>
          </div>
        ` : ''}
      `;
    }

    // Render post body
    const postBody = document.querySelector('#post-body');
    if (postBody) {
      postBody.innerHTML = content;
    }

    // Render post footer tags
    const postFooter = document.querySelector('.post-footer');
    if (postFooter && post.tags && post.tags.length > 0) {
      const tagsSection = postFooter.querySelector('.post-tags-footer');
      if (tagsSection) {
        tagsSection.innerHTML = `
          <h4>Related Topics</h4>
          <div class="post-tags">
            ${post.tags.map(tag => `<span class="tag">${escapeHTML(tag)}</span>`).join('')}
          </div>
        `;
      }
    }

    // Update share buttons
    updateShareButtons(post);
  }

  function convertMarkdownToHTML(markdown) {
    if (!markdown) return '';
    
    // Basic markdown conversion (you can enhance this or use marked library)
    let html = markdown
      // Headers
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      // Bold
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')
      // Code blocks
      .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      // Line breaks
      .replace(/\n\n/gim, '</p><p>')
      .replace(/\n/gim, '<br>');
    
    // Wrap in paragraphs
    html = '<p>' + html + '</p>';
    
    return html;
  }

  function updateShareButtons(post) {
    const url = window.location.href;
    const title = post.title;
    const description = post.description || '';

    // Twitter
    const twitterBtn = document.querySelector('.share-btn.twitter');
    if (twitterBtn) {
      twitterBtn.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
    }

    // LinkedIn
    const linkedinBtn = document.querySelector('.share-btn.linkedin');
    if (linkedinBtn) {
      linkedinBtn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    }

    // Facebook
    const facebookBtn = document.querySelector('.share-btn.facebook');
    if (facebookBtn) {
      facebookBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    }
  }

  function showError(message) {
    const postContent = document.querySelector('.post-content');
    if (postContent) {
      postContent.innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <h1 style="color: #dc3545; margin-bottom: 20px;">Post Not Found</h1>
          <p style="color: #666; margin-bottom: 30px;">${escapeHTML(message)}</p>
          <a href="/blog/" class="back-to-blog-btn" style="display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 8px;">
            <i class="fas fa-arrow-left"></i> Back to Blog
          </a>
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

  // Load post when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadPost);
  } else {
    loadPost();
  }
})();

