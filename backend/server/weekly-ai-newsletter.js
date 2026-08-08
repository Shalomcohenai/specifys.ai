/**
 * Weekly AI-news newsletter: generate draft (OpenAI) → admin approve → Resend Broadcast.
 */

const OpenAI = require('openai');
const { db, admin } = require('./firebase-admin');
const { logger } = require('./logger');
const emailTemplates = require('./email-templates');
const emailService = require('./email-service');

const COLLECTION = 'newsletters';
const TYPE = 'weekly_ai_news';

function getWeekOfKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

function stripLongDashes(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/\u2014/g, '-') // em dash
    .replace(/\u2013/g, '-') // en dash
    .replace(/—/g, '-')
    .replace(/–/g, '-');
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeBodyHtml(html) {
  if (typeof html !== 'string') return '';
  let out = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<\/script/gi, '');
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(/\sjavascript:/gi, ' blocked:');
  out = out.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  return stripLongDashes(out.trim());
}

function getNewsletterModel() {
  return (
    process.env.OPENAI_WEEKLY_NEWSLETTER_MODEL ||
    process.env.OPENAI_SPEC_GENERATION_MODEL ||
    'gpt-5.6-luna'
  );
}

function getSearchModel() {
  return process.env.OPENAI_WEEKLY_NEWSLETTER_SEARCH_MODEL || 'gpt-4o-mini-search-preview';
}

function usesCompletionTokens(model) {
  const m = String(model || '').toLowerCase();
  return /^o[0-9]/.test(m) || /^gpt-5/.test(m);
}

function buildFullHtml(headerTitle, bodyHtml, { forBroadcast = false } = {}) {
  const greeting = forBroadcast
    ? `<p class="content-text" style="text-align:center;">Hello {{{contact.first_name|there}}},</p>`
    : `<p class="content-text" style="text-align:center;">Hello there,</p>`;
  const unsubscribeUrl = forBroadcast
    ? '{{{RESEND_UNSUBSCRIBE_URL}}}'
    : 'https://specifys-ai.com/pages/unsubscribe.html';

  const body = `
      ${greeting}
      ${bodyHtml}
  `;
  return emailTemplates.getBaseTemplate(escapeHtml(headerTitle), body, true, unsubscribeUrl);
}

async function chatCompletion(client, params) {
  const model = params.model;
  const body = { ...params };
  if (usesCompletionTokens(model)) {
    if (body.max_tokens != null && body.max_completion_tokens == null) {
      body.max_completion_tokens = body.max_tokens;
    }
    delete body.max_tokens;
  }
  const isSearchModel = String(model || '').includes('search-preview');
  if (isSearchModel) {
    delete body.temperature;
    delete body.response_format;
  }
  return client.chat.completions.create(body);
}

