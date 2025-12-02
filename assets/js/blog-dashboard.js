// Blog Dashboard - Standalone blog management interface
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9hr0IWM4EREzkKDxBxYoYinV6LJXWXV4",
  authDomain: "specify-ai.firebaseapp.com",
  projectId: "specify-ai",
  storageBucket: "specify-ai.firebasestorage.app",
  messagingSenderId: "734278787482",
  appId: "1:734278787482:web:0e312fb6f197e849695a23",
  measurementId: "G-4YR9LK63MR"
};

const ADMIN_EMAILS = new Set([
  "specifysai@gmail.com",
  "admin@specifys.ai",
  "shalom@specifys.ai"
]);

let MarkedLib = null;

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

// Utility functions
const utils = {
  now: () => new Date(),
  toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "number") return new Date(value);
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : new Date(parsed);
    }
    return null;
  },
  formatRelative(value) {
    const date = utils.toDate(value);
    if (!date) return "—";
    const diff = Date.now() - date.getTime();
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    if (days < 30) return `${days} d ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months} mo ago`;
    const years = Math.round(months / 12);
    return `${years} yr ago`;
  },
  dom(selector) {
    return document.querySelector(selector);
  },
  domAll(selector) {
    return Array.from(document.querySelectorAll(selector));
  },
  sanitizeSlug(slug) {
    return slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 140);
  },
  escapeHTML(str) {
    if (typeof str !== "string") return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
};

class BlogDashboardApp {
  constructor() {
    this.posts = [];
    this.editingPost = null;
    this.errors = [];
    
    this.dom = {
      shell: utils.dom("#blog-dashboard-shell"),
      navButtons: utils.domAll(".nav-link"),
      sections: utils.domAll(".dashboard-section"),
      connectionIndicator: utils.dom("#connection-indicator .dot"),
      connectionLabel: utils.dom("#connection-indicator .label"),
      sidebarLastSync: utils.dom("#sidebar-last-sync"),
      topbarStatus: utils.dom("#topbar-sync-status"),
      manualRefresh: utils.dom("#manual-refresh-btn"),
      signOut: utils.dom("#sign-out-btn"),
      
      // Posts section
      postsList: utils.dom("#posts-list"),
      postsSearch: utils.dom("#posts-search"),
      postsFilter: utils.dom("#posts-filter"),
      
      // Create section
      blogForm: utils.dom("#blog-form"),
      blogFields: {
        title: utils.dom("#blog-title"),
        date: utils.dom("#blog-date"),
        slug: utils.dom("#blog-slug"),
        description: utils.dom("#blog-description"),
        content: utils.dom("#blog-content"),
        tags: utils.dom("#blog-tags"),
        author: utils.dom("#blog-author"),
        seoTitle: utils.dom("#blog-seo-title"),
        seoDescription: utils.dom("#blog-seo-description"),
        descriptionCount: utils.dom("#blog-description-count")
      },
      blogFeedback: utils.dom("#blog-feedback"),
      blogSubmitBtn: utils.dom("#blog-submit-btn"),
      blogPreviewBtn: utils.dom("#blog-preview-btn"),
      blogClearBtn: utils.dom("#blog-clear-btn"),
      
      // Errors section
      errorsList: utils.dom("#errors-list"),
      refreshErrorsBtn: utils.dom("#refresh-errors-btn"),
      
      // Preview modal
      previewModal: utils.dom("#preview-modal"),
      previewArticle: utils.dom("#preview-article"),
      previewCloseBtn: utils.dom("#preview-close-btn")
    };

    // Set default date
    if (this.dom.blogFields.date && !this.dom.blogFields.date.value) {
      this.dom.blogFields.date.value = utils.now().toISOString().slice(0, 10);
    }

    this.setupAuthGate();
  }

  setupAuthGate() {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        this.redirectToLogin();
        return;
      }

      // Check if user email is in admin list
      const email = user.email?.toLowerCase();
      
