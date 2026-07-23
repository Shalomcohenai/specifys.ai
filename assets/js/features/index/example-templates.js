/**
 * Example Spec templates — enriched catalog matching public example specs.
 * Used by homepage Example Specs + /pages/example-specs.html + autoStart prefills.
 * Full enriched JSON: /assets/data/example-specs/<id>.json
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'specifys_example_template';

  const EXAMPLE_TEMPLATES = {
    crm: {
      id: 'crm',
      exampleId: 'crm',
      title: 'CRM',
      product: 'Pipeboard',
      icon: 'fa-address-book',
      shortDesc: 'Pipeline, leads, and follow-ups for small sales teams.',
      demoAnchor: 'overview',
      answers: [
        'A B2B CRM for small sales teams that tracks leads, deals, and follow-ups with a visual pipeline, activity reminders, and team ownership.',
        'Rep captures a lead from web or email → qualifies fit → moves the deal through pipeline stages → logs calls and notes → closes or hands off to customer success.',
        'Email and calendar sync, roles for admin and rep, mobile-friendly views, and basic reporting on conversion by stage.'
      ]
    },
    marketplace: {
      id: 'marketplace',
      exampleId: 'marketplace',
      title: 'Marketplace',
      product: 'Stallio',
      icon: 'fa-store',
      shortDesc: 'Two-sided marketplace with listings, search, and checkout.',
      demoAnchor: 'technical',
      answers: [
        'A two-sided marketplace where sellers list products or services and buyers discover, compare, and purchase with ratings and messaging.',
        'Seller creates a listing → buyer searches and filters → views detail → messages seller or checks out → order and payouts are tracked in dashboards.',
        'Search and filters, payments, reviews, dispute basics, and admin moderation tools.'
      ]
    },
    booking: {
      id: 'booking',
      exampleId: 'booking',
      title: 'Booking',
      product: 'Slotly',
      icon: 'fa-calendar-check',
      shortDesc: 'Appointment booking with availability, reminders, and payments.',
      demoAnchor: 'diagrams',
      answers: [
        'An appointment booking platform for local services (clinics, salons, tutors) with real-time availability, reminders, and optional deposits.',
        'Customer picks service and provider → chooses an open slot → confirms booking → receives reminders → attends or reschedules; provider manages calendar and no-shows.',
        'Calendar sync, SMS/email reminders, deposits, staff roles, and a simple customer history.'
      ]
    },
    'ai-saas': {
      id: 'ai-saas',
      exampleId: 'ai-saas',
      title: 'AI SaaS',
      product: 'PromptForge',
      icon: 'fa-robot',
      shortDesc: 'AI product workspace with prompts, history, and team seats.',
      demoAnchor: 'prompts',
      answers: [
        'An AI SaaS workspace where teams run guided workflows (summarize, research, draft) with saved prompts, usage limits, and shared projects.',
        'User signs up → creates a project → runs an AI workflow → reviews and edits output → saves to history or exports; admins manage seats and billing.',
        'Auth, usage metering, prompt templates, export, and team roles (owner, member).'
      ]
    },
    social: {
      id: 'social',
      exampleId: 'social',
      title: 'Social Network',
      product: 'Trailfeed',
      icon: 'fa-users',
      shortDesc: 'Feed, profiles, follows, and notifications for a niche community.',
      demoAnchor: 'market',
      answers: [
        'A niche social network with profiles, follows, a chronological or ranked feed, posts with media, and notifications.',
        'User creates a profile → follows people or topics → posts updates → engages via likes and comments → gets notified on activity.',
        'Feed ranking basics, media upload, report/block, and push/email notifications.'
      ]
    },
    relaydesk: {
      id: 'relaydesk',
      exampleId: 'relaydesk',
      title: 'Support Inbox',
      product: 'RelayDesk',
      icon: 'fa-inbox',
      shortDesc: 'Shared support inbox with macros and SLA lite for indie SaaS.',
      demoAnchor: 'overview',
      answers: [
        'A lightweight shared customer support inbox for indie SaaS founders with macros and SLA lite timers.',
        'Founder connects support email → teammates assign threads → reply with macros → watch first-response SLA → resolve and search history.',
        'Email sync, macros with variables, flat pricing, and simple open/pending/resolved workflow.'
      ]
    }
  };

  function getTemplate(id) {
    if (!id) return null;
    return EXAMPLE_TEMPLATES[String(id).toLowerCase()] || null;
  }

  function saveTemplateIntent(id) {
    const tpl = getTemplate(id);
    if (!tpl) return false;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id: tpl.id, answers: tpl.answers }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadTemplateIntent() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.answers)) return parsed;
    } catch (e) {
      /* ignore */
    }
    return null;
  }

  function clearTemplateIntent() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
  }

  function templateStartUrl(id) {
    return '/?template=' + encodeURIComponent(id) + '&autoStart=true';
  }

  function demoUrl(id) {
    const tpl = getTemplate(id);
    const exampleId = (tpl && (tpl.exampleId || tpl.id)) || id || 'relaydesk';
    const base = '/pages/demo-spec.html?example=' + encodeURIComponent(exampleId);
    if (!tpl || !tpl.demoAnchor) return base;
    return base + '#' + tpl.demoAnchor;
  }

  global.SpecifysExampleTemplates = {
    EXAMPLE_TEMPLATES,
    STORAGE_KEY,
    getTemplate,
    saveTemplateIntent,
    loadTemplateIntent,
    clearTemplateIntent,
    templateStartUrl,
    demoUrl
  };
})(typeof window !== 'undefined' ? window : globalThis);
