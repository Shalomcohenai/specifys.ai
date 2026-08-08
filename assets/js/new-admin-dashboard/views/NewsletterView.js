/**
 * Newsletter View - Weekly AI newsletter drafts: preview + approve/reject (Resend Broadcast)
 */

import { helpers } from '../utils/helpers.js';
import { apiService } from '../services/ApiService.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class NewsletterView {
  constructor(dataManager, stateManager) {
    this.dataManager = dataManager;
    this.stateManager = stateManager;
    this.newsletters = [];
    this.selectedId = null;
    this.loading = false;
    this.init();
  }

  init() {
    this.listEl = helpers.dom('#newsletter-list');
    this.previewFrame = helpers.dom('#newsletter-preview-frame');
    this.metaEl = helpers.dom('#newsletter-meta');
    this.statusEl = helpers.dom('#newsletter-status-text');
    this.approveBtn = helpers.dom('#newsletter-approve-btn');
    this.rejectBtn = helpers.dom('#newsletter-reject-btn');
    this.generateBtn = helpers.dom('#newsletter-generate-btn');
    this.refreshBtn = helpers.dom('#newsletter-refresh-btn');
    this.filterSelect = helpers.dom('#newsletter-status-filter');

    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => this.loadNewsletters());
    }
    if (this.generateBtn) {
      this.generateBtn.addEventListener('click', () => this.generateWeekly());
    }
    if (this.approveBtn) {
      this.approveBtn.addEventListener('click', () => this.approveSelected());
    }
    if (this.rejectBtn) {
      this.rejectBtn.addEventListener('click', () => this.rejectSelected());
    }
    if (this.filterSelect) {
      this.filterSelect.addEventListener('change', () => this.loadNewsletters());
    }
  }

  show() {
    this.loadNewsletters();
  }

  hide() {}

  update() {
    this.loadNewsletters();
  }

  getSelected() {
    return this.newsletters.find((n) => n.id === this.selectedId) || null;
  }

  async loadNewsletters() {
    if (!this.listEl) return;
    this.loading = true;
    this.listEl.innerHTML = '<div class="table-empty-state" style="padding:16px;">Loading newsletters...</div>';

    try {
      const status = this.filterSelect?.value || '';
      const qs = status && status !== 'all' ? `?status=${encodeURIComponent(status)}&limit=40` : '?limit=40';
      const data = await apiService.get(`/api/admin/newsletters${qs}`);
      this.newsletters = Array.isArray(data.newsletters) ? data.newsletters : [];

      if (!this.selectedId && this.newsletters.length) {
        const pending = this.newsletters.find((n) => n.status === 'pending_approval');
        this.selectedId = (pending || this.newsletters[0]).id;
      }

      this.renderList();
      this.renderPreview();
    } catch (err) {
      console.error('[NewsletterView] load failed', err);
      this.listEl.innerHTML = `<div class="table-empty-state" style="padding:16px;color:#b91c1c;">Failed to load: ${escapeHtml(err.message)}</div>`;
    } finally {
      this.loading = false;
    }
  }

  renderList() {
    if (!this.listEl) return;
    if (!this.newsletters.length) {
      this.listEl.innerHTML = '<div class="table-empty-state" style="padding:16px;">No newsletters yet. Generate a weekly draft to get started.</div>';
      return;
    }

    this.listEl.innerHTML = this.newsletters
      .map((n) => {
        const active = n.id === this.selectedId ? 'is-active' : '';
        const when = n.createdAt ? new Date(n.createdAt).toLocaleString() : '';
        const typeLabel = n.type === 'weekly_ai_news' ? 'AI Weekly' : 'Newsletter';
        return `
          <button type="button" class="newsletter-list-item ${active}" data-id="${n.id}">
            <div class="newsletter-list-item-top">
              <span class="newsletter-list-badge status-${escapeHtml(n.status)}">${escapeHtml(n.status)}</span>
              <span class="newsletter-list-type">${typeLabel}</span>
            </div>
            <div class="newsletter-list-subject">${escapeHtml(n.subject) || '(no subject)'}</div>
            <div class="newsletter-list-meta">${escapeHtml(when)}${n.weekOf ? ` · week ${escapeHtml(n.weekOf)}` : ''}</div>
          </button>
        `;
      })
      .join('');

    this.listEl.querySelectorAll('.newsletter-list-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedId = btn.getAttribute('data-id');
        this.renderList();
        this.renderPreview();
      });
    });
  }

  renderPreview() {
    const n = this.getSelected();
    const canDecide = n && (n.status === 'pending_approval' || n.status === 'draft');

    if (this.approveBtn) this.approveBtn.disabled = !canDecide || this.loading;
    if (this.rejectBtn) this.rejectBtn.disabled = !canDecide || this.loading;

    if (!n) {
      if (this.metaEl) this.metaEl.textContent = 'Select a newsletter';
      if (this.statusEl) this.statusEl.textContent = '';
      if (this.previewFrame) {
        this.previewFrame.srcdoc = '<p style="font-family:sans-serif;color:#666;padding:24px;">No preview</p>';
      }
      return;
    }

    if (this.metaEl) {
      this.metaEl.textContent = `${n.subject || ''} · ${n.sendChannel || 'email'} · ${n.model || ''}`.trim();
    }
    if (this.statusEl) {
      this.statusEl.textContent = `Status: ${n.status}${n.broadcastId ? ` · broadcast ${n.broadcastId}` : ''}`;
    }
    if (this.previewFrame) {
      this.previewFrame.srcdoc = n.html || `<p style="padding:24px;font-family:sans-serif;">No HTML stored. Body only:</p>${n.content || ''}`;
    }
  }

  async generateWeekly() {
    if (!this.generateBtn) return;
    if (!window.confirm('Generate a weekly AI newsletter draft now?')) return;

    this.generateBtn.disabled = true;
    this.generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    try {
      let result = await apiService.post('/api/admin/newsletters/generate-weekly', { force: false });
      if (result.skipped) {
        const force = window.confirm(`${result.reason || 'A draft already exists for this week.'}\n\nGenerate another anyway?`);
        if (force) {
          result = await apiService.post('/api/admin/newsletters/generate-weekly', { force: true });
        }
      }
      if (result.newsletter?.id) this.selectedId = result.newsletter.id;
      await this.loadNewsletters();
    } catch (err) {
      console.error('[NewsletterView] generate failed', err);
      alert(err.message || 'Generate failed');
    } finally {
      this.generateBtn.disabled = false;
      this.generateBtn.innerHTML = '<i class="fas fa-magic"></i> <span>Generate weekly draft</span>';
    }
  }

  async approveSelected() {
    const n = this.getSelected();
    if (!n) return;
    if (!window.confirm(`Approve and send via Resend Broadcast?\n\nSubject: ${n.subject}`)) return;

    this.approveBtn.disabled = true;
    this.rejectBtn.disabled = true;
    try {
      const result = await apiService.post(`/api/admin/newsletters/${n.id}/approve`, {});
      alert(result.broadcastId ? `Sent. Broadcast ID: ${result.broadcastId}` : 'Sent via Broadcast.');
      await this.loadNewsletters();
    } catch (err) {
      console.error('[NewsletterView] approve failed', err);
      alert(err.message || 'Approve/send failed. Check RESEND_AUDIENCE_ID / RESEND_SEGMENT_ID.');
      await this.loadNewsletters();
    }
  }

  async rejectSelected() {
    const n = this.getSelected();
    if (!n) return;
    if (!window.confirm(`Reject this newsletter?\n\nSubject: ${n.subject}`)) return;

    this.approveBtn.disabled = true;
    this.rejectBtn.disabled = true;
    try {
      await apiService.post(`/api/admin/newsletters/${n.id}/reject`, { reason: 'admin_rejected' });
      await this.loadNewsletters();
    } catch (err) {
      console.error('[NewsletterView] reject failed', err);
      alert(err.message || 'Reject failed');
      await this.loadNewsletters();
    }
  }
}
