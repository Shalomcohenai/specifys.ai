import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  where,
  limit,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9hr0IWM4EREzkKDxBxYoYinV6LJXWXV4",
  authDomain: "specify-ai.firebaseapp.com",
  projectId: "specify-ai",
  storageBucket: "specify-ai.firebasestorage.app",
  messagingSenderId: "734278787482",
  appId: "1:734278787482:web:0e312fb6f197e849695a23",
  measurementId: "G-4YR9LK63MR"
};

const COLLECTIONS = Object.freeze({
  USERS: "users",
  ENTITLEMENTS: "entitlements",
  SPECS: "specs",
  PURCHASES: "purchases",
  SUBSCRIPTIONS: "subscriptions",
  CREDITS_TRANSACTIONS: "credits_transactions",
  ACTIVITY_LOGS: "activityLogs",
  ERROR_LOGS: "errorLogs",
  CSS_CRASH_LOGS: "cssCrashLogs",
  BLOG_QUEUE: "blogQueue"
});

const ADMIN_EMAILS = new Set([
  "specifysai@gmail.com",
  "admin@specifys.ai",
  "shalom@specifys.ai"
]);

const DATE_RANGES = Object.freeze({
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000
});

const MAX_ACTIVITY_EVENTS = 200;
const MAX_PURCHASES = 250;
const MAX_SPEC_CACHE = 2000;

let ChartLib = null;
let MarkedLib = null;

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-loaded-src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.defer = true;
    script.dataset.loadedSrc = src;
    script.onload = () => resolve();
    script.onerror = (event) => reject(event);
    document.head.appendChild(script);
  });
}

/**
 * Utility helpers
 */
const PRODUCT_PRICE_MAP = {
  single_spec: 4.9,
  three_pack: 9.9,
  pro_monthly: 29.9,
  pro_yearly: 299.9,
  pro_lifetime: 499.0
};

const utils = {
  now: () => new Date(),
  toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (value instanceof Timestamp) return value.toDate();
    if (typeof value === "number") return new Date(value);
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? null : new Date(parsed);
    }
    return null;
  },
  formatDate(value) {
    const date = utils.toDate(value);
    if (!date) return "—";
    return date.toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
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
  formatCurrency(amount, currency = "USD") {
    if (typeof amount !== "number") return "—";
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      return `${amount.toFixed(2)} ${currency}`;
    }
  },
  formatNumber(value) {
    if (value === null || value === undefined) return "—";
    if (Math.abs(value) >= 1000) {
      return new Intl.NumberFormat("en-US", { notation: "compact" }).format(
        value
      );
    }
    return new Intl.NumberFormat("en-US").format(value);
  },
  clampArray(arr, limit) {
    if (arr.length <= limit) return arr;
    return arr.slice(0, limit);
  },
  debounce(fn, wait = 250) {
    let timeout = null;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), wait);
    };
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
  normalizeCurrency(value, context = {}) {
    if (value === null || value === undefined) {
      return utils.lookupProductPrice(context) ?? null;
    }
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return utils.lookupProductPrice(context) ?? null;
    }
    if (Math.abs(numeric) >= 1000) {
      return Number((numeric / 100).toFixed(2));
    }
    if (numeric >= 50 || numeric % 10 === 0) {
      const mapped = utils.lookupProductPrice(context);
      if (mapped) return mapped;
    }
    return Number(numeric.toFixed(2));
  },
  lookupProductPrice(context) {
    const key =
      context?.productKey ||
      context?.product_key ||
      context?.metadata?.productKey ||
      context?.metadata?.product_key ||
      context?.metadata?.customData?.product_key ||
      context?.metadata?.customData?.productKey;
    if (key && PRODUCT_PRICE_MAP[key]) {
      return PRODUCT_PRICE_MAP[key];
    }
    const name = (context?.productName || context?.metadata?.productName || "").toLowerCase();
    if (!name) return null;
    if (name.includes("single")) return PRODUCT_PRICE_MAP.single_spec;
    if (name.includes("3-pack") || name.includes("three")) return PRODUCT_PRICE_MAP.three_pack;
    if (name.includes("monthly")) return PRODUCT_PRICE_MAP.pro_monthly;
    if (name.includes("yearly") || name.includes("annual")) return PRODUCT_PRICE_MAP.pro_yearly;
    return null;
  }
};

class DashboardDataStore {
  constructor() {
    this.users = new Map();
    this.entitlements = new Map();
    this.specs = new Map();
    this.specsByUser = new Map();
    this.purchases = [];
    this.activity = [];
    this.manualActivity = [];
    this.blogQueue = [];
    this.contactSubmissions = [];
  }

  reset() {
    this.users.clear();
    this.entitlements.clear();
    this.specs.clear();
    this.specsByUser.clear();
    this.purchases = [];
    this.activity = [];
    this.manualActivity = [];
    this.blogQueue = [];
    this.contactSubmissions = [];
  }

  upsertUser(id, data) {
    const normalized = {
      id,
      email: data.email || "",
      displayName: data.displayName || data.email || "",
      plan: (data.plan || "free").toLowerCase(),
      createdAt: utils.toDate(data.createdAt) || utils.toDate(data.creationTime),
      lastActive: utils.toDate(data.lastActive),
      newsletterSubscription: Boolean(data.newsletterSubscription),
      disabled: Boolean(data.disabled),
      emailVerified: Boolean(data.emailVerified),
      freeSpecsRemaining: typeof data.free_specs_remaining === "number" ? data.free_specs_remaining : null,
      metadata: data
    };
    this.users.set(id, normalized);
    return normalized;
  }

  removeUser(id) {
    this.users.delete(id);
  }

  upsertEntitlement(id, data) {
    const normalized = {
      userId: id,
      specCredits:
        typeof data.spec_credits === "number" ? data.spec_credits : null,
      unlimited: Boolean(data.unlimited),
      canEdit: Boolean(data.can_edit),
      updatedAt: utils.toDate(data.updated_at),
      metadata: data
    };
    this.entitlements.set(id, normalized);
    return normalized;
  }

  removeEntitlement(id) {
    this.entitlements.delete(id);
  }

  upsertSpec(id, data) {
    const normalized = {
      id,
      userId: data.userId || data.uid || null,
      title: data.title || "Untitled spec",
      createdAt: utils.toDate(data.createdAt),
      updatedAt: utils.toDate(data.updatedAt),
      content: data.content || "",
      metadata: data
    };

    const previous = this.specs.get(id);
    if (previous && previous.userId && previous.userId !== normalized.userId) {
      const prevList = this.specsByUser.get(previous.userId);
      if (prevList) {
        this.specsByUser.set(
          previous.userId,
          prevList.filter((spec) => spec.id !== id)
        );
      }
    }

    this.specs.set(id, normalized);
    if (normalized.userId) {
      const list = this.specsByUser.get(normalized.userId) || [];
      const index = list.findIndex((spec) => spec.id === id);
      if (index >= 0) {
        list[index] = normalized;
                } else {
        list.push(normalized);
      }
      list.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      this.specsByUser.set(
        normalized.userId,
        utils.clampArray(list, MAX_SPEC_CACHE)
      );
    }

    return normalized;
  }

  removeSpec(id) {
    const existing = this.specs.get(id);
    if (existing) {
      this.specs.delete(id);
      if (existing.userId) {
        const list = this.specsByUser.get(existing.userId) || [];
        this.specsByUser.set(
          existing.userId,
          list.filter((spec) => spec.id !== id)
        );
      }
    }
  }

  setPurchases(purchases) {
    this.purchases = purchases
      .map((doc) => ({
        id: doc.id,
        createdAt: utils.toDate(doc.createdAt),
        total: utils.normalizeCurrency(doc.total, doc),
        currency: doc.currency || "USD",
        userId: doc.userId || null,
        email: doc.email || "",
        productName: doc.productName || doc.product_key || "Purchase",
        productType: doc.productType || "one_time",
        status: doc.status || "paid",
        subscriptionId: doc.subscriptionId || null,
        metadata: doc
      }))
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    this.purchases = utils.clampArray(this.purchases, MAX_PURCHASES);
  }

  upsertPurchase(id, data) {
    const normalized = {
      id,
      createdAt: utils.toDate(data.createdAt),
      total: utils.normalizeCurrency(data.total, data),
      currency: data.currency || "USD",
      userId: data.userId || null,
      email: data.email || "",
      productName: data.productName || data.product_key || "Purchase",
      productType: data.productType || "one_time",
      status: data.status || "paid",
      subscriptionId: data.subscriptionId || null,
      metadata: data
    };
    const index = this.purchases.findIndex((item) => item.id === id);
    if (index >= 0) {
      this.purchases[index] = normalized;
    } else {
      this.purchases.unshift(normalized);
    }
    this.purchases.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
    this.purchases = utils.clampArray(this.purchases, MAX_PURCHASES);
    return normalized;
  }

  removePurchase(id) {
    this.purchases = this.purchases.filter((item) => item.id !== id);
  }

  setActivity(events, options = { append: false }) {
    if (options.append) {
      this.activity = utils.clampArray(
        [...events, ...this.activity],
        MAX_ACTIVITY_EVENTS
      );
    } else {
      this.activity = utils.clampArray(events, MAX_ACTIVITY_EVENTS);
    }
  }