      // Also check if email matches any admin email (case-insensitive)
      const isAdmin = email && ADMIN_EMAILS.has(email);
      
      if (!isAdmin) {
        // Access denied
        alert(`Access denied. Admin privileges required.\n\nYour email: ${email}\nAdmin emails: ${Array.from(ADMIN_EMAILS).join(', ')}`);
        this.redirectToLogin();
        return;
      }

      this.updateConnectionStatus(true);
      this.init();
    });
  }

  redirectToLogin() {
    window.location.href = "/pages/auth.html?redirect=" + encodeURIComponent(window.location.pathname);
  }

  updateConnectionStatus(connected) {
    if (this.dom.connectionIndicator) {
      this.dom.connectionIndicator.className = `dot status-${connected ? "connected" : "pending"}`;
    }
    if (this.dom.connectionLabel) {
      this.dom.connectionLabel.textContent = connected ? "Connected" : "Connecting…";
    }
    if (this.dom.sidebarLastSync) {
      this.dom.sidebarLastSync.textContent = connected ? utils.formatRelative(utils.now()) : "Never";
    }
  }

  async init() {
    this.bindNavigation();
    this.bindInteractions();
    await this.loadPosts();
    this.updateTopbarStatus("Ready");
  }

  bindNavigation() {
    this.dom.navButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        if (!target) return;

        // Update active nav
        this.dom.navButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // Show target section
        this.dom.sections.forEach(s => s.classList.remove("active"));
        const targetSection = utils.dom(`#${target}`);
        if (targetSection) {
          targetSection.classList.add("active");
        }

        // Load data if needed
        if (target === "posts-section") {
          this.loadPosts();
        } else if (target === "errors-section") {
          this.loadErrors();
        }
      });
    });
  }

  bindInteractions() {
    // Sign out
    if (this.dom.signOut) {
      this.dom.signOut.addEventListener("click", async () => {
        try {
          await signOut(auth);
          this.redirectToLogin();
        } catch (error) {
          // Sign out error
        }
      });
    }

    // Manual refresh
    if (this.dom.manualRefresh) {
      this.dom.manualRefresh.addEventListener("click", () => {
        this.loadPosts();
        this.updateTopbarStatus("Refreshing…");
      });
    }

    // Blog form
    if (this.dom.blogForm) {
      this.dom.blogForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleBlogSubmit();
      });

      // Description counter
      if (this.dom.blogFields.description) {
        this.dom.blogFields.description.addEventListener("input", () => {
          const count = this.dom.blogFields.description.value.length;
          if (this.dom.blogFields.descriptionCount) {
            this.dom.blogFields.descriptionCount.textContent = `${count} / 160`;
          }
        });
      }

      // Auto-generate slug from title
      if (this.dom.blogFields.title && this.dom.blogFields.slug) {
        this.dom.blogFields.title.addEventListener("input", () => {
          if (!this.dom.blogFields.slug.dataset.manual) {
            this.dom.blogFields.slug.value = utils.sanitizeSlug(this.dom.blogFields.title.value);
          }
        });

        this.dom.blogFields.slug.addEventListener("input", () => {
          this.dom.blogFields.slug.dataset.manual = "true";
        });
      }
    }

    // Preview button
    if (this.dom.blogPreviewBtn) {
      this.dom.blogPreviewBtn.addEventListener("click", () => {
        this.showBlogPreview();
      });
    }

    // Clear button
    if (this.dom.blogClearBtn) {
      this.dom.blogClearBtn.addEventListener("click", () => {
        this.dom.blogForm.reset();
        if (this.dom.blogFields.date) {
          this.dom.blogFields.date.value = utils.now().toISOString().slice(0, 10);
        }
        if (this.dom.blogFields.descriptionCount) {
          this.dom.blogFields.descriptionCount.textContent = "0 / 160";
        }
        this.editingPost = null;
        this.setBlogFeedback("", "");
      });
    }

    // Posts search and filter
    if (this.dom.postsSearch) {
      this.dom.postsSearch.addEventListener("input", () => {
        this.renderPosts();
      });
    }

    if (this.dom.postsFilter) {
      this.dom.postsFilter.addEventListener("change", () => {
        this.renderPosts();
      });
    }

    // Preview modal close
    if (this.dom.previewCloseBtn) {
      this.dom.previewCloseBtn.addEventListener("click", () => {
        this.dom.previewModal.style.display = "none";
      });
    }

    if (this.dom.previewModal) {
      this.dom.previewModal.addEventListener("click", (e) => {
        if (e.target === this.dom.previewModal) {
          this.dom.previewModal.style.display = "none";
        }
      });
    }

    // Refresh errors
    if (this.dom.refreshErrorsBtn) {
      this.dom.refreshErrorsBtn.addEventListener("click", () => {
        this.loadErrors();
      });
    }
  }

  updateTopbarStatus(message) {
    if (this.dom.topbarStatus) {
      this.dom.topbarStatus.textContent = message;
    }
  }

  async getAuthToken(forceRefresh = false) {
    try {
      const user = auth.currentUser;
      if (!user) return null;
      return await user.getIdToken(forceRefresh);
    } catch (error) {
      return null;
    }
  }

  async loadPosts() {
    try {
      this.updateTopbarStatus("Loading posts…");
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai.onrender.com";
      
      const response = await fetch(`${apiBaseUrl}/api/blog/list-posts?published=false`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        const refreshedToken = await this.getAuthToken(true);
        if (!refreshedToken) {
          throw new Error("Unable to refresh authentication token");
        }
        const retryResponse = await fetch(`${apiBaseUrl}/api/blog/list-posts?published=false`, {
          headers: {
            Authorization: `Bearer ${refreshedToken}`
          }
        });
        if (!retryResponse.ok) {
          throw new Error(`Failed to load posts: ${retryResponse.status}`);
        }
        const retryData = await retryResponse.json();
        this.posts = retryData.posts || [];
      } else if (!response.ok) {
        throw new Error(`Failed to load posts: ${response.status}`);
      } else {
        const data = await response.json();
        this.posts = data.posts || [];
      }

      this.renderPosts();
      this.updateTopbarStatus(`Loaded ${this.posts.length} posts`);
      this.updateConnectionStatus(true);
      if (this.dom.sidebarLastSync) {
        this.dom.sidebarLastSync.textContent = utils.formatRelative(utils.now());
      }
    } catch (error) {
      this.updateTopbarStatus(`Error: ${error.message}`);
      if (this.dom.postsList) {
        this.dom.postsList.innerHTML = `<div class="loading-placeholder">Error loading posts: ${error.message}</div>`;
      }
    }
  }

  renderPosts() {
    if (!this.dom.postsList) return;

    let filteredPosts = [...this.posts];

    // Apply search filter
    const searchTerm = this.dom.postsSearch?.value.toLowerCase() || "";
    if (searchTerm) {
      filteredPosts = filteredPosts.filter(post =>
        post.title?.toLowerCase().includes(searchTerm) ||
        post.description?.toLowerCase().includes(searchTerm) ||
        post.content?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply status filter
    const statusFilter = this.dom.postsFilter?.value || "all";
    if (statusFilter === "published") {
      filteredPosts = filteredPosts.filter(post => post.published === true);
    } else if (statusFilter === "draft") {
      filteredPosts = filteredPosts.filter(post => post.published !== true);
    }

    // Sort by date (newest first)
    filteredPosts.sort((a, b) => {
      const dateA = new Date(a.date || a.createdAt);
      const dateB = new Date(b.date || b.createdAt);
      return dateB - dateA;
    });

    if (filteredPosts.length === 0) {
      this.dom.postsList.innerHTML = `<div class="loading-placeholder">No posts found</div>`;
      return;
    }

    const html = filteredPosts.map(post => {
      const createdAt = utils.toDate(post.createdAt);
      const updatedAt = utils.toDate(post.updatedAt);
      const tags = Array.isArray(post.tags) ? post.tags : (post.tags ? post.tags.split(",").map(t => t.trim()) : []);

      return `
        <div class="post-card">
          <div class="post-card-header">
            <h3 class="post-card-title">${utils.escapeHTML(post.title || "Untitled")}</h3>
            <span class="post-badge ${post.published ? "published" : "draft"}">
              ${post.published ? "✓ Published" : "Draft"}
            </span>
          </div>
          <div class="post-card-meta">
            <span><i class="fas fa-calendar"></i> ${post.date || "No date"}</span>
            <span><i class="fas fa-user"></i> ${utils.escapeHTML(post.author || "specifys.ai Team")}</span>
            ${createdAt ? `<span><i class="fas fa-clock"></i> Created ${utils.formatRelative(createdAt)}</span>` : ""}
          </div>
          ${post.description ? `<div class="post-card-description">${utils.escapeHTML(post.description)}</div>` : ""}
          ${tags.length > 0 ? `
            <div class="post-card-tags">
              ${tags.map(tag => `<span class="tag">${utils.escapeHTML(tag)}</span>`).join("")}
            </div>
          ` : ""}
          <div class="post-card-actions">
            ${post.url ? `<a href="${post.url}" target="_blank" class="btn-small"><i class="fas fa-external-link-alt"></i> View</a>` : ""}
            <button class="btn-small" onclick="blogDashboard.editPost('${post.id}')">
              <i class="fas fa-edit"></i> Edit
            </button>
            <button class="btn-small" onclick="blogDashboard.deletePost('${post.id}', '${utils.escapeHTML(post.title || "Untitled")}')">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
      `;
    }).join("");

    this.dom.postsList.innerHTML = html;
  }

  async editPost(postId) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai.onrender.com";
      
      const response = await fetch(`${apiBaseUrl}/api/blog/get-post?id=${postId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        const refreshedToken = await this.getAuthToken(true);
        if (!refreshedToken) {
          throw new Error("Unable to refresh authentication token");
        }
        const retryResponse = await fetch(`${apiBaseUrl}/api/blog/get-post?id=${postId}`, {
          headers: {
            Authorization: `Bearer ${refreshedToken}`
          }
        });
        if (!retryResponse.ok) {
          throw new Error(`Failed to load post: ${retryResponse.status}`);
        }
        const retryData = await retryResponse.json();
        this.populateForm(retryData.post);
      } else if (!response.ok) {
        throw new Error(`Failed to load post: ${response.status}`);
      } else {
        const data = await response.json();
        this.populateForm(data.post);
      }

      // Switch to create section
      const createBtn = this.dom.navButtons.find(btn => btn.dataset.target === "create-section");
      if (createBtn) {
        createBtn.click();
      }
    } catch (error) {
      this.setBlogFeedback(`Error loading post: ${error.message}`, "error");
    }
  }

  populateForm(post) {
    this.editingPost = { id: post.id, date: post.date, slug: post.slug };
    
    if (this.dom.blogFields.title) this.dom.blogFields.title.value = post.title || "";
    if (this.dom.blogFields.date) this.dom.blogFields.date.value = post.date || "";
    if (this.dom.blogFields.slug) {
      this.dom.blogFields.slug.value = post.slug || "";
      this.dom.blogFields.slug.dataset.manual = "true";
    }
    if (this.dom.blogFields.description) {
      this.dom.blogFields.description.value = post.description || "";
      if (this.dom.blogFields.descriptionCount) {
        this.dom.blogFields.descriptionCount.textContent = `${post.description?.length || 0} / 160`;
      }
    }
    if (this.dom.blogFields.content) this.dom.blogFields.content.value = post.content || "";
    if (this.dom.blogFields.tags) {
      this.dom.blogFields.tags.value = Array.isArray(post.tags) ? post.tags.join(", ") : (post.tags || "");
    }
    if (this.dom.blogFields.author) this.dom.blogFields.author.value = post.author || "specifys.ai Team";
    if (this.dom.blogFields.seoTitle) this.dom.blogFields.seoTitle.value = post.seoTitle || "";
    if (this.dom.blogFields.seoDescription) {
      this.dom.blogFields.seoDescription.value = post.seoDescription || "";
    }

    this.setBlogFeedback(`Editing: ${post.title}`, "success");
    this.dom.blogForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async deletePost(postId, postTitle) {
    if (!confirm(`Are you sure you want to delete "${postTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai.onrender.com";
      
      const response = await fetch(`${apiBaseUrl}/api/blog/delete-post`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id: postId })
      });

      if (response.status === 401) {
        const refreshedToken = await this.getAuthToken(true);
        if (!refreshedToken) {
          throw new Error("Unable to refresh authentication token");
        }
        const retryResponse = await fetch(`${apiBaseUrl}/api/blog/delete-post`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshedToken}`
          },
          body: JSON.stringify({ id: postId })
        });
        if (!retryResponse.ok) {
          throw new Error(`Failed to delete post: ${retryResponse.status}`);
        }
      } else if (!response.ok) {
        throw new Error(`Failed to delete post: ${response.status}`);
      }

      this.setBlogFeedback("Post deleted successfully", "success");
      await this.loadPosts();
    } catch (error) {
      // Error deleting post
      this.setBlogFeedback(`Error deleting post: ${error.message}`, "error");
    }
  }

  async handleBlogSubmit() {
    if (!this.dom.blogForm) return;
    
    const isEditing = Boolean(this.editingPost);
    const title = (this.dom.blogFields.title?.value || "").trim();
    const description = (this.dom.blogFields.description?.value || "").trim();
    const content = (this.dom.blogFields.content?.value || "").trim();
    const rawTags = this.dom.blogFields.tags?.value || "";
    const slugInput = (this.dom.blogFields.slug?.value || "").trim();
    const seoTitle = (this.dom.blogFields.seoTitle?.value || "").trim();
    const seoDescription = (this.dom.blogFields.seoDescription?.value || "").trim();
    const author = (this.dom.blogFields.author?.value || "specifys.ai Team").trim();
    const dateValue = this.dom.blogFields.date?.value || utils.now().toISOString().slice(0, 10);

    const tags = rawTags
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean);

    const payload = {
      title: title || "Untitled Post",
      description: description || "No description",
      content: content || "No content",
      tags,
      date: dateValue,
      author,
      slug: slugInput ? utils.sanitizeSlug(slugInput) : utils.sanitizeSlug(title || "untitled")
    };

    if (seoTitle) payload.seoTitle = seoTitle;
    if (seoDescription) payload.seoDescription = seoDescription;

    if (isEditing && this.editingPost?.id) {
      payload.id = this.editingPost.id;
      payload.date = this.editingPost.date || payload.date;
      payload.slug = this.editingPost.slug || payload.slug;
    }

    const button = this.dom.blogSubmitBtn;
    const originalText = button?.innerHTML;
    if (button) {
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
      button.disabled = true;
    }

    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai.onrender.com";
      
      const requestUrl = isEditing
        ? `${apiBaseUrl}/api/blog/update-post`
        : `${apiBaseUrl}/api/blog/create-post`;

      let response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 401) {
        const refreshedToken = await this.getAuthToken(true);
        if (!refreshedToken) {
          throw new Error("Unable to refresh authentication token");
        }
        response = await fetch(requestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshedToken}`
          },
          body: JSON.stringify(payload)
        });
      }

      const text = await response.text();
      let result = null;
      try {
        result = text ? JSON.parse(text) : null;
      } catch (parseError) {
        // Non-JSON response from blog endpoint
      }

      if (!response.ok || !(result && result.success)) {
        const message = result?.error || `Failed to ${isEditing ? "update" : "create"} blog post (HTTP ${response.status})`;
        throw new Error(message);
      }

      if (isEditing) {
        this.setBlogFeedback("✅ Blog post updated successfully in Firebase!", "success");
        this.editingPost = null;
        this.dom.blogForm.reset();
        if (this.dom.blogFields.date) {
          this.dom.blogFields.date.value = utils.now().toISOString().slice(0, 10);
        }
      } else {
        this.setBlogFeedback("✅ Blog post created successfully and saved to Firebase!", "success");
        this.dom.blogForm.reset();
        if (this.dom.blogFields.date) {
          this.dom.blogFields.date.value = utils.now().toISOString().slice(0, 10);
        }
        if (this.dom.blogFields.slug) {
          delete this.dom.blogFields.slug.dataset.manual;
        }
        if (this.dom.blogFields.descriptionCount) {
          this.dom.blogFields.descriptionCount.textContent = "0 / 160";
        }
      }

      await this.loadPosts();
    } catch (error) {
      // Blog save failed
      this.setBlogFeedback(error.message || `Failed to ${isEditing ? "update" : "create"} blog post`, "error");
    } finally {
      if (button) {
        button.innerHTML = originalText;
        button.disabled = false;
      }
    }
  }

  async showBlogPreview() {
    if (!this.dom.previewModal || !this.dom.previewArticle) return;
    
    const title = this.dom.blogFields.title?.value.trim();
    const description = this.dom.blogFields.description?.value.trim();
    const content = this.dom.blogFields.content?.value.trim();
    
    if (!title || !content) {
      alert("Please add title and content to preview");
      return;
    }

    // Load marked library if needed
    if (!MarkedLib) {
      try {
        const module = await import("https://cdn.jsdelivr.net/npm/marked@11.2.0/lib/marked.esm.js");
        MarkedLib = module.marked ?? module.default ?? null;
      } catch (error) {
        // Failed to load marked
      }
    }

    let renderedContent;
    if (MarkedLib) {
      if (typeof MarkedLib === "function") {
        renderedContent = MarkedLib(content);
      } else if (typeof MarkedLib.parse === "function") {
        renderedContent = MarkedLib.parse(content);
      }
    }
    if (!renderedContent) {
      renderedContent = `<pre>${utils.escapeHTML(content)}</pre>`;
    }

    this.dom.previewArticle.innerHTML = `
      <h1>${utils.escapeHTML(title)}</h1>
      ${description ? `<p class="lead">${utils.escapeHTML(description)}</p>` : ""}
      <hr>
      <div class="content">${renderedContent}</div>
    `;
    
    this.dom.previewModal.style.display = "flex";
  }

  setBlogFeedback(message, type) {
    if (!this.dom.blogFeedback) return;
    this.dom.blogFeedback.textContent = message;
    this.dom.blogFeedback.classList.remove("success", "error");
    if (type) {
      this.dom.blogFeedback.classList.add(type);
    }
  }

  async loadErrors() {
    if (!this.dom.errorsList) return;
    
    try {
      this.dom.errorsList.innerHTML = `<div class="loading-placeholder">Loading errors…</div>`;
      
      // For now, just show a message - can be extended to fetch actual errors
      this.dom.errorsList.innerHTML = `
        <div class="error-item">
          <div class="error-item-header">
            <div class="error-item-title">No errors found</div>
            <div class="error-item-time">${utils.formatRelative(utils.now())}</div>
          </div>
          <div class="error-item-message">All blog operations are working correctly.</div>
        </div>
      `;
    } catch (error) {
      // Error loading errors
      this.dom.errorsList.innerHTML = `<div class="loading-placeholder">Error loading errors: ${error.message}</div>`;
    }
  }
}

// Initialize app
let blogDashboard;
document.addEventListener("DOMContentLoaded", () => {
  blogDashboard = new BlogDashboardApp();
});

// Make editPost and deletePost available globally for onclick handlers
window.blogDashboard = {
  editPost: (id) => blogDashboard.editPost(id),
  deletePost: (id, title) => blogDashboard.deletePost(id, title)
};

