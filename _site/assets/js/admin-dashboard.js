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
        user.email.toLowerCase().includes(term) ||
        (user.displayName && user.displayName.toLowerCase().includes(term))
      ) {
        userResults.push({
          id: user.id,
          title: user.displayName || user.email,
          subtitle: `${user.email} • Plan: ${user.plan}`,
          action: () => {
            const navButton = document.querySelector(
              '[data-target="users-section"]'
            );
            navButton?.dispatchEvent(new Event("click", { bubbles: true }));
            const searchInput = document.getElementById("users-search");
            if (searchInput) {
              searchInput.focus();
              searchInput.value = user.email;
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
      resultsHTML || `<div class="results-placeholder">No results found for “${term}”.</div>`;

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
    this.charts = {
      usersPlan: null,
      specsTimeline: null,
      revenueTrend: null
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
      sourceList: utils.dom("#source-status-list"),
      autoRefreshNext: utils.dom("#auto-refresh-next"),
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
      paymentsSearch: utils.dom("#payments-search"),
      paymentsRange: utils.dom("#payments-range"),
      paymentsTable: utils.dom("#payments-table tbody"),
      logsStream: utils.dom("#logs-stream"),
      logsFilter: utils.dom("#logs-filter"),
      blogForm: utils.dom("#blog-form"),
      blogFields: {
        title: utils.dom("#blog-title"),
        slug: utils.dom("#blog-slug"),
        description: utils.dom("#blog-description"),
        content: utils.dom("#blog-content"),
        tags: utils.dom("#blog-tags"),
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
        proUsers: utils.dom('[data-metric="users-pro"]'),
        proShare: utils.dom('[data-kpi="users-pro-share"]'),
        specsTotal: utils.dom('[data-metric="specs-total"]'),
        specsRange: utils.dom('[data-kpi="specs-range"]'),
        revenueTotal: utils.dom('[data-metric="revenue-total"]'),
        revenueRange: utils.dom('[data-kpi="revenue-range"]')
      }
    };

    this.sourceState = {
      users: "pending",
      entitlements: "pending",
      specs: "pending",
      purchases: "pending",
      activityLogs: "pending",
      blogQueue: "pending"
    };
    this.sourceMessages = {};

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
          } else {
            section.classList.remove("active");
          }
        });
      });
    });
  }

  bindInteractions() {
    this.dom.manualRefresh?.addEventListener("click", () => this.refreshAllData("manual"));
    this.dom.signOut?.addEventListener("click", async () => {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("Error signing out", error);
      }
    });
    this.dom.overviewRange?.addEventListener("change", () => this.updateOverview());
    this.dom.toggleActivity?.addEventListener("click", () => this.toggleActivityStream());
    this.dom.usersSearch?.addEventListener("input", utils.debounce(() => this.renderUsersTable(), 120));
    this.dom.usersPlanFilter?.addEventListener("change", () => this.renderUsersTable());
    this.dom.exportUsers?.addEventListener("click", () => this.exportUsersCsv());
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
      this.dom.blogFields.slug.dataset.manual = "true";
    });
    this.dom.blogForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handleBlogSubmit();
    });
    this.dom.blogPreview?.addEventListener("click", () => this.showBlogPreview());
    this.dom.refreshQueue?.addEventListener("click", () => this.refreshBlogQueue());
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
    this.updateAutoRefreshTimer();
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
  }

  async subscribeToSources() {
    this.unsubscribeAll();
    this.store.reset();
    this.updateAllSources("pending");

    // Users
    try {
      const unsubUsers = onSnapshot(
        collection(db, COLLECTIONS.USERS),
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "removed") {
              this.store.removeUser(change.doc.id);
            } else {
              this.store.upsertUser(change.doc.id, change.doc.data());
            }
          });
          this.markSourceReady("users");
          this.renderUsersTable();
          this.updateOverview();
          this.rebuildSearchIndex();
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
                this.store.recordActivity({
                  type: "spec",
                  title: `Spec created · ${spec.title}`,
                  description: this.store.getUser(spec.userId)?.email || spec.userId || "",
                  timestamp: spec.createdAt,
                  meta: { userId: spec.userId, specId: spec.id }
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
                this.store.recordActivity({
                  type: purchase.productType === "subscription" ? "subscription" : "payment",
                  title: `${purchase.productName}`,
                  description: `${utils.formatCurrency(purchase.total, purchase.currency)} • ${purchase.email || purchase.userId || "Unknown user"}`,
                  timestamp: purchase.createdAt,
                  meta: { userId: purchase.userId, purchaseId: purchase.id }
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

    // Blog queue (optional)
    try {
      const queueQuery = query(
        collection(db, COLLECTIONS.BLOG_QUEUE),
        orderBy("createdAt", "desc"),
        limit(50)
      );
      const unsubQueue = onSnapshot(
        queueQuery,
        (snapshot) => {
          this.store.setBlogQueue(
            snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data()
            }))
          );
          this.markSourceReady("blogQueue");
          this.renderBlogQueue();
        },
        (error) => {
          if (error?.code === "permission-denied") {
            console.info("Blog queue access restricted for current user.");
            this.markSourceRestricted("blogQueue", "Requires blog queue privileges.");
          } else {
            console.warn("Blog queue listener error", error);
            this.markSourceError("blogQueue", error);
          }
        }
      );
      this.unsubscribeFns.push(unsubQueue);
        } catch (error) {
      if (error?.code === "permission-denied") {
        console.info("Blog queue not available for current user.");
        this.markSourceRestricted("blogQueue", "Requires blog queue privileges.");
      } else {
        console.warn("Blog queue not available", error);
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
    const rows = [];

    for (const user of this.store.getUsersSorted()) {
        if (searchTerm) {
        const haystack = `${user.email} ${user.displayName}`.toLowerCase();
        if (!haystack.includes(searchTerm)) continue;
      }
      if (planFilter !== "all" && user.plan !== planFilter) continue;
      const entitlement = this.store.getEntitlement(user.id);
      const specCount = this.store.getSpecCount(user.id);
      const planBadge = `<span class="badge ${user.plan}">${user.plan}</span>`;
      const credits =
        entitlement?.unlimited
          ? "Unlimited"
          : entitlement?.specCredits != null
          ? entitlement.specCredits
          : "—";
      rows.push(`
        <tr data-user-id="${user.id}">
          <td>
            <div>${user.displayName || user.email}</div>
            <div class="meta-text">${user.email}</div>
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
              <button class="table-action-btn" data-action="copy-email" data-email="${user.email}">
                <i class="fas fa-copy"></i> Copy email
              </button>
            </div>
          </td>
        </tr>
      `);
    }

    if (!rows.length) {
      this.dom.usersTable.innerHTML = `<tr><td colspan="7" class="table-empty">No users match the filter.</td></tr>`;
    } else {
      this.dom.usersTable.innerHTML = rows.join("");
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

    const totalUsers = users.length;
    const proUsers = users.filter((user) => user.plan === "pro").length;
    const newUsers = users.filter((user) => (user.createdAt?.getTime() || 0) >= threshold).length;
    const proShare = totalUsers ? Math.round((proUsers / totalUsers) * 100) : 0;

    const specsTotal = Array.from(this.store.specs.values()).length;
    const specsInRange = Array.from(this.store.specs.values()).filter(
      (spec) => (spec.createdAt?.getTime() || 0) >= threshold
    ).length;

    const revenueTotal = this.store.purchases.reduce(
      (sum, purchase) => sum + (purchase.total || 0),
      0
    );
    const revenueRange = this.store.getPurchases(overviewRange).reduce(
      (sum, purchase) => sum + (purchase.total || 0),
      0
    );

    if (this.dom.metrics.totalUsers) {
      this.dom.metrics.totalUsers.textContent = utils.formatNumber(totalUsers);
    }
    if (this.dom.metrics.newUsers) {
      this.dom.metrics.newUsers.textContent = `New: ${utils.formatNumber(newUsers)}`;
    }
    if (this.dom.metrics.proUsers) {
      this.dom.metrics.proUsers.textContent = utils.formatNumber(proUsers);
    }
    if (this.dom.metrics.proShare) {
      this.dom.metrics.proShare.textContent = `${proShare || 0}%`;
    }
    if (this.dom.metrics.specsTotal) {
      this.dom.metrics.specsTotal.textContent = utils.formatNumber(specsTotal);
    }
    if (this.dom.metrics.specsRange) {
      this.dom.metrics.specsRange.textContent = `Range: ${utils.formatNumber(specsInRange)}`;
    }
    if (this.dom.metrics.revenueTotal) {
      this.dom.metrics.revenueTotal.textContent = utils.formatCurrency(revenueTotal);
    }
    if (this.dom.metrics.revenueRange) {
      this.dom.metrics.revenueRange.textContent = `Range: ${utils.formatCurrency(revenueRange)}`;
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
    const html = events.slice(0, 20).map((event) => {
      const userLabel = event.meta?.email || event.meta?.userEmail || this.store.getUser(event.meta?.userId)?.email;
      const nameLabel = event.meta?.userName || this.store.getUser(event.meta?.userId)?.displayName;
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
      return [
        user.id,
        user.email,
        user.displayName,
        user.plan,
        utils.formatDate(user.createdAt),
        utils.formatDate(user.lastActive),
        this.store.getSpecCount(user.id),
        entitlement?.specCredits ?? "",
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
    if (!this.dom.blogForm) return;
    const payload = {
      title: this.dom.blogFields.title?.value.trim() ?? "",
      slug: utils.sanitizeSlug(this.dom.blogFields.slug?.value.trim() ?? ""),
      description: this.dom.blogFields.description?.value.trim() ?? "",
      content: this.dom.blogFields.content?.value.trim() ?? "",
      tags: this.dom.blogFields.tags?.value.trim() ?? ""
    };

    if (!payload.title || !payload.description || !payload.content) {
      this.setBlogFeedback("Please fill in the required fields.", "error");
      return;
    }

    const button = this.dom.blogForm.querySelector("button.primary");
    const originalText = button?.innerHTML;
    if (button) {
      button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing…';
      button.disabled = true;
    }
    try {
      const token = await this.getAuthToken();
      const response = await fetch("/api/blog/create-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to queue blog post");
      }
      this.setBlogFeedback("Post added to queue successfully.", "success");
      this.dom.blogForm.reset();
      if (this.dom.blogFields.descriptionCount) {
        this.dom.blogFields.descriptionCount.textContent = "0 / 160";
      }
      await this.refreshBlogQueue();
        } catch (error) {
      console.error("Blog publish failed", error);
      this.setBlogFeedback(error.message || "Failed to publish blog post.", "error");
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

  async refreshBlogQueue() {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.BLOG_QUEUE),
          orderBy("createdAt", "desc"),
          limit(50)
        )
      );
      this.store.setBlogQueue(
        snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }))
      );
      this.renderBlogQueue();
        } catch (error) {
      console.error("Failed to refresh blog queue", error);
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
        return `
          <li class="queue-item ${statusClass}">
            <div class="queue-title">${item.title}</div>
            <div class="queue-meta">
              <span>${meta}</span>
              <span class="queue-status">${item.status}</span>
            </div>
            ${
              item.error
                ? `<div class="queue-error">Error: ${item.error}</div>`
                : ""
            }
            ${
              item.result?.url
                ? `<a href="${item.result.url}" target="_blank" rel="noopener">View post</a>`
                : ""
            }
          </li>
        `;
      })
      .join("");
    this.dom.blogQueueList.innerHTML = html;
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
      case "auth":
        return "fas fa-user-check";
      default:
        return "fas fa-info-circle";
    }
  }

  showActivityDetail(event) {
    const panel = this.dom.activityDetail;
    if (!panel.root) return;
    const user = this.store.getUser(event.meta?.userId);
    const name = event.meta?.userName || user?.displayName || "Unknown user";
    const email = event.meta?.email || event.meta?.userEmail || user?.email || "Not provided";
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
    await this.subscribeToSources();
    this.updateAutoRefreshTimer();
  }

  updateAutoRefreshTimer() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
    }
    const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
    this.nextAutoRefreshAt = next;
    if (this.dom.autoRefreshNext) {
      this.dom.autoRefreshNext.textContent = `Scheduled at ${utils.formatDate(next)}`;
    }
    this.autoRefreshTimer = setInterval(() => {
      this.refreshAllData("auto");
    }, 24 * 60 * 60 * 1000);
  }

  async getAuthToken() {
    try {
      const user = auth.currentUser;
      if (!user) return null;
      return await user.getIdToken();
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