  recordActivity(event) {
    if (!event || !event.timestamp) return;
    const normalized = {
      id: event.id || `${event.type}-${event.timestamp.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
      type: event.type || "system",
      title: event.title || "Activity",
      description: event.description || "",
      timestamp: utils.toDate(event.timestamp) || utils.now(),
      meta: event.meta || {}
    };
    this.manualActivity.unshift(normalized);
    this.manualActivity = utils.clampArray(this.manualActivity, MAX_ACTIVITY_EVENTS);
  }

  setBlogQueue(items) {
    this.blogQueue = items
      .map((item) => ({
        id: item.id,
        title: item.postData?.title || "Untitled post",
        status: item.status || "pending",
        createdAt: utils.toDate(item.createdAt),
        startedAt: utils.toDate(item.startedAt),
        completedAt: utils.toDate(item.completedAt),
        error: item.error || null,
        result: item.result || null
      }))
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
  }

  getUsersSorted() {
    return Array.from(this.users.values()).sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  getUser(userId) {
    return this.users.get(userId) || null;
  }

  getEntitlement(userId) {
    return this.entitlements.get(userId) || null;
  }

  getSpecCount(userId) {
    const list = this.specsByUser.get(userId);
    return list ? list.length : 0;
  }

  getSpecsForUser(userId) {
    return this.specsByUser.get(userId) || [];
  }

  getPurchases(range) {
    if (!range || range === "all") return this.purchases;
    const threshold = Date.now() - DATE_RANGES[range];
    return this.purchases.filter((purchase) => (purchase.createdAt?.getTime() || 0) >= threshold);
  }

  getActivityMerged() {
    const combined = [...this.manualActivity, ...this.activity];
    combined.sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));
    return utils.clampArray(combined, MAX_ACTIVITY_EVENTS);
  }
}

class GlobalSearch {
  constructor(store, elements) {
    this.store = store;
    this.elements = elements;
    this.active = false;
    this.boundHandleKey = this.handleKeydown.bind(this);
    this.debouncedSearch = utils.debounce(this.executeSearch.bind(this), 160);
    this.init();
  }

  init() {
    document.addEventListener("keydown", this.boundHandleKey);
    this.elements.openTrigger?.addEventListener("click", () => this.open());
    this.elements.closeTrigger?.addEventListener("click", () => this.close());
    this.elements.backdrop?.addEventListener("click", () => this.close());
    this.elements.input?.addEventListener("input", (event) => {
      this.debouncedSearch(event.target.value);
    });
  }

  handleKeydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "/") {
      event.preventDefault();
      this.toggle();
    } else if (event.key === "Escape" && this.active) {
      event.preventDefault();
      this.close();
    }
  }

  toggle() {
    if (this.active) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    this.active = true;
    this.elements.root?.classList.remove("hidden");
    setTimeout(() => this.elements.input?.focus(), 20);
    this.renderPlaceholder();
  }

  close() {
    this.active = false;
    this.elements.root?.classList.add("hidden");
    if (this.elements.input) {
      this.elements.input.value = "";
    }
    this.renderPlaceholder();
  }

  renderPlaceholder() {
    if (!this.elements.results) return;
    this.elements.results.innerHTML = `
      <div class="results-placeholder">Start typing to search across modules.</div>
    `;
  }

  executeSearch(rawTerm) {
    if (!this.elements.results) return;
    const term = rawTerm.trim().toLowerCase();
    if (term.length < 2) {
      this.renderPlaceholder();
            return;
        }

    const userResults = [];
    const paymentResults = [];
    const specResults = [];
    const logResults = [];

    for (const user of this.store.getUsersSorted()) {
      if (
        (user.email && user.email.toLowerCase().includes(term)) ||
        (user.displayName && user.displayName.toLowerCase().includes(term))
      ) {
        userResults.push({
          id: user.id,
          title: user.displayName || user.email || user.id || "Unknown",
          subtitle: `${user.email || user.id || "No email"} • Plan: ${user.plan}`,
          action: () => {
            const navButton = document.querySelector(
              '[data-target="users-section"]'
            );
            navButton?.dispatchEvent(new Event("click", { bubbles: true }));
            const searchInput = document.getElementById("users-search");
            if (searchInput) {
              searchInput.focus();
              searchInput.value = user.email || user.id || "";
              searchInput.dispatchEvent(new Event("input"));
            }
            this.close();
          }
        });
      }
    }

    for (const purchase of this.store.purchases) {
      const target = [purchase.email, purchase.productName, purchase.productType]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (target.includes(term)) {
        paymentResults.push({
          id: purchase.id,
          title: `${utils.formatCurrency(purchase.total, purchase.currency)} • ${purchase.productName}`,
          subtitle: `${purchase.email || purchase.userId || "Unknown user"} · ${utils.formatDate(purchase.createdAt)}`,
          action: () => {
            document
              .querySelector('[data-target="payments-section"]')
              ?.dispatchEvent(new Event("click", { bubbles: true }));
            this.close();
          }
        });
      }
    }

    for (const [userId, specs] of this.store.specsByUser.entries()) {
      for (const spec of specs) {
        const target = `${spec.title} ${spec.metadata?.description || ""}`.toLowerCase();
        if (target.includes(term)) {
          specResults.push({
            id: spec.id,
            title: spec.title,
            subtitle: `${this.store.getUser(userId)?.email || userId} · ${utils.formatDate(spec.createdAt)}`,
            action: () => {
              this.elements.specViewer?.openWithUser(userId);
              this.close();
            }
          });
        }
      }
    }

    for (const event of this.store.getActivityMerged()) {
      const target = `${event.title} ${event.description}`.toLowerCase();
      if (target.includes(term)) {
        logResults.push({
          id: event.id,
          title: event.title,
          subtitle: `${event.type.toUpperCase()} · ${utils.formatDate(event.timestamp)}`,
          action: () => {
            document
              .querySelector('[data-target="logs-section"]')
              ?.dispatchEvent(new Event("click", { bubbles: true }));
            this.close();
          }
        });
      }
    }

    const renderGroup = (label, items) => {
      if (!items.length) return "";
      const htmlItems = items
        .slice(0, 6)
        .map(
          (item) => `
          <li class="result-item" data-result-id="${item.id}">
            <span class="result-title">${item.title}</span>
            <span class="result-meta">${item.subtitle}</span>
          </li>
        `
        )
        .join("");
      return `
        <section class="result-group" data-group="${label.toLowerCase()}">
          <h3>${label}</h3>
          <ul class="result-list">${htmlItems}</ul>
        </section>
      `;
    };

    const resultsHTML = [
      renderGroup("Users", userResults),
      renderGroup("Payments", paymentResults),
      renderGroup("Specs", specResults),
      renderGroup("Logs", logResults)
    ]
      .filter(Boolean)
      .join("");

    this.elements.results.innerHTML =
      resultsHTML || `<div class="results-placeholder">No results found for "${term}".</div>`;

    this.elements.results
      .querySelectorAll(".result-item")
      .forEach((itemElement) => {
        itemElement.addEventListener("click", () => {
          const group = itemElement.closest(".result-group")?.dataset.group;
          const id = itemElement.dataset.resultId;
          const collectionMap = {
            users: userResults,
            payments: paymentResults,
            specs: specResults,
            logs: logResults
          };
          const targetCollection = collectionMap[group];
          const found = targetCollection?.find((entry) => entry.id === id);
          found?.action?.();
        });
      });
  }

  async fetchBlogPost(id) {
    if (!id) {
      throw new Error("Post ID is required to load the post.");
    }
    let token = await this.getAuthToken();
    if (!token) {
      const authError = new Error("Authentication required to load blog post.");
      authError.status = 401;
      throw authError;
    }
    const apiBaseUrl = typeof window.getApiBaseUrl === "function"
      ? window.getApiBaseUrl()
      : "https://specifys-ai.onrender.com";
    const requestUrl = `${apiBaseUrl}/api/blog/get-post?id=${encodeURIComponent(id)}`;

    const makeRequest = async (idToken) => {
      return fetch(requestUrl, {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });
    };

    let response = await makeRequest(token);
    if (response.status === 401) {
      token = await this.getAuthToken(true);
      if (!token) {
        const refreshError = new Error("Unable to refresh authentication token.");
        refreshError.status = 401;
        throw refreshError;
      }
      response = await makeRequest(token);
    }

    const text = await response.text();
    let result = null;
    try {
      result = text ? JSON.parse(text) : null;
    } catch (parseError) {
      console.warn("Non-JSON response when loading blog post", parseError, text);
    }

    if (!response.ok || !(result && result.success && result.post)) {
      const message =
        result?.error ||
        `Failed to load blog post (HTTP ${response.status} ${response.statusText})`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return result.post;
  }

  async enterBlogEditMode(id) {
    if (!id) return;
    try {
      if (this.editingPost?.id !== id) {
        this.exitBlogEditMode();
      }
      this.setBlogFeedback("Loading post for editing…", "success");
      const post = await this.fetchBlogPost(id);

      this.editingPost = {
        id: post.id,
        date: post.date,
        slug: post.slug
      };

      if (this.dom.blogFields.title) {
        this.dom.blogFields.title.value = post.title || "";
      }
      if (this.dom.blogFields.description) {
        this.dom.blogFields.description.value = post.description || "";
        if (this.dom.blogFields.descriptionCount) {
          this.dom.blogFields.descriptionCount.textContent = `${post.description?.length || 0} / 160`;
        }
      }
      if (this.dom.blogFields.content) {
        this.dom.blogFields.content.value = post.content || "";
      }
      if (this.dom.blogFields.tags) {
        this.dom.blogFields.tags.value = Array.isArray(post.tags) ? post.tags.join(", ") : "";
      }
      if (this.dom.blogFields.slug) {
        this.dom.blogFields.slug.value = post.slug || "";
        this.dom.blogFields.slug.dataset.manual = "true";
        this.dom.blogFields.slug.disabled = true;
      }
      if (this.dom.blogFields.date) {
        this.dom.blogFields.date.value = post.date || "";
        this.dom.blogFields.date.disabled = true;
      }
      if (this.dom.blogFields.seoTitle) {
        this.dom.blogFields.seoTitle.value = post.seoTitle || "";
      }
      if (this.dom.blogFields.seoDescription) {
        this.dom.blogFields.seoDescription.value = post.seoDescription || "";
      }
      if (this.dom.blogFields.author) {
        this.dom.blogFields.author.value = post.author || "specifys.ai Team";
      }

      if (this.blogSubmitButton) {
        this.blogSubmitButton.innerHTML = '<i class="fas fa-save"></i> Save changes';
      }

      this.setBlogFeedback(`Editing ${post.title}`, "success");
      this.dom.blogForm?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      console.error("[BlogEdit] Failed to load post", {
        message: error.message,
        stack: error.stack
      });
      this.setBlogFeedback(error.message || "Failed to load post for editing.", "error");
      this.exitBlogEditMode();
    }
  }

  exitBlogEditMode(options = {}) {
    const { resetForm = false } = options;
    this.editingPost = null;

    if (this.dom.blogFields.slug) {
      this.dom.blogFields.slug.disabled = false;
      delete this.dom.blogFields.slug.dataset.manual;
    }
    if (this.dom.blogFields.date) {
      this.dom.blogFields.date.disabled = false;
      if (!this.dom.blogFields.date.value) {
        this.dom.blogFields.date.value = utils.now().toISOString().slice(0, 10);
      }
    }

    if (resetForm && this.dom.blogForm) {
      this.dom.blogForm.reset();
      if (this.dom.blogFields.date) {
        this.dom.blogFields.date.value = utils.now().toISOString().slice(0, 10);
      }
      if (this.dom.blogFields.author) {
        this.dom.blogFields.author.value = "specifys.ai Team";
      }
      if (this.dom.blogFields.descriptionCount) {
        this.dom.blogFields.descriptionCount.textContent = "0 / 160";
      }
    }

    if (this.blogSubmitButton) {
      this.blogSubmitButton.innerHTML = this.blogSubmitDefaultText;
    }
  }
}

class SpecViewerModal {
  constructor(store, elements) {
    this.store = store;
    this.elements = elements;
    this.currentUserId = null;
    this.debouncedFilter = utils.debounce(this.renderList.bind(this), 150);
    this.init();
  }

  init() {
    if (!this.elements.root) return;
    this.elements.dismissButtons?.forEach((btn) =>
      btn.addEventListener("click", () => this.close())
    );
    this.elements.backdrop?.addEventListener("click", () => this.close());
    this.elements.search?.addEventListener("input", () => {
      this.debouncedFilter();
    });
  }

  open(userId) {
    this.currentUserId = userId;
    if (this.elements.root) {
      this.elements.root.classList.remove("hidden");
    }
    if (this.elements.search) {
      this.elements.search.value = "";
    }
    this.renderList();
  }

  async openWithFetch(userId) {
    await this.preloadSpecs(userId);
    this.open(userId);
  }

  async preloadSpecs(userId) {
    if (this.store.getSpecsForUser(userId).length > 0) return;
    try {
      const q = query(
        collection(db, COLLECTIONS.SPECS),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        this.store.upsertSpec(docSnap.id, docSnap.data());
      });
    } catch (error) {
      console.error("Failed to preload specs", error);
    }
  }

  async openWithUser(userId) {
    await this.preloadSpecs(userId);
    this.open(userId);
  }

  close() {
    if (this.elements.root) {
      this.elements.root.classList.add("hidden");
    }
  }

  renderList() {
    if (!this.elements.list || !this.currentUserId) return;
    const specs = this.store.getSpecsForUser(this.currentUserId);
    const searchValue = this.elements.search?.value.trim().toLowerCase() ?? "";
    const filtered = searchValue
      ? specs.filter((spec) => {
          const haystack = `${spec.title} ${spec.content}`.toLowerCase();
          return haystack.includes(searchValue);
        })
      : specs;
    if (!filtered.length) {
      this.elements.list.innerHTML =
        "<div class=\"modal-placeholder\">No specs found for this user.</div>";
      return;
    }

    const html = filtered
      .map((spec) => {
        const preview = (spec.content || "").split(/\s+/).slice(0, 50).join(" ");
        return `
          <article class="spec-item" data-spec-id="${spec.id}">
            <header>
              <h3>${spec.title}</h3>
              <time>${utils.formatDate(spec.createdAt)}</time>
            </header>
            <div class="spec-meta">
              <span>ID: ${spec.id}</span>
              <span>Updated: ${utils.formatRelative(spec.updatedAt)}</span>
                    </div>
            <p class="spec-preview">${preview}…</p>
            <div class="spec-actions">
              <a href="/pages/spec-viewer.html?spec=${spec.id}" target="_blank" rel="noopener">Open viewer</a>
              <a href="/pages/spec.html?id=${spec.id}" target="_blank" rel="noopener">Open editor</a>
            </div>
          </article>
        `;
      })
      .join("");

    this.elements.list.innerHTML = html;
  }
}

class AdminDashboardApp {
  constructor() {
    this.store = new DashboardDataStore();
    this.unsubscribeFns = [];
    this.isActivityPaused = false;
    this.autoRefreshTimer = null;
    this.nextAutoRefreshAt = null;
    this.lastManualRefresh = null; // Track last manual refresh time
    this.syncInProgress = false;
    this.charts = {
      usersPlan: null,
      specsTimeline: null,
      revenueTrend: null,
      usersGrowth: null,
      specsGrowth: null,
      conversionFunnel: null,
      apiResponse: null,
      errorRate: null
    };
    this.activeActivityFilter = "all";
    this.usersCurrentPage = 1;
    this.usersPerPage = 25; // Number of users per page
    this.selectedUsers = new Set(); // For bulk actions
    this.alerts = [];
    this.performanceData = {
      apiResponseTimes: [],
      errorRates: [],
      connections: 0,
      uptime: 100
    };

    this.dom = {
      shell: utils.dom("#admin-shell"),
      navButtons: utils.domAll(".nav-link"),
      sections: utils.domAll(".dashboard-section"),
      statusIndicator: utils.dom("#connection-indicator .dot"),
      statusLabel: utils.dom("#connection-indicator .label"),
      sidebarLastSync: utils.dom("#sidebar-last-sync"),
      topbarStatus: utils.dom("#topbar-sync-status"),
      manualRefresh: utils.dom("#manual-refresh-btn"),
      signOut: utils.dom("#sign-out-btn"),
      overviewRange: utils.dom("#overview-range"),
      overviewMetrics: utils.dom("#overview-metrics"),
      activityFeed: utils.dom("#activity-feed"),
      toggleActivity: utils.dom("#toggle-activity-pause"),
      activityFilterButtons: utils.domAll(".activity-filter-btn"),
      sourceList: utils.dom("#source-status-list"),
      autoRefreshNext: utils.dom("#auto-refresh-next"),
      syncUsersButton: utils.dom("#sync-users-btn"),
      syncUsersSummary: utils.dom("#sync-users-summary"),
      activityDetail: {
        root: utils.dom("#activity-detail"),
        title: utils.dom("#activity-detail-title"),
        close: utils.dom("#activity-detail-close"),
        name: utils.dom("#activity-detail-user"),
        email: utils.dom("#activity-detail-email"),
        userId: utils.dom("#activity-detail-userid"),
        time: utils.dom("#activity-detail-time"),
        context: utils.dom("#activity-detail-context")
      },
      usersSearch: utils.dom("#users-search"),
      usersPlanFilter: utils.dom("#users-plan-filter"),
      usersTable: utils.dom("#users-table tbody"),
      exportUsers: utils.dom("#export-users-btn"),
      usersPagination: utils.dom("#users-pagination"),
      usersPaginationInfo: utils.dom("#users-pagination-info"),
      usersPaginationPrev: utils.dom("#users-pagination-prev"),
      usersPaginationNext: utils.dom("#users-pagination-next"),
      usersPaginationPages: utils.dom("#users-pagination-pages"),
      conversionFunnel: utils.dom("#conversion-funnel"),
      retentionMetrics: utils.dom("#retention-metrics"),
      paymentsSearch: utils.dom("#payments-search"),
      paymentsRange: utils.dom("#payments-range"),
      paymentsTable: utils.dom("#payments-table tbody"),
      logsStream: utils.dom("#logs-stream"),
      logsFilter: utils.dom("#logs-filter"),
      blogForm: utils.dom("#blog-form"),
      blogFields: {
        title: utils.dom("#blog-title"),
        date: utils.dom("#blog-date"),
        slug: utils.dom("#blog-slug"),
        seoTitle: utils.dom("#blog-seo-title"),
        seoDescription: utils.dom("#blog-seo-description"),
        description: utils.dom("#blog-description"),
        content: utils.dom("#blog-content"),
        tags: utils.dom("#blog-tags"),
        author: utils.dom("#blog-author"),
        descriptionCount: utils.dom("#blog-description-count")
      },
      blogFeedback: utils.dom("#blog-feedback"),
      blogPreview: utils.dom("#blog-preview-btn"),
      blogQueueList: utils.dom("#blog-queue-list"),
      refreshQueue: utils.dom("#refresh-queue-btn"),
      statsRangeButtons: utils.domAll(".range-btn"),
      statsStartDate: utils.dom("#stats-start-date"),
      statsEndDate: utils.dom("#stats-end-date"),
      metrics: {
        totalUsers: utils.dom('[data-metric="users-total"]'),
        newUsers: utils.dom('[data-kpi="users-new"]'),
        liveUsers: utils.dom('[data-metric="users-live"]'),
        liveUsersTime: utils.dom('[data-kpi="users-live-time"]'),
        proUsers: utils.dom('[data-metric="users-pro"]'),
        proShare: utils.dom('[data-kpi="users-pro-share"]'),
        specsTotal: utils.dom('[data-metric="specs-total"]'),
        specsRange: utils.dom('[data-kpi="specs-range"]'),
        revenueTotal: utils.dom('[data-metric="revenue-total"]'),
        revenueRange: utils.dom('[data-kpi="revenue-range"]')
      },
      apiHealth: {
        checkButton: utils.dom("#api-health-check-btn"),
        copyButton: utils.dom("#api-health-copy-btn"),
        responseText: utils.dom("#api-response-text")
      },
      quickActions: {
        addCredits: utils.dom("#quick-action-add-credits"),
        changePlan: utils.dom("#quick-action-change-plan"),
        resetPassword: utils.dom("#quick-action-reset-password"),
        toggleUser: utils.dom("#quick-action-toggle-user"),
        modal: utils.dom("#quick-actions-modal"),
        modalTitle: utils.dom("#quick-actions-title"),
        modalBody: utils.dom("#quick-actions-body")
      },
      usersStatusFilter: utils.dom("#users-status-filter"),
      usersDateFrom: utils.dom("#users-date-from"),
      usersDateTo: utils.dom("#users-date-to"),
      usersSelectAll: utils.dom("#users-select-all"),
      exportUsersPdf: utils.dom("#export-users-pdf-btn"),
      bulkActionsBtn: utils.dom("#bulk-actions-btn"),
      bulkSelectedCount: utils.dom("#bulk-selected-count"),
      bulkActionsModal: utils.dom("#bulk-actions-modal"),
      bulkAddCredits: utils.dom("#bulk-add-credits"),
      bulkChangePlan: utils.dom("#bulk-change-plan"),
      bulkDisableUsers: utils.dom("#bulk-disable-users"),
      alertsList: utils.dom("#alerts-list"),
      alertsSeverityFilter: utils.dom("#alerts-severity-filter"),
      markAllReadBtn: utils.dom("#mark-all-read-btn"),
      userActivityModal: utils.dom("#user-activity-modal"),
      userActivityTitle: utils.dom("#user-activity-title"),
      userActivityTimeline: utils.dom("#user-activity-timeline"),
      performanceRange: utils.dom("#performance-range"),
      performanceMetrics: {
        apiResponse: utils.dom('[data-perf="api-response"]'),
        errorRate: utils.dom('[data-perf="error-rate"]'),
        connections: utils.dom('[data-perf="connections"]'),
        uptime: utils.dom('[data-perf="uptime"]')
      },
      contactTable: utils.dom("#contact-table tbody"),
      contactStatusFilter: utils.dom("#contact-status-filter"),
      contactSearch: utils.dom("#contact-search"),
      exportContacts: utils.dom("#export-contacts-btn"),
      specUsageRange: utils.dom("#spec-usage-range"),
      specUsageSearch: utils.dom("#spec-usage-search"),
      specUsageTable: utils.dom("#spec-usage-table tbody"),
      specUsageSummary: utils.dom("#spec-usage-summary")
    };

    if (this.dom.blogFields.date && !this.dom.blogFields.date.value) {
      this.dom.blogFields.date.value = utils.now().toISOString().slice(0, 10);
    }

    this.blogSubmitButton = this.dom.blogForm?.querySelector("button.primary") || null;
    this.blogSubmitDefaultText = this.blogSubmitButton?.innerHTML || "Publish post";
    this.editingPost = null;

    this.sourceState = {
      users: "pending",
      entitlements: "pending",
      specs: "pending",
      purchases: "pending",
      activityLogs: "pending",
      blogQueue: "pending"
    };
    this.sourceMessages = {};

    // API Health Check state
    this.apiHealthCheckInProgress = false;

    const specViewerElements = {
      root: utils.dom("#spec-viewer"),
      backdrop: utils.dom("#spec-viewer .modal-backdrop"),
      dismissButtons: utils.domAll('#spec-viewer [data-modal-dismiss]'),
      list: utils.dom("#spec-list"),
      search: utils.dom("#spec-search-input")
    };
    this.specViewer = new SpecViewerModal(this.store, specViewerElements);

    const globalSearchElements = {
      root: utils.dom("#global-search"),
      results: utils.dom("#global-search-results"),
      input: utils.dom("#global-search-input"),
      openTrigger: utils.dom("#global-search-trigger"),
      closeTrigger: utils.dom("#global-search-close"),
      backdrop: utils.dom("#global-search-backdrop"),
      specViewer: this.specViewer
    };
    this.globalSearch = new GlobalSearch(this.store, globalSearchElements);

    this.bindNavigation();
    this.bindInteractions();
    this.setupAuthGate();
  }

  bindNavigation() {
    this.dom.navButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.target;
        if (!target) return;
        this.dom.navButtons.forEach((btn) => btn.classList.remove("active"));
        button.classList.add("active");
        this.dom.sections.forEach((section) => {
          if (section.id === target) {
            section.classList.add("active");
            section.scrollIntoView({ behavior: "smooth", block: "start" });
            // Load contact submissions when contact section is opened
            if (target === "contact-section") {
              this.loadContactSubmissions();
            }
            // Render spec usage when spec usage section is opened
            if (target === "spec-usage-section") {
              this.renderSpecUsageAnalytics();
            }
          } else {
            section.classList.remove("active");
          }
        });
      });
    });
  }

  bindInteractions() {
    this.dom.manualRefresh?.addEventListener("click", () => this.refreshAllData("manual"));
    this.dom.syncUsersButton?.addEventListener("click", () => this.syncUsersManually());
    this.dom.apiHealth.checkButton?.addEventListener("click", () => this.performApiHealthCheck());
    this.dom.apiHealth.copyButton?.addEventListener("click", () => this.copyHealthCheckLogs());
    this.dom.signOut?.addEventListener("click", async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Error signing out", error);
      }
    });
    this.dom.overviewRange?.addEventListener("change", () => this.updateOverview());
    this.dom.toggleActivity?.addEventListener("click", () => this.toggleActivityStream());
    this.dom.usersSearch?.addEventListener("input", utils.debounce(() => {
      this.usersCurrentPage = 1; // Reset to first page on search
      this.renderUsersTable();
    }, 120));
    this.dom.usersPlanFilter?.addEventListener("change", () => {
      this.usersCurrentPage = 1; // Reset to first page on filter change
      this.renderUsersTable();
    });
    this.dom.contactStatusFilter?.addEventListener("change", () => this.loadContactSubmissions());
    this.dom.contactSearch?.addEventListener("input", utils.debounce(() => {
      this.renderContactTable();
    }, 300));
    this.dom.exportContacts?.addEventListener("click", () => this.exportContactsCsv());
    this.dom.specUsageRange?.addEventListener("change", () => this.renderSpecUsageAnalytics());
    this.dom.specUsageSearch?.addEventListener("input", utils.debounce(() => {
      this.renderSpecUsageAnalytics();
    }, 300));
    this.dom.usersStatusFilter?.addEventListener("change", () => {
      this.usersCurrentPage = 1;
      this.renderUsersTable();
    });
    this.dom.usersDateFrom?.addEventListener("change", () => {
      this.usersCurrentPage = 1;
      this.renderUsersTable();
    });
    this.dom.usersDateTo?.addEventListener("change", () => {
      this.usersCurrentPage = 1;
      this.renderUsersTable();
    });
    this.dom.usersSelectAll?.addEventListener("change", (e) => {
      this.toggleSelectAllUsers(e.target.checked);
    });
    this.dom.exportUsers?.addEventListener("click", () => this.exportUsersCsv());
    this.dom.exportUsersPdf?.addEventListener("click", () => this.exportUsersPdf());
    this.dom.bulkActionsBtn?.addEventListener("click", () => {
      this.dom.bulkActionsModal?.classList.remove("hidden");
    });
    this.dom.quickActions.addCredits?.addEventListener("click", () => this.openQuickAction("add-credits"));
    this.dom.quickActions.changePlan?.addEventListener("click", () => this.openQuickAction("change-plan"));
    this.dom.quickActions.resetPassword?.addEventListener("click", () => this.openQuickAction("reset-password"));
    this.dom.quickActions.toggleUser?.addEventListener("click", () => this.openQuickAction("toggle-user"));
    this.dom.alertsSeverityFilter?.addEventListener("change", () => this.renderAlerts());
    this.dom.markAllReadBtn?.addEventListener("click", () => this.markAllAlertsRead());
    this.dom.performanceRange?.addEventListener("change", () => this.updatePerformanceMetrics());
    this.dom.usersPaginationPrev?.addEventListener("click", () => {
      if (this.usersCurrentPage > 1) {
        this.usersCurrentPage--;
        this.renderUsersTable();
      }
    });
    this.dom.usersPaginationNext?.addEventListener("click", () => {
      this.usersCurrentPage++;
      this.renderUsersTable();
    });
    this.dom.paymentsSearch?.addEventListener("input", utils.debounce(() => this.renderPaymentsTable(), 120));
    this.dom.paymentsRange?.addEventListener("change", () => this.renderPaymentsTable());
    this.dom.logsFilter?.addEventListener("change", () => this.renderLogs());
    if (this.dom.blogFields.description) {
      this.dom.blogFields.description.addEventListener("input", () => {
        const count = this.dom.blogFields.description.value.length;
        if (this.dom.blogFields.descriptionCount) {
          this.dom.blogFields.descriptionCount.textContent = `${count} / 160`;
        }
      });
    }
    this.dom.blogFields.title?.addEventListener("input", () => {
      if (!this.dom.blogFields.slug) return;
      if (!this.dom.blogFields.slug.dataset.manual) {
        this.dom.blogFields.slug.value = utils.sanitizeSlug(
          this.dom.blogFields.title.value || ""
        );
      }
    });
    this.dom.blogFields.slug?.addEventListener("input", () => {
      const currentValue = this.dom.blogFields.slug.value.trim();
      if (currentValue) {
        this.dom.blogFields.slug.dataset.manual = "true";
      } else {
        delete this.dom.blogFields.slug.dataset.manual;
      }
    });
    this.dom.blogForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handleBlogSubmit();
    });
    this.dom.blogPreview?.addEventListener("click", () => this.showBlogPreview());
    this.dom.refreshQueue?.addEventListener("click", async () => {
      try {
        await this.refreshBlogQueue();
        this.setBlogFeedback("Queue refreshed.", "success");
      } catch (error) {
        // refreshBlogQueue already handled feedback/logging when not silent
      }
    });
    this.dom.statsRangeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.dom.statsRangeButtons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.updateStatistics();
      });
    });
    this.dom.statsStartDate?.addEventListener("change", () => this.updateStatistics());
    this.dom.statsEndDate?.addEventListener("change", () => this.updateStatistics());

    this.dom.activityDetail.close?.addEventListener("click", () => {
      this.hideActivityDetail();
    });
    if (this.dom.activityFilterButtons.length) {
      this.dom.activityFilterButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          this.dom.activityFilterButtons.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          this.activeActivityFilter = btn.dataset.filter || "all";
          this.renderActivityFeed();
        });
            });
        }
    }

  setupAuthGate() {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        this.redirectToLogin();
        return;
      }
      const email = user.email?.toLowerCase();
      if (!email || !ADMIN_EMAILS.has(email)) {
        alert("Access denied. You must be an admin to view this dashboard.");
        this.redirectToLogin();
        return;
      }
      this.currentUser = user;
      await this.start();
    });
  }

  redirectToLogin() {
    window.location.href = "/pages/auth.html";
  }

  async start() {
    this.updateConnectionState("pending", "Connecting…");
    this.initializeCharts();
    await this.subscribeToSources();
    // Initialize auto refresh timer (will schedule for 24h from now if no manual refresh)
    this.updateAutoRefreshTimer();
    await this.fetchUserSyncStatus();
    this.loadAlerts();
    this.updatePerformanceMetrics();
    // Set up periodic updates for alerts and performance
    setInterval(() => {
      this.loadAlerts();
      this.updatePerformanceMetrics();
    }, 60000); // Update every minute
  }

  initializeCharts() {
    const ChartConstructor = ChartLib || window.Chart;
    if (!ChartConstructor) {
      console.warn("Chart.js not available. Skipping chart initialization.");
            return;
        }

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      color: "#f5f5f5",
      scales: {
        x: {
          ticks: { color: "#a6a6a6" },
          grid: { color: "rgba(255,255,255,0.06)" }
        },
        y: {
          ticks: { color: "#a6a6a6" },
          grid: { color: "rgba(255,255,255,0.06)" }
        }
      },
      plugins: {
        legend: { display: false }
      }
    };
    const planCtx = document.getElementById("users-plan-chart");
    if (planCtx) {
      this.charts.usersPlan = new ChartConstructor(planCtx, {
        type: "doughnut",
        data: {
          labels: ["Pro", "Free"],
          datasets: [
            {
              data: [0, 0],
              backgroundColor: ["#7f8dff", "#1f1f1f"],
              borderWidth: 0
            }
          ]
        },
        options: {
          cutout: "60%",
          plugins: {
            legend: { position: "bottom", labels: { color: "#a6a6a6" } }
          }
        }
      });
    }
    const specsCtx = document.getElementById("specs-timeline-chart");
    if (specsCtx) {
      this.charts.specsTimeline = new ChartConstructor(specsCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Specs",
              data: [],
              borderColor: "#7f8dff",
              backgroundColor: "rgba(127,141,255,0.2)",
              tension: 0.3,
              fill: true
            }
          ]
        },
        options: defaultOptions
      });
    }
    const revenueCtx = document.getElementById("revenue-trend-chart");
    if (revenueCtx) {
      this.charts.revenueTrend = new ChartConstructor(revenueCtx, {
        type: "bar",
        data: {
          labels: [],
          datasets: [
            {
              label: "Revenue",
              data: [],
              backgroundColor: "#6bdcff"
            }
          ]
        },
        options: defaultOptions
      });
    }
    const usersGrowthCtx = document.getElementById("users-growth-chart");
    if (usersGrowthCtx) {
      this.charts.usersGrowth = new ChartConstructor(usersGrowthCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Users",
              data: [],
              borderColor: "#ff6b35",
              backgroundColor: "rgba(255, 107, 53, 0.2)",
              tension: 0.3,
              fill: true
            }
          ]
        },
        options: {
          ...defaultOptions,
          plugins: {
            legend: { display: true, position: "top", labels: { color: "#a6a6a6" } }
          }
        }
      });
    }
    const specsGrowthCtx = document.getElementById("specs-growth-chart");
    if (specsGrowthCtx) {
      this.charts.specsGrowth = new ChartConstructor(specsGrowthCtx, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Specs",
              data: [],
              borderColor: "#18b47d",
              backgroundColor: "rgba(24, 180, 125, 0.2)",
              tension: 0.3,
              fill: true
            }
          ]
        },
        options: {
          ...defaultOptions,
          plugins: {
            legend: { display: true, position: "top", labels: { color: "#a6a6a6" } }
          }
        }
      });
    }
  }

  async subscribeToSources() {
    this.unsubscribeAll();
    this.store.reset();
    this.updateAllSources("pending");

    let usersInitialLoad = true;

    // Users
    try {
      const unsubUsers = onSnapshot(
        collection(db, COLLECTIONS.USERS),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "removed") {
              this.store.removeUser(change.doc.id);
            } else {
              const user = this.store.upsertUser(change.doc.id, change.doc.data());
              if (!usersInitialLoad && change.type === "added") {
                console.debug("[Users] New user detected", {
                  id: change.doc.id,
                  email: user.email,
                  createdAt: user.createdAt?.toISOString?.() || user.createdAt,
                  plan: user.plan
                });
                this.store.recordActivity({
                  type: "user",
                  title: `New user · ${user.displayName || user.email || change.doc.id}`,
                  description: user.email || user.displayName || change.doc.id,
                  timestamp: user.createdAt || utils.now(),
                  meta: {
                    userId: change.doc.id,
                    email: user.email,
                    userEmail: user.email,
                    userName: user.displayName,
                    plan: user.plan
                  }
                });
                // Immediately render activity feed to show new user event
                this.renderActivityFeed();
              }
            }
          });
          console.debug("[Users] Snapshot applied", {
            total: this.store.users.size,
            changes: snapshot.docChanges().length,
            initialLoad: usersInitialLoad
          });
          this.markSourceReady("users");
          this.renderUsersTable();
          this.updateOverview();
          this.rebuildSearchIndex();
          usersInitialLoad = false;
        },
        (error) => {
          console.error("Users listener error", error);
          this.markSourceError("users", error);
        }
      );
      this.unsubscribeFns.push(unsubUsers);
        } catch (error) {
      console.error("Failed to subscribe to users", error);
      this.markSourceError("users", error);
    }

    // Entitlements
    try {
      const unsubEntitlements = onSnapshot(
        collection(db, COLLECTIONS.ENTITLEMENTS),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "removed") {
              this.store.removeEntitlement(change.doc.id);
            } else {
              this.store.upsertEntitlement(change.doc.id, change.doc.data());
            }
          });
          this.markSourceReady("entitlements");
          this.renderUsersTable();
        },
        (error) => {
          console.error("Entitlements listener error", error);
          this.markSourceError("entitlements", error);
        }
      );
      this.unsubscribeFns.push(unsubEntitlements);
        } catch (error) {
      console.error("Failed to subscribe to entitlements", error);
      this.markSourceError("entitlements", error);
    }

    // Specs
    try {
      const specsQuery = query(
        collection(db, COLLECTIONS.SPECS),
        orderBy("createdAt", "desc"),
        limit(MAX_SPEC_CACHE)
      );
      const unsubSpecs = onSnapshot(
        specsQuery,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "removed") {
              this.store.removeSpec(change.doc.id);
            } else {
              const spec = this.store.upsertSpec(change.doc.id, change.doc.data());
              if (change.type === "added") {
                const user = this.store.getUser(spec.userId);
                this.store.recordActivity({
                  type: "spec",
                  title: `Spec created · ${spec.title}`,
                  description: user?.email || spec.userId || "",
                  timestamp: spec.createdAt,
                  meta: { 
                    userId: spec.userId, 
                    specId: spec.id,
                    userName: user?.displayName,
                    email: user?.email,
                    userEmail: user?.email
                  }
                });
              }
            }
          });
          this.markSourceReady("specs");
          this.renderUsersTable();
          this.updateOverview();
          this.renderLogs();
          this.updateStatistics();
          this.rebuildSearchIndex();
          // Render spec usage if section is active
          if (this.dom.specUsageTable?.closest('.dashboard-section.active')) {
            this.renderSpecUsageAnalytics();
          }
        },
        (error) => {
          console.error("Specs listener error", error);
          this.markSourceError("specs", error);
        }
      );
      this.unsubscribeFns.push(unsubSpecs);
    } catch (error) {
      console.error("Failed to subscribe to specs", error);
      this.markSourceError("specs", error);
    }

    // Purchases
    try {
      const purchasesQuery = query(
        collection(db, COLLECTIONS.PURCHASES),
        orderBy("createdAt", "desc"),
        limit(MAX_PURCHASES)
      );
      const unsubPurchases = onSnapshot(
        purchasesQuery,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "removed") {
              this.store.removePurchase(change.doc.id);
            } else {
              const purchase = this.store.upsertPurchase(change.doc.id, change.doc.data());
              if (change.type === "added") {
                const user = this.store.getUser(purchase.userId);
                this.store.recordActivity({
                  type: purchase.productType === "subscription" ? "subscription" : "payment",
                  title: `${purchase.productName}`,
                  description: `${utils.formatCurrency(purchase.total, purchase.currency)} • ${purchase.email || purchase.userId || "Unknown user"}`,
                  timestamp: purchase.createdAt,
                  meta: { 
                    userId: purchase.userId, 
                    purchaseId: purchase.id,
                    userName: user?.displayName,
                    email: purchase.email || user?.email,
                    userEmail: purchase.email || user?.email
                  }
                });
              }
            }
          });
          this.markSourceReady("purchases");
          this.renderPaymentsTable();
          this.updateOverview();
          this.renderLogs();
          this.updateStatistics();
          this.rebuildSearchIndex();
        },
        (error) => {
          console.error("Purchases listener error", error);
          this.markSourceError("purchases", error);
        }
      );
      this.unsubscribeFns.push(unsubPurchases);
    } catch (error) {
      console.error("Failed to subscribe to purchases", error);
      this.markSourceError("purchases", error);
    }

    // Activity logs (optional)
    try {
      const activityQuery = query(
        collection(db, COLLECTIONS.ACTIVITY_LOGS),
        orderBy("timestamp", "desc"),
        limit(MAX_ACTIVITY_EVENTS)
      );
      const unsubActivity = onSnapshot(
        activityQuery,
        (snapshot) => {
          const events = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              type: data.type || "system",
              title: data.title || data.event || "Activity",
              description: data.description || data.message || "",
              timestamp: utils.toDate(data.timestamp),
              meta: data
            };
        });
          this.store.setActivity(events);
          this.markSourceReady("activityLogs");
          this.renderLogs();
        },
        (error) => {
          if (error?.code === "permission-denied") {
            console.info("Activity logs access restricted for current user.");
            this.markSourceRestricted("activityLogs", "Requires elevated Firebase permissions.");
          } else {
            console.warn("Activity logs listener error", error);
            this.markSourceError("activityLogs", error);
          }
        }
      );
      this.unsubscribeFns.push(unsubActivity);
    } catch (error) {
      if (error?.code === "permission-denied") {
        console.info("Activity logs collection restricted for current user.");
        this.markSourceRestricted("activityLogs", "Requires elevated Firebase permissions.");
      } else {
        console.warn("Activity logs collection unavailable", error);
        this.markSourceError("activityLogs", error);
      }
    }

    // Blog queue (via API)
    try {
      await this.refreshBlogQueue({ silent: true });
      this.markSourceReady("blogQueue");
        } catch (error) {
      if (error?.status === 403) {
        console.info("Blog queue access restricted for current user.");
        this.markSourceRestricted("blogQueue", "Requires blog queue privileges.");
      } else if (error?.status === 401) {
        console.info("Blog queue requires authentication.");
        this.markSourceError("blogQueue", "Authentication required.");
      } else {
        console.warn("Blog queue unavailable", error);
        this.markSourceError("blogQueue", error);
      }
    }
  }

  updateAllSources(state) {
    Object.keys(this.sourceState).forEach((key) => {
      this.sourceState[key] = state;
    });
    this.renderSourceStates();
  }

  markSourceReady(key) {
    this.sourceState[key] = "ready";
    this.renderSourceStates();
    this.updateConnectionStatus();
  }

  markSourceError(key, error) {
    this.sourceState[key] = "error";
    this.renderSourceStates();
    if (error) {
      console.error(`Source ${key} error`, error);
    }
    this.updateConnectionStatus();
  }

  markSourceRestricted(key, message) {
    this.sourceState[key] = "restricted";
    if (message) {
      this.sourceMessages[key] = message;
    }
    this.renderSourceStates();
    this.updateConnectionStatus();
  }

  renderSourceStates() {
    if (!this.dom.sourceList) return;
    this.dom.sourceList.querySelectorAll(".source-state").forEach((el) => {
      const key = el.dataset.source;
      const state = this.sourceState[key] || "pending";
      let label = state;
      if (state === "ready") label = "Ready";
      if (state === "pending") label = "Pending";
      if (state === "error") label = "Error";
      if (state === "restricted") label = "Restricted";
      el.textContent = label;
      el.title = this.sourceMessages[key] || "";
      el.classList.remove("ready", "error", "restricted");
      if (state === "ready") el.classList.add("ready");
      if (state === "error") el.classList.add("error");
      if (state === "restricted") el.classList.add("restricted");
    });
  }

  updateConnectionStatus() {
    const states = Object.values(this.sourceState);
    if (states.every((state) => state === "ready" || state === "restricted")) {
      this.updateConnectionState("online", "Realtime sync active");
      const now = utils.now();
      if (this.dom.sidebarLastSync) {
        this.dom.sidebarLastSync.textContent = utils.formatDate(now);
      }
    } else if (states.some((state) => state === "error")) {
      this.updateConnectionState("offline", "Connection issues detected");
    } else {
      this.updateConnectionState("pending", "Connecting…");
    }
  }

  updateConnectionState(state, label) {
    if (this.dom.statusIndicator) {
      this.dom.statusIndicator.classList.remove(
        "status-online",
        "status-offline",
        "status-pending"
      );
      this.dom.statusIndicator.classList.add(
        state === "online"
          ? "status-online"
          : state === "offline"
          ? "status-offline"
          : "status-pending"
      );
    }
    if (this.dom.statusLabel) {
      this.dom.statusLabel.textContent = label;
    }
    if (this.dom.topbarStatus) {
      this.dom.topbarStatus.textContent = label;
    }
  }

  toggleActivityStream() {
    this.isActivityPaused = !this.isActivityPaused;
    if (this.dom.toggleActivity) {
      const icon = this.dom.toggleActivity.querySelector("i");
      if (icon) {
        icon.classList.toggle("fa-pause", !this.isActivityPaused);
        icon.classList.toggle("fa-play", this.isActivityPaused);
      }
      this.dom.toggleActivity.innerHTML = `
        <i class="fas ${this.isActivityPaused ? "fa-play" : "fa-pause"}"></i>
        ${this.isActivityPaused ? "Resume stream" : "Pause stream"}
      `;
    }
  }

  renderUsersTable() {
    if (!this.dom.usersTable) return;
    const searchTerm = this.dom.usersSearch?.value.trim().toLowerCase() ?? "";
    const planFilter = this.dom.usersPlanFilter?.value ?? "all";
    const statusFilter = this.dom.usersStatusFilter?.value ?? "all";
    const dateFrom = this.dom.usersDateFrom?.value;
    const dateTo = this.dom.usersDateTo?.value;
    const filteredUsers = [];

    // First, filter users
    for (const user of this.store.getUsersSorted()) {
      if (searchTerm) {
        const haystack = [user.email, user.displayName, user.id].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(searchTerm)) continue;
      }
      if (planFilter !== "all" && user.plan !== planFilter) continue;
      
      // Status filter (active/inactive based on lastActive)
      if (statusFilter !== "all") {
        const now = Date.now();
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        const isActive = user.lastActive && user.lastActive.getTime() >= thirtyDaysAgo;
        if (statusFilter === "active" && !isActive) continue;
        if (statusFilter === "inactive" && isActive) continue;
      }
      
      // Date filters
      if (dateFrom && user.createdAt) {
        const userDate = new Date(user.createdAt);
        const fromDate = new Date(dateFrom);
        if (userDate < fromDate) continue;
      }
      if (dateTo && user.createdAt) {
        const userDate = new Date(user.createdAt);
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        if (userDate > toDate) continue;
      }
      
      filteredUsers.push(user);
    }

    // Calculate pagination
    const totalUsers = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalUsers / this.usersPerPage));
    
    // Ensure current page is valid
    if (this.usersCurrentPage > totalPages) {
      this.usersCurrentPage = totalPages;
    }
    if (this.usersCurrentPage < 1) {
      this.usersCurrentPage = 1;
    }

    // Get users for current page
    const startIndex = (this.usersCurrentPage - 1) * this.usersPerPage;
    const endIndex = Math.min(startIndex + this.usersPerPage, totalUsers);
    const usersForPage = filteredUsers.slice(startIndex, endIndex);

    // Build rows for current page
    const rows = [];
    for (const user of usersForPage) {
      const entitlement = this.store.getEntitlement(user.id);
      const specCount = this.store.getSpecCount(user.id);
      const planBadge = `<span class="badge ${user.plan}">${user.plan}</span>`;
      
      // Calculate credits: check entitlement first, then fallback to free_specs_remaining
      let credits = "—";
      if (entitlement?.unlimited) {
        credits = "Unlimited";
      } else if (entitlement?.specCredits != null) {
        credits = entitlement.specCredits;
      } else if (user.freeSpecsRemaining != null) {
        // Fallback to free_specs_remaining from user document
        credits = user.freeSpecsRemaining;
      } else {
        // If no credits info found, default to 0 for display
        credits = 0;
      }
      const isSelected = this.selectedUsers.has(user.id);
      rows.push(`
        <tr data-user-id="${user.id}">
          <td>
            <input type="checkbox" data-user-id="${user.id}" ${isSelected ? "checked" : ""}>
          </td>
          <td>
            <div>${user.email || user.displayName || user.id || "Unknown"}</div>
            <div class="meta-text">${user.email || user.id || "No email"}</div>
          </td>
          <td>${utils.formatDate(user.createdAt)}</td>
          <td>${planBadge}</td>
          <td>${utils.formatNumber(specCount)}</td>
          <td>${credits}</td>
          <td>${utils.formatRelative(user.lastActive)}</td>
          <td>
            <div class="table-actions">
              <button class="table-action-btn" data-action="view-specs" data-user-id="${user.id}">
                <i class="fas fa-file-alt"></i> View specs
              </button>
              ${user.email ? `<button class="table-action-btn" data-action="copy-email" data-email="${user.email}">
                <i class="fas fa-copy"></i> Copy email
              </button>` : ""}
            </div>
          </td>
        </tr>
      `);
    }

    // Render table
    if (!rows.length) {
      this.dom.usersTable.innerHTML = `<tr><td colspan="8" class="table-empty">No users match the filter.</td></tr>`;
      if (this.dom.usersPagination) {
        this.dom.usersPagination.style.display = "none";
      }
    } else {
      this.dom.usersTable.innerHTML = rows.join("");
      this.renderUsersPagination(totalUsers, totalPages, startIndex + 1, endIndex);
      
      // Bind checkbox events
      this.dom.usersTable.querySelectorAll('input[type="checkbox"][data-user-id]').forEach(checkbox => {
        checkbox.addEventListener("change", (e) => {
          const userId = checkbox.dataset.userId;
          if (e.target.checked) {
            this.selectedUsers.add(userId);
          } else {
            this.selectedUsers.delete(userId);
          }
          this.updateBulkActionsUI();
          // Update select all checkbox
          if (this.dom.usersSelectAll) {
            const allChecked = Array.from(this.dom.usersTable.querySelectorAll('input[type="checkbox"][data-user-id]')).every(cb => cb.checked);
            this.dom.usersSelectAll.checked = allChecked;
          }
        });
      });
    }

    this.dom.usersTable
      .querySelectorAll('[data-action="view-specs"]')
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const userId = btn.dataset.userId;
          if (!userId) return;
          await this.specViewer.openWithUser(userId);
        });
      });

    this.dom.usersTable
      .querySelectorAll('[data-action="copy-email"]')
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const email = btn.dataset.email;
          if (!email) return;
          navigator.clipboard?.writeText(email);
          btn.classList.add("copied");
          setTimeout(() => btn.classList.remove("copied"), 1000);
        });
      });
  }

  renderUsersPagination(totalUsers, totalPages, startIndex, endIndex) {
    if (!this.dom.usersPagination) return;

    // Show pagination if there are multiple pages
    if (totalPages <= 1) {
      this.dom.usersPagination.style.display = "none";
      return;
    }

    this.dom.usersPagination.style.display = "flex";

    // Update info text
    if (this.dom.usersPaginationInfo) {
      this.dom.usersPaginationInfo.textContent = `Showing ${startIndex}-${endIndex} of ${totalUsers}`;
    }

    // Update prev/next buttons
    if (this.dom.usersPaginationPrev) {
      this.dom.usersPaginationPrev.disabled = this.usersCurrentPage === 1;
    }
    if (this.dom.usersPaginationNext) {
      this.dom.usersPaginationNext.disabled = this.usersCurrentPage >= totalPages;
    }

    // Render page numbers
    if (this.dom.usersPaginationPages) {
      const pages = [];
      const maxVisiblePages = 7; // Show up to 7 page numbers
      let startPage = Math.max(1, this.usersCurrentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

      // Adjust start if we're near the end
      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      // Add first page and ellipsis if needed
      if (startPage > 1) {
        pages.push(`<button class="pagination-page-btn" data-page="1">1</button>`);
        if (startPage > 2) {
          pages.push(`<span class="pagination-ellipsis">…</span>`);
        }
      }

      // Add page numbers
      for (let i = startPage; i <= endPage; i++) {
        const isActive = i === this.usersCurrentPage;
        pages.push(
          `<button class="pagination-page-btn ${isActive ? "active" : ""}" data-page="${i}">${i}</button>`
        );
      }

      // Add last page and ellipsis if needed
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
          pages.push(`<span class="pagination-ellipsis">…</span>`);
        }
        pages.push(`<button class="pagination-page-btn" data-page="${totalPages}">${totalPages}</button>`);
      }

      this.dom.usersPaginationPages.innerHTML = pages.join("");

      // Add click handlers for page buttons
      this.dom.usersPaginationPages
        .querySelectorAll(".pagination-page-btn")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            const page = parseInt(btn.dataset.page);
            if (page && page !== this.usersCurrentPage) {
              this.usersCurrentPage = page;
              this.renderUsersTable();
              // Scroll to top of table
              this.dom.usersTable?.closest(".table-wrapper")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          });
        });
    }
  }

  renderPaymentsTable() {
    if (!this.dom.paymentsTable) return;
    const searchTerm = this.dom.paymentsSearch?.value.trim().toLowerCase() ?? "";
    const range = this.dom.paymentsRange?.value ?? "week";
    const payments = this.store.getPurchases(range);
    const rows = [];

    for (const purchase of payments) {
        if (searchTerm) {
        const haystack = `${purchase.email} ${purchase.productName} ${purchase.productType}`.toLowerCase();
        if (!haystack.includes(searchTerm)) continue;
      }
      rows.push(`
        <tr>
          <td>${utils.formatDate(purchase.createdAt)}</td>
          <td>${purchase.email || purchase.userId || "Unknown user"}</td>
          <td>${purchase.productName}</td>
          <td>${utils.formatCurrency(purchase.total, purchase.currency)}</td>
          <td>${purchase.productType}</td>
          <td>${purchase.status}</td>
        </tr>
      `);
    }

    this.dom.paymentsTable.innerHTML = rows.length
      ? rows.join("")
      : `<tr><td colspan="6" class="table-empty">No payments in this range.</td></tr>`;
  }

  renderLogs() {
    if (!this.dom.logsStream) return;
    const filter = this.dom.logsFilter?.value ?? "all";
    const events = this.store.getActivityMerged();
    const filtered = filter === "all" ? events : events.filter((event) => event.type === filter);

    if (!filtered.length) {
      this.dom.logsStream.innerHTML = `<div class="logs-placeholder">No log events yet.</div>`;
      return;
    }

    const html = filtered
      .map(
        (event) => `
        <article class="log-entry ${event.type}">
          <header>${event.title}</header>
          <div>${event.description || ""}</div>
          <footer class="log-meta">
            <span>${event.type.toUpperCase()}</span>
            <time>${utils.formatDate(event.timestamp)}</time>
          </footer>
        </article>
      `
      )
      .join("");
    if (!this.isActivityPaused) {
      this.dom.logsStream.innerHTML = html;
    }
  }

  updateOverview() {
    const users = this.store.getUsersSorted();
    const overviewRange = this.dom.overviewRange?.value ?? "week";
    const rangeMs = DATE_RANGES[overviewRange] || DATE_RANGES.week;
    const threshold = Date.now() - rangeMs;

    // Users metrics - show total and new in range
    const totalUsers = users.length;
    const usersInRange = users.filter((user) => (user.createdAt?.getTime() || 0) >= threshold);
    const newUsers = usersInRange.length;
    const proUsers = users.filter((user) => user.plan === "pro").length;
    const proUsersInRange = usersInRange.filter((user) => user.plan === "pro").length;
    const proShare = totalUsers ? Math.round((proUsers / totalUsers) * 100) : 0;

    // Live users - users active in last 15 minutes
    const LIVE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
    const liveThreshold = Date.now() - LIVE_THRESHOLD_MS;
    const liveUsers = users.filter((user) => {
      if (!user.lastActive) return false;
      const lastActiveTime = user.lastActive?.getTime() || 0;
      return lastActiveTime >= liveThreshold;
    }).length;

    // Specs metrics - show specs in range, not total
    const specsInRange = Array.from(this.store.specs.values()).filter(
      (spec) => (spec.createdAt?.getTime() || 0) >= threshold
    ).length;
    const specsTotal = Array.from(this.store.specs.values()).length;

    // Revenue metrics - show revenue in range, not total
    const revenueRange = this.store.getPurchases(overviewRange).reduce(
      (sum, purchase) => sum + (purchase.total || 0),
      0
    );
    const revenueTotal = this.store.purchases.reduce(
      (sum, purchase) => sum + (purchase.total || 0),
      0
    );

    // Update display - show range-based data in main metrics
    if (this.dom.metrics.totalUsers) {
      this.dom.metrics.totalUsers.textContent = utils.formatNumber(totalUsers);
    }
    if (this.dom.metrics.newUsers) {
      this.dom.metrics.newUsers.textContent = `New: ${utils.formatNumber(newUsers)}`;
    }
    if (this.dom.metrics.liveUsers) {
      this.dom.metrics.liveUsers.textContent = utils.formatNumber(liveUsers);
    }
    if (this.dom.metrics.liveUsersTime) {
      this.dom.metrics.liveUsersTime.textContent = "Last 15 min";
    }
    if (this.dom.metrics.proUsers) {
      this.dom.metrics.proUsers.textContent = utils.formatNumber(proUsersInRange);
    }
    if (this.dom.metrics.proShare) {
      const proShareInRange = newUsers ? Math.round((proUsersInRange / newUsers) * 100) : 0;
      this.dom.metrics.proShare.textContent = `${proShareInRange || 0}%`;
    }
    if (this.dom.metrics.specsTotal) {
      // Show specs in range as the main metric
      this.dom.metrics.specsTotal.textContent = utils.formatNumber(specsInRange);
    }
    if (this.dom.metrics.specsRange) {
      // Show total specs in the range label
      this.dom.metrics.specsRange.textContent = `Total: ${utils.formatNumber(specsTotal)}`;
    }
    if (this.dom.metrics.revenueTotal) {
      // Show revenue in range as the main metric
      this.dom.metrics.revenueTotal.textContent = utils.formatCurrency(revenueRange);
    }
    if (this.dom.metrics.revenueRange) {
      // Show total revenue in the range label
      this.dom.metrics.revenueRange.textContent = `Total: ${utils.formatCurrency(revenueTotal)}`;
    }

    this.renderActivityFeed();
    this.updateCharts();
  }

  renderActivityFeed() {
    if (!this.dom.activityFeed) return;
    const events = this.store.getActivityMerged();
    if (!events.length) {
      this.dom.activityFeed.innerHTML = `<li class="activity-placeholder">Waiting for events…</li>`;
                return;
            }
    const filter = this.activeActivityFilter || "all";
    const filtered = events.filter((event) => {
      if (filter === "all") return true;
      if (filter === "payment") return event.type === "payment" || event.type === "subscription";
      if (filter === "user") return event.type === "user" || event.type === "auth";
      return event.type === filter;
    });
    if (!filtered.length) {
      this.dom.activityFeed.innerHTML = `<li class="activity-placeholder">No activity in this category.</li>`;
      return;
    }
    const html = filtered.slice(0, 20).map((event) => {
      const user = event.meta?.userId ? this.store.getUser(event.meta.userId) : null;
      const userLabel = event.meta?.email || event.meta?.userEmail || user?.email || event.meta?.userId || "";
      const nameLabel = event.meta?.userName || user?.displayName || user?.email || event.meta?.userId || "Unknown user";
      const badge = userLabel ? `<span class="activity-badge">${userLabel}</span>` : "";
      const icon = this.getActivityIcon(event.type);
      return `
        <li class="activity-item ${event.type}" data-activity-id="${event.id}">
          <div class="activity-item__info">
            <span class="activity-item__title">
              <span class="activity-icon"><i class="${icon}"></i></span>
              ${event.title}
            </span>
            <span class="activity-item__meta">${nameLabel || "Unknown user"} ${badge}</span>
          </div>
          <time>${utils.formatRelative(event.timestamp)}</time>
        </li>
      `;
    }).join("");
    if (!this.isActivityPaused) {
      this.dom.activityFeed.innerHTML = html;
      this.dom.activityFeed.querySelectorAll(".activity-item").forEach((item) => {
        item.addEventListener("click", () => {
          const id = item.dataset.activityId;
          if (id) {
            this.toggleActivityDetail(id, item);
          }
        });
      });
    }
  }

  updateCharts() {
    const users = this.store.getUsersSorted();
    const proUsers = users.filter((user) => user.plan === "pro").length;
    const freeUsers = users.length - proUsers;
    if (this.charts.usersPlan) {
      this.charts.usersPlan.data.datasets[0].data = [proUsers, freeUsers];
      this.charts.usersPlan.update();
    }

    const specsByDay = new Map();
    this.store.specs.forEach((spec) => {
      const date = spec.createdAt
        ? spec.createdAt.toISOString().slice(0, 10)
        : "Unknown";
      specsByDay.set(date, (specsByDay.get(date) || 0) + 1);
    });
    const specsLabels = Array.from(specsByDay.keys()).sort();
    const specsValues = specsLabels.map((label) => specsByDay.get(label));
    if (this.charts.specsTimeline) {
      this.charts.specsTimeline.data.labels = specsLabels;
      this.charts.specsTimeline.data.datasets[0].data = specsValues;
      this.charts.specsTimeline.update();
    }

    const revenueByDay = new Map();
    this.store.purchases.forEach((purchase) => {
      const date = purchase.createdAt
        ? purchase.createdAt.toISOString().slice(0, 10)
        : "Unknown";
      revenueByDay.set(date, (revenueByDay.get(date) || 0) + (purchase.total || 0));
    });
    const revenueLabels = Array.from(revenueByDay.keys()).sort();
    const revenueValues = revenueLabels.map((label) => Number(revenueByDay.get(label).toFixed(2)));
    if (this.charts.revenueTrend) {
      this.charts.revenueTrend.data.labels = revenueLabels;
      this.charts.revenueTrend.data.datasets[0].data = revenueValues;
      this.charts.revenueTrend.update();
    }

    // Users growth chart - cumulative users over time
    const usersByDay = new Map();
    users.forEach((user) => {
      if (user.createdAt) {
        const date = user.createdAt.toISOString().slice(0, 10);
        usersByDay.set(date, (usersByDay.get(date) || 0) + 1);
      }
    });
    const usersLabels = Array.from(usersByDay.keys()).sort();
    // Calculate cumulative values
    let cumulativeUsers = 0;
    const usersValues = usersLabels.map((label) => {
      cumulativeUsers += usersByDay.get(label);
      return cumulativeUsers;
    });
    if (this.charts.usersGrowth) {
      this.charts.usersGrowth.data.labels = usersLabels;
      this.charts.usersGrowth.data.datasets[0].data = usersValues;
      this.charts.usersGrowth.update();
    }

    // Specs growth chart - cumulative specs over time
    const specsByDayCumulative = new Map();
    Array.from(this.store.specs.values()).forEach((spec) => {
      if (spec.createdAt) {
        const date = spec.createdAt.toISOString().slice(0, 10);
        specsByDayCumulative.set(date, (specsByDayCumulative.get(date) || 0) + 1);
      }
    });
    const specsLabelsCumulative = Array.from(specsByDayCumulative.keys()).sort();
    // Calculate cumulative values
    let cumulativeSpecs = 0;
    const specsValuesCumulative = specsLabelsCumulative.map((label) => {
      cumulativeSpecs += specsByDayCumulative.get(label);
      return cumulativeSpecs;
    });
    if (this.charts.specsGrowth) {
      this.charts.specsGrowth.data.labels = specsLabelsCumulative;
      this.charts.specsGrowth.data.datasets[0].data = specsValuesCumulative;
      this.charts.specsGrowth.update();
    }
  }

  updateStatistics() {
    const rangeButton = this.dom.statsRangeButtons.find((btn) => btn.classList.contains("active"));
    const rangeKey = rangeButton?.dataset.range ?? "week";
    const rangeMs = DATE_RANGES[rangeKey] || DATE_RANGES.week;
    const customStart = this.dom.statsStartDate?.value ? new Date(this.dom.statsStartDate.value) : null;
    const customEnd = this.dom.statsEndDate?.value ? new Date(this.dom.statsEndDate.value) : null;
    const endTimestamp = customEnd ? customEnd.getTime() + 24 * 60 * 60 * 1000 : Date.now();
    const startTimestamp = customStart
      ? customStart.getTime()
      : endTimestamp - rangeMs;

    const activeUsers = this.store.getUsersSorted().filter(
      (user) => (user.lastActive?.getTime() || 0) >= startTimestamp
    ).length;
    const specsCreated = Array.from(this.store.specs.values()).filter(
      (spec) => (spec.createdAt?.getTime() || 0) >= startTimestamp
    ).length;
    const purchasesInRange = this.store.purchases.filter((purchase) => (purchase.createdAt?.getTime() || 0) >= startTimestamp);
    const creditsUsed = purchasesInRange.reduce((sum, purchase) => {
      const credits = purchase.metadata?.credits || purchase.metadata?.metadata?.credits || 0;
      return sum + (typeof credits === "number" ? credits : 0);
    }, 0);
    const revenue = purchasesInRange
      .reduce((sum, purchase) => sum + (purchase.total || 0), 0);

    const statsMapping = {
      "active-users": utils.formatNumber(activeUsers),
      "specs-created": utils.formatNumber(specsCreated),
      "credits-used": utils.formatNumber(creditsUsed),
      revenue: utils.formatCurrency(revenue)
    };

    Object.entries(statsMapping).forEach(([key, value]) => {
      const element = utils.dom(`[data-stats="${key}"]`);
      if (element) element.textContent = value;
    });

    const detailMapping = {
      "active-users-change": `From ${utils.formatDate(startTimestamp)} to ${utils.formatDate(endTimestamp)}`,
      "specs-change": `In range: ${utils.formatNumber(specsCreated)}`,
      "credits-change": `Credits purchased: ${utils.formatNumber(creditsUsed)}`,
      "revenue-change": `Revenue in range: ${utils.formatCurrency(revenue)}`
    };
    Object.entries(detailMapping).forEach(([key, value]) => {
      const element = utils.dom(`[data-stats-detail="${key}"]`);
      if (element) element.textContent = value;
    });

    // Update growth charts based on selected range
    this.updateGrowthCharts(startTimestamp, endTimestamp, rangeKey);
  }

  updateGrowthCharts(startTimestamp, endTimestamp, rangeKey) {
    const users = this.store.getUsersSorted();
    const specs = Array.from(this.store.specs.values());

    // Filter data by range
    const usersInRange = users.filter((user) => {
      const createdAt = user.createdAt?.getTime() || 0;
      return createdAt >= startTimestamp && createdAt <= endTimestamp;
    });

    const specsInRange = specs.filter((spec) => {
      const createdAt = spec.createdAt?.getTime() || 0;
      return createdAt >= startTimestamp && createdAt <= endTimestamp;
    });

    // Group by time period based on range
    let groupByFunction;
    let formatLabel;
    
    if (rangeKey === "day") {
      groupByFunction = (date) => date.toISOString().slice(0, 10);
      formatLabel = (dateStr) => {
        const d = new Date(dateStr);
        return `${d.getDate()}/${d.getMonth() + 1}`;
      };
    } else if (rangeKey === "week") {
      groupByFunction = (date) => {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().slice(0, 10);
      };
      formatLabel = (dateStr) => {
        const d = new Date(dateStr);
        return `Week ${Math.ceil((d.getDate()) / 7)}/${d.getMonth() + 1}`;
      };
    } else {
      // month
      groupByFunction = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      formatLabel = (dateStr) => {
        const [year, month] = dateStr.split('-');
        return `${month}/${year.slice(2)}`;
      };
    }

    // Users growth chart
    const usersByPeriod = new Map();
    usersInRange.forEach((user) => {
      if (user.createdAt) {
        const period = groupByFunction(user.createdAt);
        usersByPeriod.set(period, (usersByPeriod.get(period) || 0) + 1);
      }
    });
    const usersPeriodLabels = Array.from(usersByPeriod.keys()).sort();
    let cumulativeUsers = 0;
    const usersPeriodValues = usersPeriodLabels.map((label) => {
      cumulativeUsers += usersByPeriod.get(label);
      return cumulativeUsers;
    });
    if (this.charts.usersGrowth) {
      this.charts.usersGrowth.data.labels = usersPeriodLabels.map(formatLabel);
      this.charts.usersGrowth.data.datasets[0].data = usersPeriodValues;
      this.charts.usersGrowth.update();
    }

    // Specs growth chart
    const specsByPeriod = new Map();
    specsInRange.forEach((spec) => {
      if (spec.createdAt) {
        const period = groupByFunction(spec.createdAt);
        specsByPeriod.set(period, (specsByPeriod.get(period) || 0) + 1);
      }
    });
    const specsPeriodLabels = Array.from(specsByPeriod.keys()).sort();
    let cumulativeSpecs = 0;
    const specsPeriodValues = specsPeriodLabels.map((label) => {
      cumulativeSpecs += specsByPeriod.get(label);
      return cumulativeSpecs;
    });
    if (this.charts.specsGrowth) {
      this.charts.specsGrowth.data.labels = specsPeriodLabels.map(formatLabel);
      this.charts.specsGrowth.data.datasets[0].data = specsPeriodValues;
      this.charts.specsGrowth.update();
    }

    // Update Conversion Funnel
    this.updateConversionFunnel();

    // Update Retention Metrics
    this.updateRetentionMetrics();
  }

  updateConversionFunnel() {
    if (!this.dom.conversionFunnel) return;

    const users = this.store.getUsersSorted();
    const totalUsers = users.length;
    const proUsers = users.filter(u => u.plan === "pro").length;
    const purchases = this.store.purchases;
    const totalPurchases = purchases.length;

    // Calculate conversion rates
    const visitors = totalUsers * 3; // Estimate visitors (3x users)
    const signups = totalUsers;
    const proConversions = proUsers;
    const purchaseConversions = totalPurchases;

    const stages = [
      { label: "Visitors", value: visitors, percentage: 100 },
      { label: "Signups", value: signups, percentage: (signups / visitors) * 100 },
      { label: "Pro Users", value: proConversions, percentage: (proConversions / signups) * 100 },
      { label: "Purchases", value: purchaseConversions, percentage: (purchaseConversions / signups) * 100 }
    ];

    const maxValue = Math.max(...stages.map(s => s.value));

    const html = stages.map(stage => {
      const width = (stage.value / maxValue) * 100;
      return `
        <div class="funnel-stage">
          <div class="funnel-stage-label">${stage.label}</div>
          <div class="funnel-stage-bar">
            <div class="funnel-stage-fill" style="width: ${width}%">${utils.formatNumber(stage.value)}</div>
          </div>
          <div class="funnel-stage-value">${utils.formatNumber(stage.value)}</div>
          <div class="funnel-stage-percentage">${stage.percentage.toFixed(1)}%</div>
        </div>
      `;
    }).join("");

    this.dom.conversionFunnel.innerHTML = html;
  }

  updateRetentionMetrics() {
    if (!this.dom.retentionMetrics) return;

    const users = this.store.getUsersSorted();
    const totalUsers = users.length;
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

    // Calculate DAU (Daily Active Users)
    const dau = users.filter(u => u.lastActive && u.lastActive.getTime() >= oneDayAgo).length;

    // Calculate MAU (Monthly Active Users)
    const mau = users.filter(u => u.lastActive && u.lastActive.getTime() >= thirtyDaysAgo).length;

    // Calculate Retention Rate (users active in last 7 days / users created in last 30 days)
    const usersCreatedLast30Days = users.filter(u => u.createdAt && u.createdAt.getTime() >= thirtyDaysAgo).length;
    const usersActiveLast7Days = users.filter(u => u.lastActive && u.lastActive.getTime() >= sevenDaysAgo).length;
    const retentionRate = usersCreatedLast30Days > 0 
      ? (usersActiveLast7Days / usersCreatedLast30Days) * 100 
      : 0;

    // Calculate Churn Rate (users inactive for 30+ days / total users)
    const inactiveUsers = users.filter(u => !u.lastActive || u.lastActive.getTime() < thirtyDaysAgo).length;
    const churnRate = totalUsers > 0 ? (inactiveUsers / totalUsers) * 100 : 0;

    const html = `
      <div class="retention-card">
        <h4>DAU</h4>
        <div class="retention-value">${utils.formatNumber(dau)}</div>
        <div class="retention-change">Daily Active Users</div>
      </div>
      <div class="retention-card">
        <h4>MAU</h4>
        <div class="retention-value">${utils.formatNumber(mau)}</div>
        <div class="retention-change">Monthly Active Users</div>
      </div>
      <div class="retention-card">
        <h4>Retention Rate</h4>
        <div class="retention-value">${retentionRate.toFixed(1)}%</div>
        <div class="retention-change ${retentionRate >= 50 ? "positive" : "negative"}">
          ${usersActiveLast7Days} / ${usersCreatedLast30Days} users
        </div>
      </div>
      <div class="retention-card">
        <h4>Churn Rate</h4>
        <div class="retention-value">${churnRate.toFixed(1)}%</div>
        <div class="retention-change ${churnRate < 10 ? "positive" : "negative"}">
          ${inactiveUsers} inactive users
        </div>
      </div>
    `;

    this.dom.retentionMetrics.innerHTML = html;
  }

  async exportUsersCsv() {
    const headers = [
      "User ID",
      "Email",
      "Display Name",
      "Plan",
      "Created At",
      "Last Active",
      "Specs Count",
      "Credits",
      "Unlimited",
      "Email Verified"
    ];
    const rows = this.store.getUsersSorted().map((user) => {
      const entitlement = this.store.getEntitlement(user.id);
      
      // Calculate credits: check entitlement first, then fallback to free_specs_remaining
      let credits = "";
      if (entitlement?.unlimited) {
        credits = "Unlimited";
      } else if (entitlement?.specCredits != null) {
        credits = entitlement.specCredits;
      } else if (user.freeSpecsRemaining != null) {
        credits = user.freeSpecsRemaining;
      } else {
        credits = 0;
      }
      
      return [
        user.id,
        user.email,
        user.displayName,
        user.plan,
        utils.formatDate(user.createdAt),
        utils.formatDate(user.lastActive),
        this.store.getSpecCount(user.id),
        credits,
        entitlement?.unlimited ? "yes" : "no",
        user.emailVerified ? "yes" : "no"
      ]
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `specifys-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 0);
  }

