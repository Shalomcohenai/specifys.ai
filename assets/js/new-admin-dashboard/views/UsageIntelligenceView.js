/**
 * Usage Intelligence View
 *
 * Admin tools to:
 *  1. Download a raw ZIP/JSONL dump of platform usage data for a date range
 *  2. Manage product_releases markers (significant site/product changes)
 */

import { helpers } from '../utils/helpers.js';
import { apiService } from '../services/ApiService.js';
import { firebaseService } from '../core/FirebaseService.js';

function escapeHtml(value) {
  if (value == null) return '';
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function defaultFromDate(daysAgo = 7) {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

function defaultToDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Flatten API / Error values into a readable string. */
function formatExportError(err) {
  if (err == null) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err instanceof TypeError && /failed to fetch/i.test(err.message || '')) {
    return 'Network error (Failed to fetch). The server may have rejected the date range, timed out, or blocked the response. Try "Last 7 days" first, then longer ranges.';
  }
  if (err instanceof Error && err.message && err.message !== '[object Object]') {
    return err.message;
  }
  if (typeof err === 'object') {
    if (typeof err.message === 'string') return err.message;
    if (err.error) {
      if (typeof err.error === 'string') return err.error;
      if (typeof err.error.message === 'string') {
        const details = err.error.details ? ` (${typeof err.error.details === 'string' ? err.error.details : JSON.stringify(err.error.details)})` : '';
        return `${err.error.message}${details}`;
      }
    }
    try {
      return JSON.stringify(err);
    } catch (_) {
      return String(err);
    }
  }
  return String(err);
}

export class UsageIntelligenceView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this._initialized = false;
    this._releases = [];
    this._rangeMode = '7'; // '7' | '30' | 'all' | 'custom'
  }

  initOnce() {
    if (this._initialized) return;
    this._initialized = true;
    this.renderShell();
    this.bindEvents();
    this.applyRangePreset('7');
  }

  show() {
    this.initOnce();
    this.loadReleases();
  }

  renderShell() {
    const section = helpers.dom('#usage-intelligence-section');
    if (!section || section.dataset.rendered === '1') return;

    section.innerHTML = `
      <div class="section-header-modern">
        <div>
          <h1>Usage Intelligence</h1>
          <p>Raw data export for external analysis — history + release markers</p>
        </div>
      </div>

      <div class="ui-panel" style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.1rem; margin-bottom: 0.5rem;">Raw usage dump</h2>
        <p class="form-help-text" style="margin-bottom: 1rem;">
          Downloads a ZIP of JSONL files (page views, events, users, credits, specs summary,
          MCP, email, releases, and more). No aggregations — suitable for an external analysis system.
        </p>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label>Quick range</label>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;" role="group" aria-label="Export date range presets">
            <button type="button" class="btn-modern btn-secondary ui-range-preset" data-range="7">Last 7 days</button>
            <button type="button" class="btn-modern btn-secondary ui-range-preset" data-range="30">Last 30 days</button>
            <button type="button" class="btn-modern btn-secondary ui-range-preset" data-range="all">All dates</button>
          </div>
        </div>

        <div class="form-row" style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: flex-end;">
          <div class="form-group" style="margin: 0;">
            <label for="ui-export-from">From</label>
            <input type="date" id="ui-export-from" value="${defaultFromDate(7)}">
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="ui-export-to">To</label>
            <input type="date" id="ui-export-to" value="${defaultToDate()}">
          </div>
          <div class="form-group" style="margin: 0;">
            <label class="checkbox-label">
              <input type="checkbox" id="ui-export-redact-pii" checked>
              Redact PII (emails / names)
            </label>
          </div>
          <button type="button" class="btn-modern btn-primary" id="ui-export-btn">
            <i class="fas fa-download"></i> Download raw dump
          </button>
        </div>
        <p class="form-help-text" id="ui-export-status" style="margin-top: 0.75rem;" aria-live="polite"></p>
      </div>

      <div class="ui-panel">
        <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
          <div>
            <h2 style="font-size: 1.1rem; margin: 0 0 0.25rem;">Product releases</h2>
            <p class="form-help-text" style="margin: 0;">
              Significant site/product changes that can affect usage metrics over time.
            </p>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn-modern btn-secondary" id="ui-seed-releases-btn">
              <i class="fas fa-database"></i> Seed known history
            </button>
            <button type="button" class="btn-modern" id="ui-refresh-releases-btn">
              <i class="fas fa-sync-alt"></i> Refresh
            </button>
          </div>
        </div>

        <form id="ui-release-form" class="ui-release-form" style="display: grid; gap: 0.75rem; margin-bottom: 1.5rem; padding: 1rem; border: 1px solid var(--border-color, #e9ecef); border-radius: 8px;">
          <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
            <div class="form-group" style="flex: 1; min-width: 140px; margin: 0;">
              <label for="ui-release-id">ID (optional)</label>
              <input type="text" id="ui-release-id" placeholder="e.g. pricing-redesign-2026">
            </div>
            <div class="form-group" style="flex: 1; min-width: 140px; margin: 0;">
              <label for="ui-release-version">Version</label>
              <input type="text" id="ui-release-version" placeholder="e.g. 2.4.0">
            </div>
            <div class="form-group" style="flex: 1; min-width: 140px; margin: 0;">
              <label for="ui-release-shipped">Shipped at</label>
              <input type="date" id="ui-release-shipped" value="${defaultToDate()}">
            </div>
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="ui-release-label">Label *</label>
            <input type="text" id="ui-release-label" required placeholder="Short name of the change">
          </div>
          <div class="form-group" style="margin: 0;">
            <label for="ui-release-summary">Summary</label>
            <textarea id="ui-release-summary" rows="2" placeholder="What changed and why it may affect metrics"></textarea>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;">
            <div class="form-group" style="flex: 1; min-width: 200px; margin: 0;">
              <label for="ui-release-areas">Impact areas (comma-separated)</label>
              <input type="text" id="ui-release-areas" placeholder="pricing, onboarding, mcp, editor">
            </div>
            <label class="checkbox-label">
              <input type="checkbox" id="ui-release-significant" checked>
              Significant
            </label>
            <button type="submit" class="btn-modern btn-primary">
              <i class="fas fa-plus"></i> Add release
            </button>
          </div>
          <p class="form-help-text" id="ui-release-form-status" aria-live="polite"></p>
        </form>

        <div id="ui-releases-table-wrap">
          <p class="form-help-text">Loading releases…</p>
        </div>
      </div>
    `;
    section.dataset.rendered = '1';
  }

  bindEvents() {
    const exportBtn = helpers.dom('#ui-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.downloadExport());
    }

    helpers.domAll('.ui-range-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const range = btn.getAttribute('data-range');
        if (range) this.applyRangePreset(range);
      });
    });

    const fromInput = helpers.dom('#ui-export-from');
    const toInput = helpers.dom('#ui-export-to');
    if (fromInput) {
      fromInput.addEventListener('change', () => {
        this._rangeMode = 'custom';
        this.syncPresetButtons();
      });
    }
    if (toInput) {
      toInput.addEventListener('change', () => {
        this._rangeMode = 'custom';
        this.syncPresetButtons();
      });
    }

    const refreshBtn = helpers.dom('#ui-refresh-releases-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadReleases());
    }

    const seedBtn = helpers.dom('#ui-seed-releases-btn');
    if (seedBtn) {
      seedBtn.addEventListener('click', () => this.seedReleases());
    }

    const form = helpers.dom('#ui-release-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.createRelease();
      });
    }

    const wrap = helpers.dom('#ui-releases-table-wrap');
    if (wrap) {
      wrap.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-delete-release]');
        if (!btn) return;
        const id = btn.getAttribute('data-delete-release');
        if (id) this.deleteRelease(id);
      });
    }
  }

  applyRangePreset(range) {
    this._rangeMode = range;
    const fromInput = helpers.dom('#ui-export-from');
    const toInput = helpers.dom('#ui-export-to');
    if (!fromInput || !toInput) return;

    toInput.value = defaultToDate();
    if (range === '7') {
      fromInput.value = defaultFromDate(7);
    } else if (range === '30') {
      fromInput.value = defaultFromDate(30);
    } else if (range === 'all') {
      fromInput.value = '2024-01-01';
    }
    this.syncPresetButtons();
  }

  syncPresetButtons() {
    helpers.domAll('.ui-range-preset').forEach((btn) => {
      const isActive = btn.getAttribute('data-range') === this._rangeMode;
      btn.classList.toggle('btn-primary', isActive);
      btn.classList.toggle('btn-secondary', !isActive);
    });
  }

  async getAuthToken() {
    const user = firebaseService.getCurrentUser();
    if (!user) throw new Error('Not signed in');
    return user.getIdToken();
  }

  async downloadExport() {
    const btn = helpers.dom('#ui-export-btn');
    const status = helpers.dom('#ui-export-status');
    const fromInput = helpers.dom('#ui-export-from');
    const toInput = helpers.dom('#ui-export-to');
    const redactInput = helpers.dom('#ui-export-redact-pii');

    const fromDate = fromInput?.value;
    const toDate = toInput?.value;
    const allMode = this._rangeMode === 'all';

    if (!allMode && !fromDate) {
      if (status) status.textContent = 'Please choose a From date.';
      return;
    }

    const fromIso = allMode
      ? '2024-01-01T00:00:00.000Z'
      : new Date(`${fromDate}T00:00:00.000Z`).toISOString();
    const toIso = toDate
      ? new Date(`${toDate}T23:59:59.999Z`).toISOString()
      : new Date().toISOString();

    const rangeDays = Math.ceil(
      (new Date(toIso).getTime() - new Date(fromIso).getTime()) / (24 * 60 * 60 * 1000)
    );

    const body = {
      from: fromIso,
      to: toIso,
      redactPii: !!(redactInput?.checked),
      all: allMode || rangeDays > 365
    };

    const original = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Starting…';
    }
    if (status) {
      status.textContent = 'Starting export job…';
    }

    try {
      const token = await this.getAuthToken();
      const apiBaseUrl = (window.getApiBaseUrl
        ? window.getApiBaseUrl()
        : (window.API_BASE_URL || window.BACKEND_URL || '')).replace(/\/$/, '');

      // 1) Start async job (returns immediately — avoids Cloudflare TTFB timeout)
      const startRes = await fetch(`${apiBaseUrl}/api/admin/usage-intelligence/export/jobs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-No-Compression': '1'
        },
        body: JSON.stringify(body)
      });

      if (!startRes.ok) {
        const payload = await startRes.json().catch(() => ({ message: startRes.statusText }));
        throw new Error(formatExportError(payload) || `HTTP ${startRes.status}`);
      }

      const startJson = await startRes.json();
      const jobId = startJson.job?.id;
      if (!jobId) throw new Error('Server did not return a job id');

      if (status) status.textContent = `Job ${jobId.slice(0, 8)}… building dump on server`;
      if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Building…';

      // 2) Poll until ready / error
      const readyJob = await this.pollExportJob(apiBaseUrl, token, jobId, status);
      if (readyJob.status === 'error') {
        throw new Error(readyJob.error || 'Export job failed on server');
      }

      if (status) status.textContent = 'Downloading ZIP…';
      if (btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Downloading…';

      // 3) Download finished file (fast — file already on disk)
      const dlRes = await fetch(
        `${apiBaseUrl}/api/admin/usage-intelligence/export/jobs/${encodeURIComponent(jobId)}/download`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'X-No-Compression': '1'
          }
        }
      );

      const contentType = (dlRes.headers.get('Content-Type') || '').toLowerCase();
      if (!dlRes.ok) {
        let payload = null;
        try {
          payload = contentType.includes('json')
            ? await dlRes.json()
            : { message: await dlRes.text() };
        } catch (_) {
          payload = { message: dlRes.statusText || `HTTP ${dlRes.status}` };
        }
        throw new Error(formatExportError(payload) || `HTTP ${dlRes.status}`);
      }

      if (contentType.includes('application/json') || contentType.includes('text/html')) {
        const text = await dlRes.text();
        let payload;
        try {
          payload = JSON.parse(text);
        } catch (_) {
          throw new Error(`Unexpected response (not a ZIP): ${text.slice(0, 200)}`);
        }
        throw new Error(formatExportError(payload));
      }

      let filename = readyJob.filename || `usage-dump-${fromDate || 'all'}-to-${toDate || 'now'}.zip`;
      const cd = dlRes.headers.get('Content-Disposition');
      if (cd) {
        const match = cd.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      const blob = await dlRes.blob();
      if (!blob || blob.size < 22) {
        throw new Error('Export returned an empty or invalid ZIP file');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      if (status) {
        status.textContent = `Downloaded ${filename} (${Math.round(blob.size / 1024)} KB)`;
      }
      if (btn) {
        btn.innerHTML = '<i class="fas fa-check"></i> Downloaded';
        btn.classList.add('success');
      }
    } catch (error) {
      const msg = formatExportError(error);
      console.error('[UsageIntelligenceView] export failed', error);
      if (status) status.textContent = `Export failed: ${msg}`;
      alert(`Export failed: ${msg}`);
      if (btn) btn.innerHTML = original;
    } finally {
      if (btn) {
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = original || '<i class="fas fa-download"></i> Download raw dump';
          btn.classList.remove('success');
        }, 2000);
      }
    }
  }

  /**
   * Poll export job until ready or error (max ~10 minutes).
   */
  async pollExportJob(apiBaseUrl, token, jobId, statusEl) {
    const maxAttempts = 150; // 150 * 2s = 5 minutes
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const res = await fetch(
        `${apiBaseUrl}/api/admin/usage-intelligence/export/jobs/${encodeURIComponent(jobId)}`,
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (!res.ok) {
        const payload = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(formatExportError(payload) || `HTTP ${res.status}`);
      }
      const json = await res.json();
      const job = json.job;
      if (!job) throw new Error('Invalid job status response');

      if (statusEl) {
        const kb = job.bytes ? ` · ${Math.round(job.bytes / 1024)} KB` : '';
        statusEl.textContent = `Job ${job.status}${job.progress ? ` — ${job.progress}` : ''}${kb}`;
      }

      if (job.status === 'ready' || job.status === 'error') {
        return job;
      }
    }
    throw new Error('Export job timed out while building. Try a shorter date range (Last 7 days).');
  }

  async loadReleases() {
    const wrap = helpers.dom('#ui-releases-table-wrap');
    if (wrap) wrap.innerHTML = '<p class="form-help-text">Loading releases…</p>';
    try {
      const data = await apiService.get('/api/admin/usage-intelligence/releases');
      this._releases = data.releases || [];
      this.renderReleasesTable();
    } catch (error) {
      console.error('[UsageIntelligenceView] loadReleases', error);
      if (wrap) {
        wrap.innerHTML = `<p class="form-help-text" style="color: #c0392b;">Failed to load: ${escapeHtml(formatExportError(error))}</p>`;
      }
    }
  }

  renderReleasesTable() {
    const wrap = helpers.dom('#ui-releases-table-wrap');
    if (!wrap) return;

    if (!this._releases.length) {
      wrap.innerHTML = `
        <p class="form-help-text">
          No releases yet. Click <strong>Seed known history</strong> to add documented milestones, or add one above.
        </p>`;
      return;
    }

    const rows = this._releases.map((r) => `
      <tr>
        <td>${escapeHtml(formatDate(r.shippedAt))}</td>
        <td>
          <strong>${escapeHtml(r.label)}</strong>
          ${r.significant ? '<span class="brand-badge" style="margin-left: 0.35rem;">significant</span>' : ''}
          <div class="form-help-text" style="margin: 0.2rem 0 0;">${escapeHtml(r.id)}</div>
        </td>
        <td>${escapeHtml(r.version || '—')}</td>
        <td>${escapeHtml((r.impactAreas || []).join(', ') || '—')}</td>
        <td>${escapeHtml(r.summary || '—')}</td>
        <td>
          <button type="button" class="btn-modern btn-secondary" data-delete-release="${escapeHtml(r.id)}" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    wrap.innerHTML = `
      <div class="table-responsive">
        <table class="admin-table" style="width: 100%;">
          <thead>
            <tr>
              <th>Shipped</th>
              <th>Label</th>
              <th>Version</th>
              <th>Impact</th>
              <th>Summary</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  async createRelease() {
    const status = helpers.dom('#ui-release-form-status');
    const label = helpers.dom('#ui-release-label')?.value?.trim();
    if (!label) {
      if (status) status.textContent = 'Label is required.';
      return;
    }

    const areasRaw = helpers.dom('#ui-release-areas')?.value || '';
    const shipped = helpers.dom('#ui-release-shipped')?.value;
    const body = {
      id: helpers.dom('#ui-release-id')?.value?.trim() || undefined,
      version: helpers.dom('#ui-release-version')?.value?.trim() || undefined,
      label,
      summary: helpers.dom('#ui-release-summary')?.value?.trim() || undefined,
      shippedAt: shipped ? new Date(`${shipped}T12:00:00.000Z`).toISOString() : undefined,
      impactAreas: areasRaw.split(',').map((s) => s.trim()).filter(Boolean),
      significant: !!helpers.dom('#ui-release-significant')?.checked
    };

    try {
      if (status) status.textContent = 'Saving…';
      await apiService.post('/api/admin/usage-intelligence/releases', body);
      if (status) status.textContent = 'Release saved.';
      helpers.dom('#ui-release-label').value = '';
      helpers.dom('#ui-release-summary').value = '';
      helpers.dom('#ui-release-id').value = '';
      helpers.dom('#ui-release-version').value = '';
      helpers.dom('#ui-release-areas').value = '';
      await this.loadReleases();
    } catch (error) {
      console.error('[UsageIntelligenceView] createRelease', error);
      if (status) status.textContent = `Failed: ${formatExportError(error)}`;
    }
  }

  async deleteRelease(id) {
    if (!confirm(`Delete release "${id}"?`)) return;
    try {
      await apiService.delete(`/api/admin/usage-intelligence/releases/${encodeURIComponent(id)}`);
      await this.loadReleases();
    } catch (error) {
      console.error('[UsageIntelligenceView] deleteRelease', error);
      alert(`Delete failed: ${formatExportError(error)}`);
    }
  }

  async seedReleases() {
    const btn = helpers.dom('#ui-seed-releases-btn');
    const original = btn ? btn.innerHTML : '';
    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Seeding…';
      }
      const data = await apiService.post('/api/admin/usage-intelligence/releases/seed', {});
      const created = (data.results || []).filter((r) => r.status === 'created').length;
      const skipped = (data.results || []).filter((r) => r.status === 'skipped').length;
      alert(`Seed complete: ${created} created, ${skipped} already existed.`);
      await this.loadReleases();
    } catch (error) {
      console.error('[UsageIntelligenceView] seedReleases', error);
      alert(`Seed failed: ${formatExportError(error)}`);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    }
  }
}