function parseJsonContent(raw) {
  const text = String(raw || '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const payload = fenced ? fenced[1] : text;
  return JSON.parse(payload);
}

/**
 * Gather recent AI news bullets (search model when available).
 */
async function gatherAiNewsItems(client) {
  const model = getSearchModel();
  const weekLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  try {
    const response = await chatCompletion(client, {
      model,
      messages: [
        {
          role: 'system',
          content:
            'You research recent artificial intelligence news. Return ONLY valid JSON. No markdown fences. Never use em dashes or en dashes - use a short hyphen (-) only.'
        },
        {
          role: 'user',
          content: `Today is ${weekLabel}. Find 5 to 7 notable AI news items from roughly the past 7 days: new models, major product launches, research breakthroughs, industry announcements, regulation, or developer-tooling news.

Return JSON:
{
  "items": [
    {
      "headline": "short eye-catching headline",
      "summary": "2-4 sentences of clear factual summary",
      "whyItMatters": "one sentence for builders / product people",
      "sourceUrl": "https://... or empty string if unknown"
    }
  ]
}

Rules: English only. Prefer widely reported items. Do not invent dates, quotes, or URLs. No long dashes.`
        }
      ],
      max_tokens: 3500
    });

    const raw = response.choices?.[0]?.message?.content;
    const parsed = parseJsonContent(raw);
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    if (items.length >= 3) return items;
    logger.warn({ count: items.length }, '[weekly-ai-newsletter] Search returned few items; continuing with writer');
    return items;
  } catch (err) {
    logger.warn({ err: err.message }, '[weekly-ai-newsletter] News gather failed; writer will use general recent knowledge');
    return [];
  }
}

/**
 * Write polished newsletter HTML body + subject using the spec-generation model.
 */
async function writeNewsletterCopy(client, items) {
  const model = getNewsletterModel();
  const itemsJson = JSON.stringify(items || [], null, 2);
  const baseUrl = process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com';

  const response = await chatCompletion(client, {
    model,
    temperature: 0.55,
    max_tokens: 6000,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are Specifys.ai\'s weekly AI briefing editor. Write fluent, detailed, well-structured English newsletter copy. Never use em dashes or en dashes - only the short hyphen (-). Reply with ONLY valid JSON.'
      },
      {
        role: 'user',
        content: `Write Specifys.ai's weekly AI news newsletter.

Research / story inputs (may be empty - if empty, cover the most important widely known AI developments from the past week without inventing URLs):
${itemsJson}

Return JSON with keys:
- "subject": plain text email subject. Eye-catching, under ~70 chars. No HTML. Short hyphen only.
- "headerTitle": plain text title inside the orange email header (short, bold idea). No HTML.
- "bodyHtml": HTML fragment only (no html/head/body). Must use Specifys email classes:
  • Centered intro: <p class="content-text" style="text-align:center;">...</p>
  • Section label: <div class="content-title" style="text-align:center;">...</div>
  • Each story: centered title + 2-4 sentence centered paragraphs; optional source link with absolute https URL
  • Use <ul> only if helpful; keep reading rhythm strong
  • Soft Specifys CTA near the end with:
    <div class="btn-container"><a href="${baseUrl}/" class="btn">Build your next app spec</a></div>
  • Optional second CTA:
    <div class="btn-container"><a href="${baseUrl}/pages/pricing.html" class="btn">Try Specifys Pro - $1.99/mo</a></div>
  • Sign-off centered: Best regards, The Specifys.ai Team
  • Do NOT include a Hello greeting (added by the template)
  • Do NOT include unsubscribe link
  • No <script>, iframes, or event handlers
  • Detailed and fluent: aim for a full briefing readers want to finish (roughly 450-900 words of readable copy across the stories)
  • Honest tone - no fake urgency, no invented statistics

Typography rule: never use — or – ; only -`
      }
    ]
  });

  const raw = response.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty newsletter writer response');
  const parsed = parseJsonContent(raw);

  const subject = stripLongDashes(String(parsed.subject || '').trim());
  const headerTitle = stripLongDashes(String(parsed.headerTitle || '').trim());
  const bodyHtml = sanitizeBodyHtml(parsed.bodyHtml || '');

  if (!subject || !headerTitle || !bodyHtml) {
    throw new Error('Newsletter writer missing subject, headerTitle, or bodyHtml');
  }

  return { subject, headerTitle, bodyHtml, model };
}

async function findExistingForWeek(weekOf) {
  const snap = await db
    .collection(COLLECTION)
    .where('type', '==', TYPE)
    .where('weekOf', '==', weekOf)
    .limit(5)
    .get();

  if (snap.empty) return null;
  const preferred = snap.docs.find((d) => {
    const s = d.data().status;
    return s === 'pending_approval' || s === 'draft' || s === 'sending' || s === 'sent';
  });
  const doc = preferred || snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

/**
 * Generate a weekly AI newsletter draft and store it for admin approval.
 * @param {{ force?: boolean, createdBy?: string, createdByEmail?: string }} opts
 */
async function generateWeeklyAiNewsletterDraft(opts = {}) {
  const apiKey = process.env.OPENAI_SPEC_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY (or OPENAI_SPEC_API_KEY) not configured');
    err.code = 'CONFIGURATION_ERROR';
    throw err;
  }

  const weekOf = getWeekOfKey();
  if (!opts.force) {
    const existing = await findExistingForWeek(weekOf);
    if (existing && ['pending_approval', 'draft', 'sending', 'sent'].includes(existing.status)) {
      return {
        success: true,
        skipped: true,
        reason: `Newsletter already exists for week ${weekOf} (status=${existing.status})`,
        newsletter: { id: existing.id, ...existing }
      };
    }
  }

  const client = new OpenAI({ apiKey });
  logger.info({ weekOf, writerModel: getNewsletterModel() }, '[weekly-ai-newsletter] Generating draft');

  const items = await gatherAiNewsItems(client);
  const { subject, headerTitle, bodyHtml, model } = await writeNewsletterCopy(client, items);
  const htmlPreview = buildFullHtml(headerTitle, bodyHtml, { forBroadcast: false });
  const htmlBroadcast = buildFullHtml(headerTitle, bodyHtml, { forBroadcast: true });

  const doc = {
    type: TYPE,
    weekOf,
    subject,
    headerTitle,
    content: bodyHtml,
    html: htmlPreview,
    htmlBroadcast,
    status: 'pending_approval',
    sendChannel: 'resend_broadcast',
    sourceItemCount: items.length,
    model,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: opts.createdBy || 'system',
    createdByEmail: opts.createdByEmail || 'system@specifys-ai.com',
    sentTo: 0,
    clicks: 0
  };

  const ref = await db.collection(COLLECTION).add(doc);
  logger.info({ newsletterId: ref.id, weekOf, subject }, '[weekly-ai-newsletter] Draft saved pending approval');

  // Best-effort admin ping
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'specifysai@gmail.com';
    const dashUrl = `${process.env.BASE_URL || process.env.SITE_URL || 'https://specifys-ai.com'}/pages/new-admin-dashboard.html`;
    await emailService.sendNotificationEmail(
      adminEmail,
      `Weekly AI newsletter ready for approval - ${weekOf}`,
      `<p class="content-text">A new weekly AI newsletter draft is ready.</p>
       <p class="content-text"><strong>Subject:</strong> ${escapeHtml(subject)}</p>
       <div class="btn-container"><a href="${dashUrl}" class="btn">Review in Admin Dashboard</a></div>`
    );
  } catch (pingErr) {
    logger.warn({ err: pingErr.message }, '[weekly-ai-newsletter] Admin ping email failed');
  }

  return {
    success: true,
    skipped: false,
    newsletter: {
      id: ref.id,
      ...doc,
      createdAt: new Date().toISOString()
    }
  };
}