  async handleBlogSubmit() {
    if (!this.dom.blogForm) {
      console.error("[BlogPublish] Form not found");
      return;
    }
    
    console.log("[BlogPublish] Starting blog post submission...");
    const isEditing = Boolean(this.editingPost);
    console.log("[BlogPublish] Mode:", isEditing ? "editing" : "creating");
    
    const title = this.dom.blogFields.title?.value.trim() ?? "";
    const description = this.dom.blogFields.description?.value.trim() ?? "";
    const content = this.dom.blogFields.content?.value.trim() ?? "";
    const rawTags = this.dom.blogFields.tags?.value ?? "";
    const slugInput = this.dom.blogFields.slug?.value.trim() ?? "";
    const seoTitle = this.dom.blogFields.seoTitle?.value.trim() ?? "";
    const seoDescription = this.dom.blogFields.seoDescription?.value.trim() ?? "";
    const author = (this.dom.blogFields.author?.value || "specifys.ai Team").trim();
    const dateValue = this.dom.blogFields.date?.value || utils.now().toISOString().slice(0, 10);

    console.log("[BlogPublish] Form data collected:", {
      title: title ? `${title.substring(0, 50)}...` : "(empty)",
      description: description ? `${description.substring(0, 30)}...` : "(empty)",
      content: content ? `${content.substring(0, 30)}...` : "(empty)",
      author,
      date: dateValue,
      hasSlug: !!slugInput,
      tagsCount: rawTags.split(",").filter(t => t.trim()).length
    });

    // Beta: Only title is required
    if (!title) {
      const errorMsg = "Title is required.";
      console.error("[BlogPublish] Validation failed:", errorMsg);
      this.setBlogFeedback(errorMsg, "error");
      return;
    }

    const tags = rawTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const payload = {
      title,
      description: description || "No description",
      content: content || "No content",
      tags,
      date: dateValue,
      author,
      slug: slugInput ? utils.sanitizeSlug(slugInput) : utils.sanitizeSlug(title)
    };

    if (seoTitle) {
      payload.seoTitle = seoTitle;
    }
    if (seoDescription) {
      payload.seoDescription = seoDescription;
    }

    console.log("[BlogPublish] Payload prepared:", {
      ...payload,
      content: payload.content ? `${payload.content.substring(0, 50)}...` : "(empty)",
      description: payload.description ? `${payload.description.substring(0, 30)}...` : "(empty)"
    });

    if (isEditing && this.editingPost?.id) {
      payload.id = this.editingPost.id;
      payload.date = this.editingPost.date || payload.date;
      payload.slug = this.editingPost.slug || payload.slug;
    }

    const button = this.blogSubmitButton;
    const originalText = button?.innerHTML;
    if (button) {
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
      button.disabled = true;
    }
    
    try {
      console.log("[BlogPublish] Getting auth token...");
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error("Failed to get authentication token. Please sign in again.");
      }
      console.log("[BlogPublish] Auth token obtained");
      
      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai.onrender.com";
      const requestUrl = isEditing
        ? `${apiBaseUrl}/api/blog/update-post`
        : `${apiBaseUrl}/api/blog/create-post`;
      
      console.log("[BlogPublish] API URL:", requestUrl);
      console.log("[BlogPublish] Sending request...");
      
      const makeRequest = async (idToken) => {
        console.log("[BlogPublish] Making fetch request with token:", idToken ? `${idToken.substring(0, 20)}...` : "none");
        const response = await fetch(requestUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`
          },
          body: JSON.stringify(payload)
        });
        console.log("[BlogPublish] Response received:", {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        });
        return response;
      };

      let response = await makeRequest(token);
      if (response.status === 401) {
        console.warn("[BlogPublish] Token rejected (401), attempting refresh…");
        const refreshedToken = await this.getAuthToken(true);
        if (!refreshedToken) {
          throw new Error("Unable to refresh authentication token. Please sign in again.");
        }
        console.log("[BlogPublish] Retrying with refreshed token...");
        response = await makeRequest(refreshedToken);
      }
      
      const text = await response.text();
      console.log("[BlogPublish] Response text:", text ? `${text.substring(0, 200)}...` : "(empty)");
      
      let result = null;
      try {
        result = text ? JSON.parse(text) : null;
        console.log("[BlogPublish] Parsed response:", result);
      } catch (parseError) {
        console.error("[BlogPublish] Failed to parse JSON response:", {
          error: parseError.message,
          text: text.substring(0, 500)
        });
        throw new Error(`Server returned invalid response: ${response.status} ${response.statusText}`);
      }
      
      if (!response.ok) {
        console.error("[BlogPublish] Request failed:", {
          url: requestUrl,
          status: response.status,
          statusText: response.statusText,
          result,
          payload: { ...payload, content: payload.content ? `${payload.content.substring(0, 50)}...` : "(empty)" }
        });
        const message =
          result?.error ||
          `Failed to ${isEditing ? "update" : "create"} blog post (HTTP ${response.status} ${response.statusText})`;
        throw new Error(message);
      }
      
      if (!(result && result.success)) {
        console.error("[BlogPublish] Response indicates failure:", {
          result,
          success: result?.success,
          error: result?.error
        });
        const message = result?.error || `Failed to ${isEditing ? "update" : "create"} blog post`;
        throw new Error(message);
      }
      
      console.log("[BlogPublish] Success! Post created/updated:", result.post?.id || "unknown");
      if (isEditing) {
        this.setBlogFeedback("Post updated successfully.", "success");
        this.exitBlogEditMode({ resetForm: true });
        await this.refreshBlogQueue({ silent: true }).catch((queueError) =>
          console.warn("Blog queue refresh failed after update", queueError)
        );
      } else {
        console.log("[BlogPublish] Post created successfully, resetting form...");
        this.setBlogFeedback("✅ Post created successfully!", "success");
        this.dom.blogForm.reset();
        if (this.dom.blogFields.date) {
          this.dom.blogFields.date.value = utils.now().toISOString().slice(0, 10);
        }
        if (this.dom.blogFields.slug) {
          delete this.dom.blogFields.slug.dataset.manual;
        }
        if (this.dom.blogFields.author) {
          this.dom.blogFields.author.value = "specifys.ai Team";
        }
        if (this.dom.blogFields.descriptionCount) {
          this.dom.blogFields.descriptionCount.textContent = "0 / 160";
        }
        try {
          await this.refreshBlogQueue({ silent: true });
        } catch (queueError) {
          console.warn("[BlogPublish] Blog queue refresh failed after publish", queueError);
        }
      }
    } catch (error) {
      console.error("[BlogPublish] ❌ Blog save failed", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      });
      const errorDetails = error.message || `Failed to ${isEditing ? "update" : "create"} blog post.`;
      this.setBlogFeedback(`❌ Error: ${errorDetails}`, "error");
    } finally {
      if (button) {
        button.innerHTML = originalText;
        button.disabled = false;
      }
    }
  }

  async showBlogPreview() {
    const previewModal = document.getElementById("preview-modal");
    const previewArticle = document.getElementById("preview-article");
    if (!previewModal || !previewArticle) return;
    const title = this.dom.blogFields.title?.value.trim();
    const description = this.dom.blogFields.description?.value.trim();
    const content = this.dom.blogFields.content?.value.trim();
    if (!title || !content) {
      alert("Add title and content to preview.");
            return;
        }
    if (!MarkedLib) {
      try {
        const module = await import("https://cdn.jsdelivr.net/npm/marked@11.2.0/lib/marked.esm.js");
        MarkedLib = module.marked ?? module.default ?? null;
      } catch (error) {
        console.error("Failed to load marked", error);
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
      renderedContent = `<pre>${content}</pre>`;
    }
    previewArticle.innerHTML = `
      <h1>${title}</h1>
      ${description ? `<p class="lead">${description}</p>` : ""}
      <hr>
      <div class="content">${renderedContent}</div>
    `;
    previewModal.classList.remove("hidden");
    previewModal
      .querySelectorAll("[data-modal-dismiss]")
      .forEach((btn) => btn.addEventListener("click", () => previewModal.classList.add("hidden")));
    previewModal
      .querySelector(".modal-backdrop")
      ?.addEventListener("click", () => previewModal.classList.add("hidden"));
  }

  setBlogFeedback(message, type) {
    if (!this.dom.blogFeedback) return;
    this.dom.blogFeedback.textContent = message;
    this.dom.blogFeedback.classList.remove("success", "error");
    if (type) this.dom.blogFeedback.classList.add(type);
  }

  async refreshBlogQueue(options = {}) {
    const { silent = false } = options;
    try {
      let token = await this.getAuthToken();
      if (!token) {
        const authError = new Error("Authentication required to refresh blog posts.");
        authError.status = 401;
        throw authError;
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai.onrender.com";
      const requestUrl = `${apiBaseUrl}/api/blog/list-posts`;
      const makeRequest = async (idToken) => {
        return fetch(requestUrl, {
          headers: {
            Authorization: `Bearer ${idToken}`
          }
        });
      };

      let response = await makeRequest(token);
      if (response.status === 401) {
        console.info("[BlogPosts] Token rejected, attempting refresh…");
        token = await this.getAuthToken(true);
        if (!token) {
          const refreshError = new Error("Unable to refresh authentication token.");
          refreshError.status = 401;
          throw refreshError;
        }
        response = await makeRequest(token);
      }

      const text = await response.text();
      let result = null;
      try {
        result = text ? JSON.parse(text) : null;
      } catch (parseError) {
        console.warn("Non-JSON response when loading blog posts", parseError, text);
      }
      if (!response.ok || !(result && result.success)) {
        console.warn("[BlogPosts] Request failed", {
          url: requestUrl,
          status: response.status,
          statusText: response.statusText,
          result
        });
        const message =
          result?.error ||
          `Failed to load blog posts (HTTP ${response.status} ${response.statusText})`;
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      const posts = Array.isArray(result.posts) ? result.posts : [];
      // Posts from API are already extracted from blogQueue structure
      // Map them to the format expected by setBlogQueue
      this.store.setBlogQueue(
        posts.map((post) => ({
          id: post.id,
          postData: {
            title: post.title,
            description: post.description,
            date: post.date,
            author: post.author,
            tags: post.tags,
            slug: post.slug,
            url: post.url,
            published: post.published
          },
          status: post.status || (post.published ? 'completed' : 'pending'),
          createdAt: utils.toDate(post.createdAt),
          updatedAt: utils.toDate(post.updatedAt)
        }))
      );
      this.renderBlogQueue();
      return result;
    } catch (error) {
      if (!silent) {
        this.setBlogFeedback(error.message || "Failed to refresh blog posts.", "error");
      }
      console.error("[BlogPosts] Failed to refresh blog posts", {
        message: error.message,
        status: error.status,
        stack: error.stack
      });
      throw error;
    }
  }

  renderBlogQueue() {
    if (!this.dom.blogQueueList) return;
    if (!this.store.blogQueue.length) {
      this.dom.blogQueueList.innerHTML = `<li class="queue-placeholder">Queue is empty.</li>`;
      return;
    }
    const html = this.store.blogQueue
      .slice(0, 20)
      .map((item) => {
        const statusClass = item.status || "pending";
        const meta = [
          item.createdAt ? `Created ${utils.formatRelative(item.createdAt)}` : null,
          item.startedAt ? `Started ${utils.formatRelative(item.startedAt)}` : null,
          item.completedAt ? `Completed ${utils.formatRelative(item.completedAt)}` : null
        ]
          .filter(Boolean)
          .join(" · ");
        const title = item.postData?.title || item.title || "Untitled post";
        const url = item.postData?.url || item.url;
        return `
          <li class="queue-item ${statusClass}">
            <div class="queue-title">${title}</div>
            <div class="queue-meta">
              <span>${meta}</span>
              <span class="queue-status">${item.status}</span>
                </div>
            ${
              item.error
                ? `<div class="queue-error">Error: ${item.error}</div>`
                : ""
            }
            <div class="queue-actions">
              ${
                url
                  ? `<a href="${url}" target="_blank" rel="noopener">View post</a>`
                  : ""
              }
              ${
                item.id
                  ? `<button class="queue-edit-btn" data-id="${item.id}"><i class="fas fa-edit"></i> Edit</button>`
                  : ""
              }
            </div>
          </li>
        `;
      })
      .join("");
    this.dom.blogQueueList.innerHTML = html;

    this.dom.blogQueueList
      .querySelectorAll(".queue-edit-btn")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.dataset.id;
          if (id) {
            this.enterBlogEditMode(id);
          }
        });
      });
  }

  rebuildSearchIndex() {
    if (this.globalSearch && this.globalSearch.active) {
      const value = this.globalSearch.elements.input?.value;
      if (value) {
        this.globalSearch.executeSearch(value);
      }
    }
  }

  toggleActivityDetail(activityId, element) {
    const events = this.store.getActivityMerged();
    const record = events.find((event) => event.id === activityId);
    if (!record) return;
    const alreadySelected = element.classList.contains("selected");
    this.dom.activityFeed.querySelectorAll(".activity-item").forEach((item) => item.classList.remove("selected"));
    if (alreadySelected) {
      this.hideActivityDetail();
            return;
    }
    element.classList.add("selected");
    this.showActivityDetail(record);
  }

  getActivityIcon(type) {
    switch (type) {
      case "payment":
      case "subscription":
        return "fas fa-hand-holding-dollar";
      case "spec":
        return "fas fa-file-alt";
      case "user":
        return "fas fa-user-plus";
      case "auth":
        return "fas fa-user-check";
      default:
        return "fas fa-info-circle";
    }
  }

  showActivityDetail(event) {
    const panel = this.dom.activityDetail;
    if (!panel.root) return;
    const user = event.meta?.userId ? this.store.getUser(event.meta.userId) : null;
    const name = event.meta?.userName || user?.displayName || user?.email || event.meta?.userId || "Unknown user";
    const email = event.meta?.email || event.meta?.userEmail || user?.email || event.meta?.userId || "Not provided";
    panel.title.textContent = event.title;
    panel.name.textContent = name;
    panel.email.textContent = email;
    panel.userId.textContent = event.meta?.userId || "—";
    panel.time.textContent = `${utils.formatDate(event.timestamp)} (${utils.formatRelative(event.timestamp)})`;
    const contextParts = [];
    if (event.meta?.specId) contextParts.push(`Spec: ${event.meta.specId}`);
    if (event.meta?.purchaseId) contextParts.push(`Purchase: ${event.meta.purchaseId}`);
    if (event.meta?.plan) contextParts.push(`Plan: ${event.meta.plan}`);
    if (event.meta?.description) contextParts.push(event.meta.description);
    panel.context.textContent = contextParts.join(" • ") || "—";
    panel.root.classList.remove("hidden");
  }

  hideActivityDetail() {
    if (this.dom.activityDetail.root) {
      this.dom.activityDetail.root.classList.add("hidden");
    }
    this.dom.activityFeed?.querySelectorAll(".activity-item").forEach((item) => item.classList.remove("selected"));
  }

  async refreshAllData(reason = "manual") {
    console.info(`Refreshing dashboard data (${reason})`);
    this.updateConnectionState("pending", "Refreshing data…");
    
    // Track manual refresh time
    if (reason === "manual" || reason === "manual-user-sync") {
      this.lastManualRefresh = Date.now();
    }
    
    await this.subscribeToSources();
    this.updateAutoRefreshTimer();
  }

  updateAutoRefreshTimer() {
    // Clear existing timer
    if (this.autoRefreshTimer) {
      clearTimeout(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }

    // Calculate next refresh time
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    // If there was a manual refresh in the last 24 hours, schedule auto refresh for 24h after that
    let nextRefreshTime;
    if (this.lastManualRefresh && (now - this.lastManualRefresh) < twentyFourHours) {
      // Schedule auto refresh 24 hours after last manual refresh
      nextRefreshTime = this.lastManualRefresh + twentyFourHours;
    } else {
      // No recent manual refresh, schedule for 24 hours from now
      nextRefreshTime = now + twentyFourHours;
    }
    
    this.nextAutoRefreshAt = new Date(nextRefreshTime);
    
    // Update UI
    if (this.dom.autoRefreshNext) {
      const timeUntilRefresh = nextRefreshTime - now;
      if (timeUntilRefresh > 0) {
        const hours = Math.floor(timeUntilRefresh / (60 * 60 * 1000));
        const minutes = Math.floor((timeUntilRefresh % (60 * 60 * 1000)) / (60 * 1000));
        this.dom.autoRefreshNext.textContent = `Scheduled in ${hours}h ${minutes}m`;
      } else {
        this.dom.autoRefreshNext.textContent = `Scheduled at ${utils.formatDate(this.nextAutoRefreshAt)}`;
      }
    }
    
    // Set up auto refresh timer
    const timeUntilRefresh = nextRefreshTime - now;
    if (timeUntilRefresh > 0) {
      this.autoRefreshTimer = setTimeout(() => {
        // Only auto refresh if no manual refresh happened in the meantime
        const timeSinceLastManual = this.lastManualRefresh ? (Date.now() - this.lastManualRefresh) : Infinity;
        if (timeSinceLastManual >= twentyFourHours) {
          this.refreshAllData("auto");
        } else {
          // Manual refresh happened, reschedule
          this.updateAutoRefreshTimer();
        }
      }, timeUntilRefresh);
    } else {
      // Time already passed, refresh immediately
      this.refreshAllData("auto");
    }
  }

  async getAuthToken(forceRefresh = false) {
    try {
      const user = auth.currentUser;
      if (!user) return null;
      const token = await user.getIdToken(forceRefresh);
      return token;
    } catch (error) {
      console.error("Failed to get auth token", error);
      return null;
    }
  }

  unsubscribeAll() {
    this.unsubscribeFns.forEach((fn) => {
      if (typeof fn === "function") fn();
    });
    this.unsubscribeFns = [];
  }

  updateSyncSummary(message, variant = "info") {
    const summaryEl = this.dom.syncUsersSummary;
    if (!summaryEl) return;
    summaryEl.textContent = message;
    summaryEl.classList.remove("success", "error");
    if (variant === "success") {
      summaryEl.classList.add("success");
    } else if (variant === "error") {
      summaryEl.classList.add("error");
    }
  }

  async parseJsonSafely(response) {
    if (!response) return null;
    try {
      // Clone the response so we can read it multiple times if needed
      const clonedResponse = response.clone();
      return await clonedResponse.json();
    } catch (error) {
      // If JSON parsing fails, try to get text for debugging from a fresh clone
      try {
        const textResponse = response.clone();
        const text = await textResponse.text();
        console.warn('[AdminDashboard] Failed to parse JSON response:', text.substring(0, 200));
        return null;
      } catch (textError) {
        return null;
      }
    }
  }

  buildSyncSummaryDisplay(summary = {}, cached = false) {
    const parts = [];

    if (summary.runAt) {
      parts.push(`Last run ${utils.formatDate(summary.runAt)}`);
    } else {
      parts.push("No sync executed yet");
    }

    parts.push(`Created ${summary.created || 0}`);
    parts.push(`Updated ${summary.updated || 0}`);

    if (typeof summary.errors === "number") {
      parts.push(`Errors ${summary.errors}`);
    }

    if (summary.inconsistencies?.authWithoutFirestore?.total) {
      parts.push(`${summary.inconsistencies.authWithoutFirestore.total} users missing docs`);
    } else if (summary.potentialCreates) {
      parts.push(`${summary.potentialCreates} users missing docs`);
    }

    if (summary.inconsistencies?.missingEntitlements?.total) {
      parts.push(`${summary.inconsistencies.missingEntitlements.total} missing entitlements`);
    } else if (summary.potentialEntitlementCreates) {
      parts.push(`${summary.potentialEntitlementCreates} missing entitlements`);
    }

    if (cached) {
      parts.push("cached");
    }

    const text = parts.join(" · ");
    const variant = summary.errors && summary.errors > 0
      ? "error"
      : (summary.created || summary.updated)
        ? "success"
        : "info";

    return { text, variant };
  }

  async fetchSyncStatusPrimary(token, apiBaseUrl) {
    const response = await fetch(`${apiBaseUrl}/api/admin/users/sync-status`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (response.status === 404) {
      return null;
    }

    const payload = await this.parseJsonSafely(response);

    if (!response.ok || !payload?.success) {
      const message = payload?.error || payload?.details || `HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return {
      summary: payload.summary || {},
      cached: Boolean(payload.cached)
    };
  }

  async fetchSyncStatusLegacy(token, apiBaseUrl) {
    const response = await fetch(`${apiBaseUrl}/api/sync-users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        dryRun: true,
        ensureEntitlements: true,
        includeDataCollections: true
      })
    });

    if (!response.ok) {
      const payload = await this.parseJsonSafely(response);
      const message = payload?.error || payload?.details || `HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    const payload = await this.parseJsonSafely(response);
    
    if (!payload) {
      throw new Error('Invalid response format: server returned non-JSON response');
    }

    if (!payload.success) {
      const message = payload?.error || payload?.details || 'Sync failed';
      throw new Error(message);
    }

    // For legacy endpoint, summary might be at root level or in summary field
    const summary = payload.summary || payload;
    
    if (!summary || typeof summary !== 'object') {
      throw new Error('Invalid response: missing summary data');
    }

    return {
      summary: summary,
      cached: false
    };
  }

  async fetchUserSyncStatus() {
    if (!this.dom.syncUsersSummary) return;
    this.updateSyncSummary("Loading sync status…", "info");
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return;
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai.onrender.com";

      let result = null;
      try {
        result = await this.fetchSyncStatusPrimary(token, apiBaseUrl);
      } catch (error) {
        if (error?.status === 404) {
          result = null;
        } else {
          throw error;
        }
      }

      if (!result) {
        result = await this.fetchSyncStatusLegacy(token, apiBaseUrl);
        console.warn("[AdminDashboard] Fallback to legacy /api/sync-users for sync status");
      }

      const { text, variant } = this.buildSyncSummaryDisplay(result.summary, result.cached);
      this.updateSyncSummary(text, variant);
    } catch (error) {
      this.updateSyncSummary(`Unable to load sync status: ${error.message || error}`, "error");
      console.error("[AdminDashboard] Failed to fetch user sync status", error);
    }
  }

  async syncUsersPrimary(token, apiBaseUrl) {
    const response = await fetch(`${apiBaseUrl}/api/admin/users/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({})
    });

    if (response.status === 404) {
      return null;
    }

    const payload = await this.parseJsonSafely(response);

    if (!response.ok || !payload?.success) {
      const message = payload?.error || payload?.details || `HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return {
      summary: payload.summary || {}
    };
  }

  async syncUsersLegacy(token, apiBaseUrl) {
    const response = await fetch(`${apiBaseUrl}/api/sync-users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        dryRun: false,
        ensureEntitlements: true,
        includeDataCollections: true
      })
    });

    if (!response.ok) {
      const payload = await this.parseJsonSafely(response);
      const message = payload?.error || payload?.details || `HTTP ${response.status}`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    const payload = await this.parseJsonSafely(response);
    
    if (!payload) {
      throw new Error('Invalid response format: server returned non-JSON response');
    }

    if (!payload.success) {
      const message = payload?.error || payload?.details || 'Sync failed';
      throw new Error(message);
    }

    // For legacy endpoint, summary might be at root level or in summary field
    const summary = payload.summary || payload;
    
    return {
      summary: summary || {}
    };
  }

  async syncUsersManually() {
    if (this.syncInProgress) {
      return;
    }

    const button = this.dom.syncUsersButton;
    const originalLabel = button?.innerHTML;

    try {
      this.syncInProgress = true;
      if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Syncing…';
      }
      this.updateSyncSummary("Sync in progress…", "info");

      const token = await this.getAuthToken();
      if (!token) {
        this.updateSyncSummary("Missing admin session. Please sign in again.", "error");
        return;
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai.onrender.com";

      let result = null;
      try {
        result = await this.syncUsersPrimary(token, apiBaseUrl);
      } catch (error) {
        if (error?.status === 404) {
          result = null;
        } else {
          throw error;
        }
      }

      if (!result) {
        result = await this.syncUsersLegacy(token, apiBaseUrl);
        console.warn("[AdminDashboard] Fallback to legacy /api/sync-users for manual sync");
      }

      const summary = result.summary || {};
      const message = `Created ${summary.created || 0} · Updated ${summary.updated || 0} · Errors ${summary.errors || 0}`;
      const variant = summary.errors && summary.errors > 0 ? "error" : "success";
      this.updateSyncSummary(message, variant);

      await this.fetchUserSyncStatus();
      await this.refreshAllData("manual-user-sync");
    } catch (error) {
      this.updateSyncSummary(`User sync failed: ${error.message || error}`, "error");
      console.error("[AdminDashboard] Manual user sync failed", error);
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = originalLabel || '<i class="fas fa-user-check"></i> Sync users';
      }
      this.syncInProgress = false;
    }
  }

  // ===== API Health Check Methods =====

  async performApiHealthCheck() {
    if (this.apiHealthCheckInProgress) {
      return;
    }

    this.apiHealthCheckInProgress = true;
    const button = this.dom.apiHealth.checkButton;
    const responseText = this.dom.apiHealth.responseText;
    const originalLabel = button?.innerHTML;

    try {
      // Update UI
      if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking...';
      }
      if (responseText) {
        responseText.value = "Testing full spec generation flow...\n\nTesting: Backend → Cloudflare Worker → OpenAI\n\nThis uses the same pipeline as real spec generation.";
        responseText.style.color = '';
        responseText.style.backgroundColor = '';
      }

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai.onrender.com";

      // Call the test-spec health check endpoint (uses same flow as real spec generation)
      const response = await fetch(`${apiBaseUrl}/api/health/test-spec`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json"
        }
      });

      // Get response
      const responseData = await response.json();
      
      // Format the response message
      let statusMessage = '';
      let isHealthy = false;

      if (responseData.status === 'healthy' && 
          responseData.backend === 'ok' && 
          responseData.cloudflare === 'ok' && 
          responseData.openai === 'ok') {
        // All systems operational
        isHealthy = true;
        statusMessage = `✅ ALL SYSTEMS OPERATIONAL\n\n`;
        statusMessage += `Backend: ${responseData.backend.toUpperCase()}\n`;
        statusMessage += `Cloudflare Worker: ${responseData.cloudflare.toUpperCase()}\n`;
        statusMessage += `OpenAI API: ${responseData.openai.toUpperCase()}\n`;
        if (responseData.totalResponseTime) {
          statusMessage += `\nTotal Response Time: ${responseData.totalResponseTime}`;
        }
        if (responseData.openaiResponseTime) {
          statusMessage += `\nOpenAI Response Time: ${responseData.openaiResponseTime}`;
        }
        statusMessage += `\n\nTimestamp: ${responseData.timestamp || new Date().toISOString()}`;
      } else {
        // System error detected
        isHealthy = false;
        statusMessage = `❌ SYSTEM ERROR DETECTED\n\n`;
        statusMessage += `Backend: ${responseData.backend?.toUpperCase() || 'UNKNOWN'}\n`;
        statusMessage += `Cloudflare Worker: ${responseData.cloudflare?.toUpperCase() || 'UNKNOWN'}\n`;
        statusMessage += `OpenAI API: ${responseData.openai?.toUpperCase() || 'UNKNOWN'}\n`;
        
        if (responseData.error) {
          statusMessage += `\n⚠️ ERROR DETAILS:\n${responseData.error}\n`;
        }
        
        statusMessage += `\nTimestamp: ${responseData.timestamp || new Date().toISOString()}`;
        statusMessage += `\n\nFull Response:\n${JSON.stringify(responseData, null, 2)}`;
      }
      
      // Display response in textarea with color coding
      if (responseText) {
        responseText.value = statusMessage;
        if (isHealthy) {
          responseText.style.color = '#10b981';
          responseText.style.backgroundColor = '#ecfdf5';
        } else {
          responseText.style.color = '#ef4444';
          responseText.style.backgroundColor = '#fef2f2';
        }
      }

      // Update button with result
      if (button) {
        if (isHealthy) {
          button.innerHTML = '<i class="fas fa-check-circle"></i> System Healthy';
          button.classList.remove('error');
          button.classList.add('success');
          setTimeout(() => {
            button.classList.remove('success');
            button.innerHTML = originalLabel || '<i class="fas fa-heartbeat"></i> Check System Health';
          }, 3000);
        } else {
          button.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error Detected';
          button.classList.remove('success');
          button.classList.add('error');
        }
      }

    } catch (error) {
      // Network error or other exception
      const errorMessage = `❌ CONNECTION ERROR\n\n`;
      const errorDetails = `Failed to connect to health check endpoint.\n\n`;
      const errorInfo = `Error: ${error.message}\n\n`;
      const stackTrace = error.stack ? `Stack:\n${error.stack}` : '';
      
      if (responseText) {
        responseText.value = errorMessage + errorDetails + errorInfo + stackTrace;
        responseText.style.color = '#ef4444';
        responseText.style.backgroundColor = '#fef2f2';
      }
      
      if (button) {
        button.innerHTML = '<i class="fas fa-times-circle"></i> Connection Failed';
        button.classList.remove('success');
        button.classList.add('error');
      }
      
      console.error("[AdminDashboard] API health check failed", error);
    } finally {
      if (button && !button.classList.contains('success') && !button.classList.contains('error')) {
        button.disabled = false;
        button.innerHTML = originalLabel || '<i class="fas fa-heartbeat"></i> Check System Health';
      } else if (button && (button.classList.contains('success') || button.classList.contains('error'))) {
        button.disabled = false;
      }
      this.apiHealthCheckInProgress = false;
    }
  }

  // Copy health check logs to clipboard
  async copyHealthCheckLogs() {
    const responseText = this.dom.apiHealth.responseText;
    const copyButton = this.dom.apiHealth.copyButton;
    
    if (!responseText || !responseText.value || responseText.value.trim() === '') {
      // No content to copy
      if (copyButton) {
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<i class="fas fa-exclamation-circle"></i> No logs to copy';
        setTimeout(() => {
          copyButton.innerHTML = originalText;
        }, 2000);
      }
      return;
    }

    try {
      // Copy to clipboard
      await navigator.clipboard.writeText(responseText.value);
      
      // Visual feedback
      if (copyButton) {
        const originalText = copyButton.innerHTML;
        copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
        copyButton.classList.add('success');
        setTimeout(() => {
          copyButton.innerHTML = originalText;
          copyButton.classList.remove('success');
        }, 2000);
      }
    } catch (error) {
      // Fallback for older browsers
      try {
        responseText.select();
        responseText.setSelectionRange(0, 99999); // For mobile devices
        document.execCommand('copy');
        
        if (copyButton) {
          const originalText = copyButton.innerHTML;
          copyButton.innerHTML = '<i class="fas fa-check"></i> Copied!';
          copyButton.classList.add('success');
          setTimeout(() => {
            copyButton.innerHTML = originalText;
            copyButton.classList.remove('success');
          }, 2000);
        }
      } catch (fallbackError) {
        console.error('[AdminDashboard] Failed to copy logs:', fallbackError);
        if (copyButton) {
          const originalText = copyButton.innerHTML;
          copyButton.innerHTML = '<i class="fas fa-times"></i> Copy failed';
          copyButton.classList.add('error');
          setTimeout(() => {
            copyButton.innerHTML = originalText;
            copyButton.classList.remove('error');
          }, 2000);
        }
      }
    }
  }

  // Quick Actions
  openQuickAction(action) {
    const modal = this.dom.quickActions.modal;
    const title = this.dom.quickActions.modalTitle;
    const body = this.dom.quickActions.modalBody;
    
    if (!modal || !title || !body) return;

    const actions = {
      "add-credits": {
        title: "Add Credits to User",
        content: `
          <form id="quick-action-form" class="quick-action-form">
            <div class="form-group">
              <label for="quick-user-id">User ID or Email</label>
              <input type="text" id="quick-user-id" required placeholder="Enter user ID or email">
            </div>
            <div class="form-group">
              <label for="quick-credits-amount">Amount</label>
              <input type="number" id="quick-credits-amount" required min="1" placeholder="Number of credits">
            </div>
            <div class="form-group">
              <label for="quick-credits-reason">Reason</label>
              <textarea id="quick-credits-reason" rows="3" placeholder="Reason for adding credits"></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="primary">Add Credits</button>
              <button type="button" class="secondary" data-modal-dismiss>Cancel</button>
            </div>
          </form>
        `
      },
      "change-plan": {
        title: "Change User Plan",
        content: `
          <form id="quick-action-form" class="quick-action-form">
            <div class="form-group">
              <label for="quick-user-id-plan">User ID or Email</label>
              <input type="text" id="quick-user-id-plan" required placeholder="Enter user ID or email">
            </div>
            <div class="form-group">
              <label for="quick-plan-select">New Plan</label>
              <select id="quick-plan-select" required>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </select>
            </div>
            <div class="form-actions">
              <button type="submit" class="primary">Change Plan</button>
              <button type="button" class="secondary" data-modal-dismiss>Cancel</button>
            </div>
          </form>
        `
      },
      "reset-password": {
        title: "Reset User Password",
        content: `
          <form id="quick-action-form" class="quick-action-form">
            <div class="form-group">
              <label for="quick-user-id-password">User ID or Email</label>
              <input type="text" id="quick-user-id-password" required placeholder="Enter user ID or email">
            </div>
            <div class="form-group">
              <p class="form-hint">A password reset email will be sent to the user.</p>
            </div>
            <div class="form-actions">
              <button type="submit" class="primary">Send Reset Email</button>
              <button type="button" class="secondary" data-modal-dismiss>Cancel</button>
            </div>
          </form>
        `
      },
      "toggle-user": {
        title: "Disable/Enable User",
        content: `
          <form id="quick-action-form" class="quick-action-form">
            <div class="form-group">
              <label for="quick-user-id-toggle">User ID or Email</label>
              <input type="text" id="quick-user-id-toggle" required placeholder="Enter user ID or email">
            </div>
            <div class="form-group">
              <label for="quick-user-action">Action</label>
              <select id="quick-user-action" required>
                <option value="disable">Disable User</option>
                <option value="enable">Enable User</option>
              </select>
            </div>
            <div class="form-actions">
              <button type="submit" class="primary">Apply</button>
              <button type="button" class="secondary" data-modal-dismiss>Cancel</button>
            </div>
          </form>
        `
      }
    };

    const actionData = actions[action];
    if (!actionData) return;

    title.textContent = actionData.title;
    body.innerHTML = actionData.content;
    modal.classList.remove("hidden");

    // Setup modal dismiss handlers
    const closeModal = () => modal.classList.add("hidden");
    
    // Close button (X)
    const closeBtn = modal.querySelector(".close-btn");
    if (closeBtn) {
      // Remove old listeners and add new one
      const newCloseBtn = closeBtn.cloneNode(true);
      closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
      newCloseBtn.addEventListener("click", closeModal);
    }

    // Dismiss buttons (Cancel)
    modal.querySelectorAll("[data-modal-dismiss]").forEach((btn) => {
      btn.addEventListener("click", closeModal);
    });

    // Backdrop click
    const backdrop = modal.querySelector(".modal-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", closeModal);
    }

    // Bind form submit
    const form = body.querySelector("#quick-action-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.handleQuickAction(action, form);
      });
    }
  }

  async handleQuickAction(action, form) {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not authenticated");

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai.onrender.com";

      let response;
      const userId = form.querySelector("input[type='text']")?.value;

      switch (action) {
        case "add-credits":
          const amount = parseInt(form.querySelector("#quick-credits-amount")?.value);
          const reason = form.querySelector("#quick-credits-reason")?.value || "Admin manual grant";
          response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/credits`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ amount, reason })
          });
          break;
        case "change-plan":
          const plan = form.querySelector("#quick-plan-select")?.value;
          response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/plan`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ plan })
          });
          break;
        case "reset-password":
          response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/reset-password`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            }
          });
          break;
        case "toggle-user":
          const userAction = form.querySelector("#quick-user-action")?.value;
          response = await fetch(`${apiBaseUrl}/api/admin/users/${userId}/toggle`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ disabled: userAction === "disable" })
          });
          break;
      }

      if (response?.ok) {
        alert("Action completed successfully!");
        if (this.dom.quickActions.modal) {
          this.dom.quickActions.modal.classList.add("hidden");
        }
        this.refreshAllData();
      } else {
        const error = await response?.json().catch(() => ({}));
        alert(`Error: ${error?.error || error?.message || "Failed to complete action"}`);
      }
    } catch (error) {
      console.error("Quick action error:", error);
      alert(`Error: ${error.message}`);
    }
  }

  // Advanced Filters
  toggleSelectAllUsers(checked) {
    const checkboxes = this.dom.usersTable?.querySelectorAll('input[type="checkbox"][data-user-id]');
    checkboxes?.forEach((checkbox) => {
      checkbox.checked = checked;
      const userId = checkbox.dataset.userId;
      if (checked) {
        this.selectedUsers.add(userId);
      } else {
        this.selectedUsers.delete(userId);
      }
    });
    this.updateBulkActionsUI();
  }

  updateBulkActionsUI() {
    const count = this.selectedUsers.size;
    if (this.dom.bulkSelectedCount) {
      this.dom.bulkSelectedCount.textContent = count;
    }
    if (this.dom.bulkActionsBtn) {
      this.dom.bulkActionsBtn.style.display = count > 0 ? "inline-flex" : "none";
    }
  }

  // Alerts
  async loadAlerts() {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai.onrender.com";

      // Load errors from errorLogs collection
      const errorsResponse = await fetch(`${apiBaseUrl}/api/admin/errors`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (errorsResponse.ok) {
        const data = await errorsResponse.json();
        this.alerts = (data.errors || []).map(err => ({
          id: err.id,
          type: "error",
          severity: err.frequency > 10 ? "critical" : err.frequency > 5 ? "warning" : "info",
          title: err.errorType || "Error",
          description: err.errorMessage,
          timestamp: err.lastOccurrence?.toDate?.() || new Date(),
          frequency: err.frequency
        }));
      }

      // Add user alerts (inactive users, etc.)
      const users = this.store.getUsersSorted();
      const now = Date.now();
      const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);

      users.forEach(user => {
        if (user.disabled) {
          this.alerts.push({
            id: `user-disabled-${user.id}`,
            type: "user",
            severity: "warning",
            title: "Disabled User",
            description: `User ${user.email || user.id} is disabled`,
            timestamp: user.lastActive || user.createdAt,
            userId: user.id
          });
        } else if (user.lastActive && user.lastActive.getTime() < thirtyDaysAgo) {
          this.alerts.push({
            id: `user-inactive-${user.id}`,
            type: "user",
            severity: "info",
            title: "Inactive User",
            description: `User ${user.email || user.id} hasn't been active for 30+ days`,
            timestamp: user.lastActive,
            userId: user.id
          });
        }
      });

      this.renderAlerts();
    } catch (error) {
      console.error("Failed to load alerts:", error);
    }
  }

  renderAlerts() {
    if (!this.dom.alertsList) return;

    const severityFilter = this.dom.alertsSeverityFilter?.value || "all";
    const filtered = severityFilter === "all"
      ? this.alerts
      : this.alerts.filter(a => a.severity === severityFilter);

    if (!filtered.length) {
      this.dom.alertsList.innerHTML = '<div class="alerts-placeholder">No alerts found.</div>';
      return;
    }

    const html = filtered.map(alert => `
      <div class="alert-item ${alert.severity}">
        <div class="alert-icon">
          <i class="fas fa-${alert.severity === "critical" ? "exclamation-triangle" : alert.severity === "warning" ? "exclamation-circle" : "info-circle"}"></i>
        </div>
        <div class="alert-content">
          <div class="alert-title">${alert.title}</div>
          <div class="alert-description">${alert.description}</div>
          <div class="alert-meta">
            <span>${utils.formatRelative(alert.timestamp)}</span>
            ${alert.frequency ? `<span>Occurred ${alert.frequency} times</span>` : ""}
          </div>
        </div>
        <div class="alert-actions">
          ${alert.userId ? `<button class="alert-action-btn" data-user-id="${alert.userId}">View User</button>` : ""}
        </div>
      </div>
    `).join("");

    this.dom.alertsList.innerHTML = html;

    // Bind view user buttons
    this.dom.alertsList.querySelectorAll('[data-user-id]').forEach(btn => {
      btn.addEventListener("click", () => {
        const userId = btn.dataset.userId;
        this.showUserActivity(userId);
      });
    });
  }

  markAllAlertsRead() {
    this.alerts = [];
    this.renderAlerts();
  }

  // User Activity Timeline
  async showUserActivity(userId) {
    if (!this.dom.userActivityModal) return;

    this.dom.userActivityTitle.textContent = `Activity Timeline - ${userId}`;
    this.dom.userActivityTimeline.innerHTML = '<div class="modal-placeholder">Loading...</div>';
    this.dom.userActivityModal.classList.remove("hidden");

    try {
      const user = this.store.getUser(userId);
      const specs = Array.from(this.store.specs.values()).filter(s => s.userId === userId);
      const purchases = this.store.purchases.filter(p => p.userId === userId);
      const activities = this.store.activity.filter(a => a.meta?.userId === userId);

      const timelineItems = [
        ...specs.map(spec => ({
          type: "spec",
          title: `Spec Created: ${spec.title || "Untitled"}`,
          description: `Created at ${utils.formatDate(spec.createdAt)}`,
          timestamp: spec.createdAt
        })),
        ...purchases.map(purchase => ({
          type: "payment",
          title: `Purchase: ${purchase.productName || "Unknown"}`,
          description: `Amount: $${purchase.total || 0}`,
          timestamp: purchase.createdAt
        })),
        ...activities.map(activity => ({
          type: activity.type,
          title: activity.title,
          description: activity.description,
          timestamp: activity.timestamp
        }))
      ].sort((a, b) => (b.timestamp?.getTime() || 0) - (a.timestamp?.getTime() || 0));

      const html = timelineItems.length
        ? `<div class="timeline">${timelineItems.map(item => `
          <div class="timeline-item ${item.type}">
            <div class="timeline-item-header">
              <div class="timeline-item-title">${item.title}</div>
              <div class="timeline-item-time">${utils.formatRelative(item.timestamp)}</div>
            </div>
            <div class="timeline-item-description">${item.description}</div>
          </div>
        `).join("")}</div>`
        : '<div class="modal-placeholder">No activity found for this user.</div>';

      this.dom.userActivityTimeline.innerHTML = html;
    } catch (error) {
      console.error("Failed to load user activity:", error);
      this.dom.userActivityTimeline.innerHTML = '<div class="modal-placeholder">Error loading activity.</div>';
    }
  }

  // Performance Metrics
  async updatePerformanceMetrics() {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai.onrender.com";

      const range = this.dom.performanceRange?.value || "day";
      const response = await fetch(`${apiBaseUrl}/api/admin/performance?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (this.dom.performanceMetrics.apiResponse) {
          this.dom.performanceMetrics.apiResponse.textContent = `${(data.avgResponseTime || 0).toFixed(0)}ms`;
        }
        if (this.dom.performanceMetrics.errorRate) {
          this.dom.performanceMetrics.errorRate.textContent = `${(data.errorRate || 0).toFixed(2)}%`;
        }
        if (this.dom.performanceMetrics.connections) {
          this.dom.performanceMetrics.connections.textContent = data.activeConnections || 0;
        }
        if (this.dom.performanceMetrics.uptime) {
          this.dom.performanceMetrics.uptime.textContent = `${(data.uptime || 100).toFixed(2)}%`;
        }
      }
    } catch (error) {
      console.error("Failed to update performance metrics:", error);
    }
  }

  // Export PDF
  async exportUsersPdf() {
    // For now, just show a message - PDF generation would require a library like jsPDF
    alert("PDF export feature coming soon. Please use CSV export for now.");
  }

  // Contact Submissions
  async loadContactSubmissions() {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const apiBaseUrl = typeof window.getApiBaseUrl === "function"
        ? window.getApiBaseUrl()
        : "https://specifys-ai.onrender.com";

      const status = this.dom.contactStatusFilter?.value || "all";
      const url = `${apiBaseUrl}/api/admin/contact-submissions?status=${status}&limit=100`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error(`Failed to load contact submissions: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        this.store.contactSubmissions = data.submissions.map(sub => ({
          ...sub,
          createdAt: utils.toDate(sub.createdAt) || utils.toDate(sub.timestamp) || new Date()
        }));
        this.renderContactTable();
      }
    } catch (error) {
      console.error("Failed to load contact submissions:", error);
      if (this.dom.contactTable) {
        this.dom.contactTable.innerHTML = `<tr><td colspan="6" class="table-empty">Error loading contact submissions.</td></tr>`;
      }
    }
  }

  renderContactTable() {
    if (!this.dom.contactTable) return;
    
    const searchTerm = this.dom.contactSearch?.value.trim().toLowerCase() || "";
    const submissions = this.store.contactSubmissions || [];
    
    let filtered = submissions;
    if (searchTerm) {
      filtered = submissions.filter(sub => 
        sub.email?.toLowerCase().includes(searchTerm) ||
        sub.message?.toLowerCase().includes(searchTerm) ||
        sub.userName?.toLowerCase().includes(searchTerm)
      );
    }

    if (!filtered.length) {
      this.dom.contactTable.innerHTML = `<tr><td colspan="6" class="table-empty">No contact submissions found.</td></tr>`;
      return;
    }

    const rows = filtered.map(sub => {
      const date = utils.formatDate(sub.createdAt);
      const messagePreview = sub.message?.length > 100 
        ? sub.message.substring(0, 100) + "..." 
        : sub.message || "";
      const statusClass = `status-${sub.status || 'new'}`;
      const statusLabel = (sub.status || 'new').charAt(0).toUpperCase() + (sub.status || 'new').slice(1);
      
      return `
        <tr>
          <td>${date}</td>
          <td>${sub.email || "—"}</td>
          <td>${sub.userName || sub.userId || "—"}</td>
          <td>
            <div class="message-preview" title="${sub.message || ''}">
              ${messagePreview}
            </div>
          </td>
          <td>
            <select class="status-select ${statusClass}" data-id="${sub.id}" data-current="${sub.status || 'new'}">
              <option value="new" ${sub.status === 'new' ? 'selected' : ''}>New</option>
              <option value="read" ${sub.status === 'read' ? 'selected' : ''}>Read</option>
              <option value="replied" ${sub.status === 'replied' ? 'selected' : ''}>Replied</option>
              <option value="archived" ${sub.status === 'archived' ? 'selected' : ''}>Archived</option>
            </select>
          </td>
          <td>
            <button class="action-btn small" onclick="window.adminDashboard.viewContactMessage('${sub.id}')" title="View full message">
              <i class="fas fa-eye"></i>
            </button>
          </td>
        </tr>
      `;
    }).join("");

    this.dom.contactTable.innerHTML = rows;

    // Add event listeners for status changes
    this.dom.contactTable.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const newStatus = e.target.value;
        const oldStatus = e.target.dataset.current;
        
        if (newStatus === oldStatus) return;
        
        try {
          await this.updateContactStatus(id, newStatus);
          e.target.dataset.current = newStatus;
          e.target.className = `status-select status-${newStatus}`;
        } catch (error) {
          console.error("Failed to update status:", error);
          e.target.value = oldStatus;
          alert("Failed to update status. Please try again.");
        }
      });
    });
  }

  async updateContactStatus(id, status) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Not authenticated");

    const apiBaseUrl = typeof window.getApiBaseUrl === "function"
      ? window.getApiBaseUrl()
      : "https://specifys-ai.onrender.com";

    const response = await fetch(`${apiBaseUrl}/api/admin/contact-submissions/${id}/status`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update status");
    }

    // Update local store
    const submission = this.store.contactSubmissions.find(s => s.id === id);
    if (submission) {
      submission.status = status;
    }
  }

  viewContactMessage(id) {
    const submission = this.store.contactSubmissions.find(s => s.id === id);
    if (!submission) return;
    
    alert(`Contact Message\n\nFrom: ${submission.email || "Unknown"}\nUser: ${submission.userName || submission.userId || "Guest"}\nDate: ${utils.formatDate(submission.createdAt)}\n\nMessage:\n${submission.message || "No message"}`);
  }

  async exportContactsCsv() {
    const submissions = this.store.contactSubmissions || [];
    if (!submissions.length) {
      alert("No contact submissions to export.");
      return;
    }

    const headers = ["Date", "Email", "User", "Message", "Status"];
    const rows = submissions.map(sub => [
      utils.formatDate(sub.createdAt),
      sub.email || "",
      sub.userName || sub.userId || "",
      `"${(sub.message || "").replace(/"/g, '""')}"`,
      sub.status || "new"
    ]);

    const csv = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contact-submissions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  renderSpecUsageAnalytics() {
    const container = this.dom.specUsageTable;
    if (!container) return;

    const range = this.dom.specUsageRange?.value || "all";
    const searchTerm = (this.dom.specUsageSearch?.value || "").toLowerCase().trim();
    const allSpecs = Array.from(this.store.specs.values());
    
    // Filter by date range
    let filteredSpecs = allSpecs;
    if (range !== "all") {
      const threshold = Date.now() - DATE_RANGES[range];
      filteredSpecs = allSpecs.filter(
        (spec) => (spec.createdAt?.getTime() || 0) >= threshold
      );
    }

    // Filter by search term
    if (searchTerm) {
      filteredSpecs = filteredSpecs.filter((spec) => {
        const user = this.store.getUser(spec.userId);
        const specTitle = (spec.title || "").toLowerCase();
        const userEmail = (user?.email || "").toLowerCase();
        const userName = (user?.displayName || "").toLowerCase();
        return specTitle.includes(searchTerm) || 
               userEmail.includes(searchTerm) || 
               userName.includes(searchTerm);
      });
    }

    // Sort chronologically (newest first)
    filteredSpecs.sort(
      (a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );

    if (filteredSpecs.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="12" class="table-empty">No specs found for selected criteria.</td>
        </tr>
      `;
      this.updateSpecUsageSummary({
        overviewOnly: 0,
        overviewTechnical: 0,
        overviewTechnicalMarket: 0,
        withDiagrams: 0,
        withDesign: 0,
        withPrompts: 0,
        withMockups: 0,
        withAiChat: 0,
        total: 0
      });
      return;
    }

    // Calculate statistics
    const stats = this.calculateSpecUsageStats(filteredSpecs);
    this.updateSpecUsageSummary(stats);

    // Render table rows
    const rows = filteredSpecs.map((spec) => {
      const user = this.store.getUser(spec.userId);
      const entitlement = this.store.getEntitlement(spec.userId);
      const specData = spec.metadata || {};
      const status = specData.status || {};
      
      // Check which features are available
      const hasOverview = !!(specData.overview && status.overview === "ready");
      const hasTechnical = !!(specData.technical && status.technical === "ready");
      const hasMarket = !!(specData.market && status.market === "ready");
      const hasDesign = !!(specData.design && status.design === "ready");
      const hasDiagrams = !!(specData.diagrams?.generated === true);
      const hasPrompts = !!(specData.prompts && (
        Array.isArray(specData.prompts) ? specData.prompts.length > 0 :
        typeof specData.prompts === 'object' ? Object.keys(specData.prompts).length > 0 :
        false
      ));
      const hasMockups = !!(specData.mockups && (
        Array.isArray(specData.mockups) ? specData.mockups.length > 0 :
        typeof specData.mockups === 'object' ? Object.keys(specData.mockups || {}).length > 0 :
        false
      ));
      const hasAiChat = !!(specData.openaiAssistantId || specData.chatThreadId || specData.openaiFileId);
      const hasExport = false; // Export is not tracked, but we can check if user has exported based on other indicators
      
      // Check user type
      const isPro = !!(entitlement?.unlimited || user?.plan === 'pro');
      const hasCredits = !!(entitlement?.specCredits && entitlement.specCredits > 0);
      
      // Build user info with badges
      let userInfo = user?.email || user?.displayName || spec.userId || "Unknown";
      const badges = [];
      if (isPro) badges.push('<span class="user-badge pro-badge" title="Pro User">Pro</span>');
      if (hasCredits) badges.push('<span class="user-badge credits-badge" title="Has Purchased Credits">Credits</span>');
      
      return `
        <tr class="spec-usage-row">
          <td>
            <strong>${spec.title || "Untitled Spec"}</strong>
          </td>
          <td>
            <div class="user-info-cell">
              <span class="user-info">${userInfo}</span>
              ${badges.length > 0 ? `<div class="user-badges">${badges.join('')}</div>` : ''}
            </div>
          </td>
          <td>
            <span class="date-info">${utils.formatDate(spec.createdAt)}</span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasOverview ? "active" : ""}" title="Overview">
              <i class="fas fa-${hasOverview ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasTechnical ? "active" : ""}" title="Technical">
              <i class="fas fa-${hasTechnical ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasMarket ? "active" : ""}" title="Market">
              <i class="fas fa-${hasMarket ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasDesign ? "active" : ""}" title="Design">
              <i class="fas fa-${hasDesign ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasDiagrams ? "active" : ""}" title="Diagrams">
              <i class="fas fa-${hasDiagrams ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasPrompts ? "active" : ""}" title="Prompts">
              <i class="fas fa-${hasPrompts ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasMockups ? "active" : ""}" title="Mockups">
              <i class="fas fa-${hasMockups ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasAiChat ? "active" : ""}" title="AI Chat">
              <i class="fas fa-${hasAiChat ? "check-circle" : "circle"}"></i>
            </span>
          </td>
          <td class="feature-cell">
            <span class="feature-indicator ${hasExport ? "active" : ""}" title="Export">
              <i class="fas fa-${hasExport ? "check-circle" : "circle"}"></i>
            </span>
          </td>
        </tr>
      `;
    }).join("");

    container.innerHTML = rows;
  }

  calculateSpecUsageStats(specs) {
    const stats = {
      overviewOnly: 0,
      overviewTechnical: 0,
      overviewTechnicalMarket: 0,
      withDiagrams: 0,
      withDesign: 0,
      withPrompts: 0,
      withMockups: 0,
      withAiChat: 0,
      total: specs.length
    };

    specs.forEach((spec) => {
      const specData = spec.metadata || {};
      const status = specData.status || {};
      
      const hasOverview = !!(specData.overview && status.overview === "ready");
      const hasTechnical = !!(specData.technical && status.technical === "ready");
      const hasMarket = !!(specData.market && status.market === "ready");
      const hasDesign = !!(specData.design && status.design === "ready");
      const hasDiagrams = !!(specData.diagrams?.generated === true);
      const hasPrompts = !!(specData.prompts && (
        Array.isArray(specData.prompts) ? specData.prompts.length > 0 :
        typeof specData.prompts === 'object' ? Object.keys(specData.prompts).length > 0 :
        false
      ));
      const hasMockups = !!(specData.mockups && (
        Array.isArray(specData.mockups) ? specData.mockups.length > 0 :
        typeof specData.mockups === 'object' ? Object.keys(specData.mockups || {}).length > 0 :
        false
      ));
      const hasAiChat = !!(specData.openaiAssistantId || specData.chatThreadId || specData.openaiFileId);

      if (hasOverview && !hasTechnical && !hasMarket) {
        stats.overviewOnly++;
      }
      if (hasOverview && hasTechnical && !hasMarket) {
        stats.overviewTechnical++;
      }
      if (hasOverview && hasTechnical && hasMarket) {
        stats.overviewTechnicalMarket++;
      }
      if (hasDiagrams) {
        stats.withDiagrams++;
      }
      if (hasDesign) {
        stats.withDesign++;
      }
      if (hasPrompts) {
        stats.withPrompts++;
      }
      if (hasMockups) {
        stats.withMockups++;
      }
      if (hasAiChat) {
        stats.withAiChat++;
      }
    });

    return stats;
  }

  updateSpecUsageSummary(stats) {
    if (!this.dom.specUsageSummary) return;
    
    const overviewOnly = this.dom.specUsageSummary.querySelector('[data-metric="overview-only"]');
    const overviewTechnical = this.dom.specUsageSummary.querySelector('[data-metric="overview-technical"]');
    const overviewTechnicalMarket = this.dom.specUsageSummary.querySelector('[data-metric="overview-technical-market"]');
    const withDiagrams = this.dom.specUsageSummary.querySelector('[data-metric="with-diagrams"]');
    const withDesign = this.dom.specUsageSummary.querySelector('[data-metric="with-design"]');
    const withPrompts = this.dom.specUsageSummary.querySelector('[data-metric="with-prompts"]');
    const withMockups = this.dom.specUsageSummary.querySelector('[data-metric="with-mockups"]');
    const withAiChat = this.dom.specUsageSummary.querySelector('[data-metric="with-aichat"]');

    if (overviewOnly) overviewOnly.textContent = utils.formatNumber(stats.overviewOnly || 0);
    if (overviewTechnical) overviewTechnical.textContent = utils.formatNumber(stats.overviewTechnical || 0);
    if (overviewTechnicalMarket) overviewTechnicalMarket.textContent = utils.formatNumber(stats.overviewTechnicalMarket || 0);
    if (withDiagrams) withDiagrams.textContent = utils.formatNumber(stats.withDiagrams || 0);
    if (withDesign) withDesign.textContent = utils.formatNumber(stats.withDesign || 0);
    if (withPrompts) withPrompts.textContent = utils.formatNumber(stats.withPrompts || 0);
    if (withMockups) withMockups.textContent = utils.formatNumber(stats.withMockups || 0);
    if (withAiChat) withAiChat.textContent = utils.formatNumber(stats.withAiChat || 0);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadExternalScript("https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js");
    ChartLib = window.Chart || null;
  } catch (error) {
    console.warn("Chart.js failed to load. Statistics charts will be disabled.", error);
  }
  window.adminDashboard = new AdminDashboardApp();
});