/**
 * Approve and send via Resend Broadcast API.
 */
async function approveAndSendBroadcast(newsletterId, adminUser = {}) {
  const ref = db.collection(COLLECTION).doc(newsletterId);
  const snap = await ref.get();
  if (!snap.exists) {
    const err = new Error('Newsletter not found');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const data = snap.data();
  if (data.status === 'sent') {
    const err = new Error('Newsletter already sent');
    err.code = 'ALREADY_SENT';
    throw err;
  }
  if (data.status === 'rejected') {
    const err = new Error('Newsletter was rejected');
    err.code = 'REJECTED';
    throw err;
  }

  const segmentId = emailService.getResendAudienceId();
  if (!segmentId) {
    const err = new Error('Resend audience/segment not configured (RESEND_AUDIENCE_ID or RESEND_SEGMENT_ID)');
    err.code = 'CONFIGURATION_ERROR';
    throw err;
  }

  const subject = stripLongDashes(data.subject || '');
  const headerTitle = stripLongDashes(data.headerTitle || 'Specifys AI Weekly');
  const bodyHtml = data.content || '';
  const html =
    data.htmlBroadcast ||
    buildFullHtml(headerTitle, bodyHtml, { forBroadcast: true });

  await ref.update({
    status: 'sending',
    decidedAt: admin.firestore.FieldValue.serverTimestamp(),
    decidedBy: adminUser.uid || null,
    decidedByEmail: adminUser.email || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const sendResult = await emailService.sendResendBroadcast({
    segmentId,
    subject,
    html,
    name: `weekly-ai-${data.weekOf || newsletterId}`
  });

  if (!sendResult.success) {
    await ref.update({
      status: 'failed',
      error: sendResult.error || 'Broadcast send failed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const err = new Error(sendResult.error || 'Broadcast send failed');
    err.code = 'SEND_FAILED';
    throw err;
  }

  await ref.update({
    status: 'sent',
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    broadcastId: sendResult.broadcastId || null,
    sendChannel: 'resend_broadcast',
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    error: admin.firestore.FieldValue.delete()
  });

  logger.info(
    { newsletterId, broadcastId: sendResult.broadcastId, subject },
    '[weekly-ai-newsletter] Broadcast sent'
  );

  return {
    success: true,
    broadcastId: sendResult.broadcastId,
    newsletterId
  };
}

async function rejectNewsletter(newsletterId, adminUser = {}, reason = '') {
  const ref = db.collection(COLLECTION).doc(newsletterId);
  const snap = await ref.get();
  if (!snap.exists) {
    const err = new Error('Newsletter not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const data = snap.data();
  if (data.status === 'sent') {
    const err = new Error('Cannot reject a sent newsletter');
    err.code = 'ALREADY_SENT';
    throw err;
  }

  await ref.update({
    status: 'rejected',
    rejectedReason: reason || null,
    decidedAt: admin.firestore.FieldValue.serverTimestamp(),
    decidedBy: adminUser.uid || null,
    decidedByEmail: adminUser.email || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, newsletterId };
}

module.exports = {
  TYPE,
  getWeekOfKey,
  stripLongDashes,
  buildFullHtml,
  generateWeeklyAiNewsletterDraft,
  approveAndSendBroadcast,
  rejectNewsletter,
  findExistingForWeek
};
