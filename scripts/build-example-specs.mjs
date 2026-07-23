#!/usr/bin/env node
/**
 * Build public Example Specs (enriched schema) from the RelayDesk gold fixture.
 *
 * Outputs:
 *   backend/fixtures/examples/<id>.json
 *   assets/data/example-specs/<id>.json  (static site fetch)
 *   assets/data/example-specs/manifest.json
 *
 * Usage: node scripts/build-example-specs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const goldPath = path.join(root, 'backend/fixtures/sample-spec-enriched.json');
const outBackend = path.join(root, 'backend/fixtures/examples');
const outAssets = path.join(root, 'assets/data/example-specs');

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function deepMerge(base, patch) {
  if (patch == null) return base;
  if (Array.isArray(patch)) return patch.slice();
  if (typeof patch !== 'object') return patch;
  const out = Array.isArray(base) ? base.slice() : { ...(base || {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = Array.isArray(v) ? v.slice() : v;
    }
  }
  return out;
}

function replaceIn(value, pairs) {
  if (typeof value === 'string') {
    let s = value;
    for (const [from, to] of pairs) s = s.split(from).join(to);
    return s;
  }
  if (Array.isArray(value)) return value.map((x) => replaceIn(x, pairs));
  if (value && typeof value === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(value)) o[k] = replaceIn(v, pairs);
    return o;
  }
  return value;
}

function buildPrompt({ product, shortTitle, ideaSummary, valueProposition, techStack, stages }) {
  const stack = [
    `- Frontend: ${techStack.frontend}`,
    `- Backend: ${techStack.backend}`,
    `- Database: ${techStack.database}`,
    `- Authentication: ${techStack.authentication}`
  ].join('\n');

  const stageBlocks = stages
    .map((st, i) => {
      const n = i + 1;
      return `═══════════════════════════════════════════════════════════════
STAGE ${n}: ${st.name}
═══════════════════════════════════════════════════════════════

## Goal
${st.goal}

## Non-goals
${st.nonGoals.map((x) => `- ${x}`).join('\n')}

## Files to create
${st.filesCreate.map((x) => `- ${x}`).join('\n')}

## Files to modify
${st.filesModify.map((x) => `- ${x}`).join('\n')}

## Acceptance criteria
${st.ac.map((x) => `- [ ] ${x}`).join('\n')}

## Commands
\`\`\`bash
${st.commands}
\`\`\`

## Definition of done
${st.dod.map((x) => `- ${x}`).join('\n')}

## Pitfalls
${st.pitfalls.map((x) => `- ${x}`).join('\n')}

## Variant: Build
${st.build}

## Variant: Review
${st.review}

## Variant: Tests
${st.tests}
`;
    })
    .join('\n');

  return `You are building ${shortTitle} - ${ideaSummary}

PROJECT OVERVIEW:
${valueProposition}

TECHNICAL STACK:
${stack}

DEVELOPMENT STAGES - BUILD IN THIS EXACT ORDER:
Each stage below is an Agent Ticket with Goal, Non-goals, Files, AC, Commands, DoD, Pitfalls, and Build/Review/Tests variants.

${stageBlocks}`;
}

const PRODUCTS = [
  {
    id: 'relaydesk',
    templateId: null,
    title: 'RelayDesk',
    category: 'Support Inbox',
    icon: 'fa-inbox',
    shortDesc: 'Shared support inbox with macros and SLA lite for indie SaaS.',
    demoAnchor: 'overview',
    useGoldAsIs: true,
    answers: [
      'A lightweight shared customer support inbox for indie SaaS founders with macros and SLA lite timers.',
      'Founder connects support email → teammates assign threads → reply with macros → watch first-response SLA → resolve and search history.',
      'Email sync, macros with variables, flat pricing, and simple open/pending/resolved workflow.'
    ]
  },
  {
    id: 'crm',
    templateId: 'crm',
    title: 'Pipeboard',
    category: 'CRM',
    icon: 'fa-address-book',
    shortDesc: 'Pipeline, leads, and follow-ups for small sales teams.',
    demoAnchor: 'overview',
    replacePairs: [
      ['RelayDesk', 'Pipeboard'],
      ['relaydesk', 'pipeboard'],
      ['shared support inbox', 'sales CRM pipeline'],
      ['support inbox', 'CRM pipeline'],
      ['indie SaaS', 'SMB sales'],
      ['helpdesk', 'CRM'],
      ['Thread', 'Deal'],
      ['thread', 'deal'],
      ['Macro', 'Snippet'],
      ['macro', 'snippet'],
      ['Mailbox', 'Pipeline'],
      ['mailbox', 'pipeline'],
      ['SLA lite', 'Follow-up timer'],
      ['SLA', 'Follow-up']
    ],
    overview: {
      shortTitle: 'Pipeboard Sales CRM',
      ideaSummary:
        'Pipeboard is a focused B2B CRM for small sales teams. It tracks leads and deals on a visual pipeline, logs calls and notes, and nudges follow-ups so reps close without enterprise CRM complexity.',
      problemStatement:
        'Small sales teams bounce between spreadsheets, shared inboxes, and sticky notes. Ownership of leads is unclear, follow-ups slip, and managers cannot see conversion by stage. Heavy CRMs are overkill and expensive.',
      targetAudience: {
        ageRange: '25-45 years old, sales reps and founders selling B2B',
        sector: 'B2B SaaS and professional services sales ops',
        interests: ['pipeline hygiene', 'outbound', 'CRM lite', 'sales productivity', 'founder-led sales'],
        needs: [
          'visual pipeline',
          'lead ownership',
          'activity reminders',
          'email/calendar sync basics',
          'stage conversion reporting',
          'mobile-friendly deal views'
        ]
      },
      valueProposition:
        'Pipeboard gives small sales teams a clean pipeline, clear ownership, and follow-up timers—without Salesforce ceremony or per-seat bloat.',
      coreFeaturesOverview: [
        'Visual pipeline: drag deals across stages',
        'Lead capture: web form and manual entry',
        'Activity log: calls, notes, emails',
        'Follow-up timers: nudges when stale',
        'Team ownership: assign reps and managers',
        'Stage reporting: conversion and win rates'
      ],
      userJourneySummary:
        'A rep captures a lead, qualifies fit, moves the deal through pipeline stages, logs activities, and closes or hands off. Managers watch conversion and stalled deals.',
      detailedUserFlow: {
        steps: [
          'Step 1: Admin creates workspace and pipeline stages.',
          'Step 2: Rep captures or imports a lead.',
          'Step 3: Qualify and create a deal on the board.',
          'Step 4: Log calls/notes; follow-up timer resets.',
          'Step 5: Move stages to Closed Won/Lost; reporting updates.'
        ]
      },
      screenDescriptions: {
        screens: [
          {
            name: 'Pipeline Board',
            description: 'Kanban of deals by stage with stale badges.',
            uiComponents: ['Stage columns', 'Deal cards', 'Filter chips'],
            emptyState: 'No deals yet—add a lead or import CSV.',
            errorState: 'Could not load pipeline. Retry.',
            edgeCases: ['Zero stages configured', 'All deals stale']
          },
          {
            name: 'Deal Detail',
            description: 'Contact, stage, activity timeline, next step.',
            uiComponents: ['Contact card', 'Activity feed', 'Stage selector'],
            emptyState: null,
            errorState: 'Failed to save activity. Draft kept.',
            edgeCases: ['Concurrent stage edits']
          },
          {
            name: 'Leads Inbox',
            description: 'Unqualified leads awaiting ownership.',
            uiComponents: ['Lead list', 'Assign control', 'Qualify CTA'],
            emptyState: 'Inbox zero—nice work.',
            errorState: 'Import failed—check CSV columns.',
            edgeCases: ['Duplicate emails']
          },
          {
            name: 'Reports',
            description: 'Conversion by stage and rep.',
            uiComponents: ['Funnel chart', 'Date range', 'Rep filter'],
            emptyState: 'Not enough closed deals yet.',
            errorState: 'Report query timed out.',
            edgeCases: ['Timezone boundaries']
          }
        ],
        navigationStructure: 'Top nav: Pipeline, Leads, Reports, Settings. Deal detail opens as split pane on desktop.'
      },
      complexityScore: { architecture: 65, integrations: 50, functionality: 60, userSystem: 55 },
      personas: [
        {
          name: 'Alex',
          role: 'Founder-seller',
          goals: ['Keep every lead owned', 'See stalled deals fast'],
          pains: ['Spreadsheet chaos', 'Missed follow-ups'],
          jtbd: 'When a lead replies, I want one place to move the deal so nothing slips.'
        },
        {
          name: 'Riley',
          role: 'Account executive',
          goals: ['Clear daily next steps', 'Log calls quickly'],
          pains: ['Clunky CRM forms', 'Unclear priorities'],
          jtbd: 'When I open Pipeboard, I want my deals and due follow-ups first.'
        },
        {
          name: 'Casey',
          role: 'Sales lead',
          goals: ['Stage conversion visibility', 'Fair lead routing'],
          pains: ['No funnel truth', 'Reps hiding notes in email'],
          jtbd: 'When reviewing the week, I want conversion by stage without exporting CSV.'
        }
      ],
      epics: [
        {
          name: 'Pipeline',
          description: 'Create, move, and close deals on a visual board.',
          stories: [
            {
              title: 'View pipeline',
              description: 'As Riley, I see deals grouped by stage.',
              acceptanceCriteria: [
                'Given deals exist, when I open Pipeline, then cards appear in stage columns',
                'Stale badge shows when follow-up timer exceeded',
                'Empty state shows when zero deals'
              ]
            },
            {
              title: 'Move deal stage',
              description: 'As Riley, I drag a deal to the next stage.',
              acceptanceCriteria: [
                'Drop updates stage persisted',
                'Activity feed records stage change',
                'Invalid drop is rejected with toast'
              ]
            }
          ]
        },
        {
          name: 'Leads',
          description: 'Capture and qualify inbound leads.',
          stories: [
            {
              title: 'Qualify lead to deal',
              description: 'As Alex, I convert a lead into a deal.',
              acceptanceCriteria: [
                'Qualify CTA creates deal on first stage',
                'Lead marked converted',
                'Owner defaults to current user'
              ]
            }
          ]
        },
        {
          name: 'Follow-ups',
          description: 'Timers and nudges for stale deals.',
          stories: [
            {
              title: 'Configure follow-up default',
              description: 'As Casey, I set default days until stale.',
              acceptanceCriteria: [
                'Settings accepts 1-30 days',
                'New deals inherit default',
                'Badge appears after due'
              ]
            }
          ]
        }
      ],
      nonGoals: [
        'Full marketing automation',
        'Complex CPQ / quoting engine',
        'Enterprise territory management',
        'Native mobile offline sync v1'
      ],
      successMetrics: {
        northStar: 'Percent of open deals with a next step due within 7 days',
        leading: ['Weekly active reps', 'Activities logged per deal', 'Stage conversion rate']
      },
      permissionsMatrix: [
        { role: 'Owner', permissions: ['manage billing', 'edit stages', 'invite', 'all deals'] },
        { role: 'Rep', permissions: ['own deals', 'log activity', 'view team board'] },
        { role: 'Viewer', permissions: ['read reports', 'no edit'] }
      ],
      glossary: [
        { term: 'Deal', definition: 'An opportunity moving through pipeline stages.' },
        { term: 'Lead', definition: 'An unqualified contact before deal creation.' },
        { term: 'Follow-up timer', definition: 'Days until a deal is marked stale without activity.' }
      ],
      suggestionsIdeaSummary: { toInclude: [], notToInclude: ['Emphasize SMB vs enterprise CRM', 'Highlight follow-up timers'] },
      suggestionsCoreFeatures: { toInclude: [], notToInclude: ['CSV import', 'Calendar sync lite'] },
      inferredItems: ['[INFERRED] Reports screen from conversion needs']
    },
    mermaidTweaks: [
      ['WORKSPACE', 'ORG'],
      ['MAILBOX', 'PIPELINE'],
      ['THREAD', 'DEAL'],
      ['MACRO', 'SNIPPET'],
      ['Founder or Agent', 'Rep or Manager'],
      ['Inbound email', 'Inbound lead'],
      ['Email Worker', 'Ingest Worker'],
      ['Mail Provider', 'Form Webhook']
    ],
    designColors: {
      primary: '#2563EB',
      secondary: '#0F172A',
      accent: '#F59E0B',
      background: '#F8FAFC',
      text: '#0F172A',
      success: '#16A34A',
      warning: '#D97706',
      danger: '#DC2626',
      muted: '#64748B',
      surface: '#FFFFFF',
      border: '#E2E8F0'
    },
    competitors: [
      {
        name: 'HubSpot Free CRM',
        advantages: 'Brand and free tier breadth',
        disadvantages: 'Upsell pressure and noise for tiny teams',
        strengths: 'Ecosystem',
        weaknesses: 'Complexity creep',
        differentiators: 'Marketing suite',
        marketPosition: 'Default free CRM',
        features: ['deals', 'email', 'reporting'],
        gaps: ['opinionated simplicity'],
        marketShare: 'High among SMBs',
        pricingSummary: 'Free + paid hubs',
        featureGapVsUs: ['Quieter UX', 'Faster stale-deal nudges']
      },
      {
        name: 'Pipedrive',
        advantages: 'Pipeline-first UX',
        disadvantages: 'Cost at small team size',
        strengths: 'Sales focus',
        weaknesses: 'Price',
        differentiators: 'Activity-based selling',
        marketPosition: 'Sales CRM leader mid-market',
        features: ['pipeline', 'activities'],
        gaps: ['lighter pricing'],
        marketShare: 'Strong',
        pricingSummary: 'Per seat',
        featureGapVsUs: ['Flat small-team pricing']
      }
    ],
    promptStages: [
      {
        name: 'PROJECT SETUP & BASIC STRUCTURE',
        goal: 'Scaffold Pipeboard monorepo with web and API so agents can implement pipeline next.',
        nonGoals: ['No email sync yet', 'No billing', 'No mobile app'],
        filesCreate: ['apps/web/package.json', 'apps/api/src/index.ts', 'packages/shared/src/types.ts'],
        filesModify: ['Root package.json workspaces'],
        ac: ['pnpm install succeeds', 'API health 200', 'Web shell shows Pipeline/Leads/Reports'],
        commands: 'pnpm install\npnpm --filter api dev\npnpm --filter web dev',
        dod: ['Health green', 'README lists apps'],
        pitfalls: ['No secrets in web', 'Strict TypeScript'],
        build: '1.1 Workspaces\n1.2 Health route\n1.3 Vite shell\n1.4 DealStatus type',
        review: '- No secrets\n- Workspace filters',
        tests: '- Unit: health\n- Smoke: shell routes'
      },
      {
        name: 'PIPELINE BOARD',
        goal: 'Implement pipeline board against mocked deals API with stale badges.',
        nonGoals: ['Real calendar sync', 'Reporting charts'],
        filesCreate: ['apps/web/src/pages/PipelinePage.tsx', 'apps/web/src/components/DealCard.tsx', 'apps/api/src/routes/deals.ts'],
        filesModify: ['apps/web/src/App.tsx'],
        ac: ['GET /api/deals returns seeded deals', 'Empty state when none', 'Stale badge when due passed'],
        commands: 'pnpm --filter api test\npnpm --filter web test -- PipelinePage',
        dod: ['Loading/empty/error states match Design'],
        pitfalls: ['Do not encode urgency by color alone'],
        build: '2.1 Seed deals\n2.2 List API\n2.3 Board UI\n2.4 Badges',
        review: '- Contrast AA\n- Drag persistence',
        tests: '- RTL empty state\n- API stage filter'
      }
    ],
    answers: [
      'A B2B CRM for small sales teams that tracks leads, deals, and follow-ups with a visual pipeline, activity reminders, and team ownership.',
      'Rep captures a lead → qualifies → moves the deal through stages → logs calls and notes → closes or hands off.',
      'Email/calendar sync basics, roles for admin and rep, mobile-friendly views, and conversion reporting by stage.'
    ]
  },
  {
    id: 'marketplace',
    templateId: 'marketplace',
    title: 'Stallio',
    category: 'Marketplace',
    icon: 'fa-store',
    shortDesc: 'Two-sided marketplace with listings, search, and checkout.',
    demoAnchor: 'technical',
    replacePairs: [
      ['RelayDesk', 'Stallio'],
      ['relaydesk', 'stallio'],
      ['shared support inbox', 'two-sided marketplace'],
      ['support inbox', 'marketplace'],
      ['indie SaaS', 'local makers'],
      ['Thread', 'Order'],
      ['thread', 'order'],
      ['Macro', 'Listing template'],
      ['Mailbox', 'Catalog'],
      ['SLA lite', 'Fulfillment SLA'],
      ['Founder or Agent', 'Buyer or Seller']
    ],
    overview: {
      shortTitle: 'Stallio Local Marketplace',
      ideaSummary:
        'Stallio is a two-sided marketplace where local makers list products and buyers discover, message, and purchase with ratings and simple payouts.',
      problemStatement:
        'Local makers lack a trustworthy place to sell without Amazon fees, while buyers struggle to find verified nearby goods. Generic classifieds lack checkout and dispute basics.',
      targetAudience: {
        ageRange: '22-50 local makers and shoppers',
        sector: 'Local commerce / creator retail',
        interests: ['handmade', 'local shopping', 'seller tools', 'trust & safety'],
        needs: ['listings', 'search/filters', 'checkout', 'messaging', 'reviews', 'seller dashboard']
      },
      valueProposition:
        'Stallio connects local makers and buyers with listings, search, checkout, and lightweight trust tools—without marketplace mega-fee complexity.',
      coreFeaturesOverview: [
        'Seller listings with photos and inventory',
        'Search and filters by category and distance',
        'In-app messaging before purchase',
        'Checkout with deposits/payments',
        'Reviews and basic dispute flow',
        'Seller dashboard for orders and payouts'
      ],
      userJourneySummary:
        'Seller creates a listing; buyer searches, messages, checks out; order and payout tracked; both leave reviews.',
      detailedUserFlow: {
        steps: [
          'Step 1: Seller onboards and creates a listing.',
          'Step 2: Buyer searches and opens listing detail.',
          'Step 3: Optional message; then checkout.',
          'Step 4: Seller fulfills; buyer confirms.',
          'Step 5: Payout and reviews.'
        ]
      },
      screenDescriptions: {
        screens: [
          {
            name: 'Browse',
            description: 'Search results with filters.',
            uiComponents: ['Search bar', 'Filter chips', 'Listing cards'],
            emptyState: 'No listings match—widen filters.',
            errorState: 'Search failed. Retry.',
            edgeCases: ['Zero sellers in radius']
          },
          {
            name: 'Listing Detail',
            description: 'Photos, price, seller, CTA.',
            uiComponents: ['Gallery', 'Buy button', 'Message seller'],
            emptyState: null,
            errorState: 'Listing unavailable.',
            edgeCases: ['Out of stock mid-checkout']
          },
          {
            name: 'Seller Dashboard',
            description: 'Orders, inventory, payouts.',
            uiComponents: ['Order table', 'Inventory', 'Payout card'],
            emptyState: 'No orders yet.',
            errorState: 'Payout status unavailable.',
            edgeCases: ['Partial refund']
          },
          {
            name: 'Checkout',
            description: 'Payment and shipping details.',
            uiComponents: ['Address form', 'Pay button', 'Order summary'],
            emptyState: null,
            errorState: 'Payment declined—try another method.',
            edgeCases: ['Idempotent retry']
          }
        ],
        navigationStructure: 'Top: Browse, Messages, Sell, Account. Checkout is a focused flow.'
      },
      complexityScore: { architecture: 80, integrations: 75, functionality: 70, userSystem: 65 },
      personas: [
        {
          name: 'Mina',
          role: 'Maker-seller',
          goals: ['Sell without huge fees', 'Simple order tracking'],
          pains: ['Instagram DMs as checkout', 'No payout clarity'],
          jtbd: 'When I finish a batch, I want listings and orders in one place.'
        },
        {
          name: 'Omar',
          role: 'Local buyer',
          goals: ['Find trusted nearby goods', 'Message before buying'],
          pains: ['Scammy classifieds', 'No reviews'],
          jtbd: 'When I search locally, I want verified sellers and clear checkout.'
        },
        {
          name: 'Priya',
          role: 'Marketplace ops',
          goals: ['Moderate listings', 'Resolve disputes'],
          pains: ['Sparse tools', 'Unclear policies'],
          jtbd: 'When a dispute opens, I want status and evidence in one queue.'
        }
      ],
      epics: [
        {
          name: 'Listings',
          description: 'Create and discover product listings.',
          stories: [
            {
              title: 'Create listing',
              description: 'As Mina, I publish a listing with photos and price.',
              acceptanceCriteria: [
                'Required fields validated',
                'Listing appears in Browse when active',
                'Draft can be saved'
              ]
            }
          ]
        },
        {
          name: 'Checkout',
          description: 'Pay and create an order.',
          stories: [
            {
              title: 'Complete checkout',
              description: 'As Omar, I pay for a listing.',
              acceptanceCriteria: [
                'Payment intent created',
                'Order appears for seller',
                'Idempotent on retry'
              ]
            }
          ]
        },
        {
          name: 'Trust',
          description: 'Reviews and dispute basics.',
          stories: [
            {
              title: 'Leave review',
              description: 'As Omar, I rate a completed order.',
              acceptanceCriteria: [
                'Only completed orders',
                'One review per order side',
                'Stars and text stored'
              ]
            }
          ]
        }
      ],
      nonGoals: [
        'Global shipping logistics network',
        'Live streaming shopping',
        'Crypto payments',
        'Full ERP for sellers'
      ],
      successMetrics: {
        northStar: 'Weekly completed orders with review rate above target',
        leading: ['Listings published / week', 'Message-to-checkout conversion', 'Dispute rate']
      },
      permissionsMatrix: [
        { role: 'Buyer', permissions: ['browse', 'message', 'checkout', 'review'] },
        { role: 'Seller', permissions: ['list', 'fulfill', 'view payouts'] },
        { role: 'Admin', permissions: ['moderate', 'resolve disputes'] }
      ],
      glossary: [
        { term: 'Listing', definition: 'A sellable product or service entry.' },
        { term: 'Order', definition: 'A paid purchase between buyer and seller.' },
        { term: 'Payout', definition: 'Transfer of funds to seller after fulfillment window.' }
      ],
      suggestionsIdeaSummary: { toInclude: [], notToInclude: ['Local trust angle', 'Maker-first fees'] },
      suggestionsCoreFeatures: { toInclude: [], notToInclude: ['Messaging', 'Reviews'] },
      inferredItems: ['[INFERRED] Admin moderation from trust needs']
    },
    mermaidTweaks: [
      ['MAILBOX', 'CATALOG'],
      ['THREAD', 'ORDER'],
      ['MACRO', 'LISTING'],
      ['Inbound email', 'Checkout event'],
      ['Email Worker', 'Orders Worker'],
      ['Mail Provider', 'Payments']
    ],
    designColors: {
      primary: '#0D9488',
      secondary: '#134E4A',
      accent: '#F97316',
      background: '#F0FDFA',
      text: '#134E4A',
      success: '#15803D',
      warning: '#CA8A04',
      danger: '#B91C1C',
      muted: '#5B7C7A',
      surface: '#FFFFFF',
      border: '#CCFBF1'
    },
    competitors: [
      {
        name: 'Etsy',
        advantages: 'Demand and brand',
        disadvantages: 'Fees and global noise',
        strengths: 'Traffic',
        weaknesses: 'Local discovery weak',
        differentiators: 'Handmade focus',
        marketPosition: 'Global handmade',
        features: ['listings', 'payments'],
        gaps: ['hyperlocal'],
        marketShare: 'Large',
        pricingSummary: 'Listing + transaction fees',
        featureGapVsUs: ['Local radius search', 'Lower fee positioning']
      },
      {
        name: 'Facebook Marketplace',
        advantages: 'Distribution',
        disadvantages: 'Trust and checkout gaps',
        strengths: 'Reach',
        weaknesses: 'Scams / weak payments',
        differentiators: 'Social graph',
        marketPosition: 'Casual classifieds',
        features: ['listings', 'chat'],
        gaps: ['structured checkout'],
        marketShare: 'Very high',
        pricingSummary: 'Mostly free',
        featureGapVsUs: ['Built-in checkout', 'Seller payouts']
      }
    ],
    promptStages: [
      {
        name: 'PROJECT SETUP & BASIC STRUCTURE',
        goal: 'Scaffold Stallio apps for browse and seller flows.',
        nonGoals: ['Payments live', 'Moderation AI'],
        filesCreate: ['apps/web/package.json', 'apps/api/src/index.ts', 'packages/shared/src/types.ts'],
        filesModify: ['Root package.json workspaces'],
        ac: ['Health 200', 'Browse shell route', 'Sell shell route'],
        commands: 'pnpm install\npnpm --filter api dev\npnpm --filter web dev',
        dod: ['README', 'CI lint'],
        pitfalls: ['Secrets only on API'],
        build: '1.1 Workspaces\n1.2 Health\n1.3 Shell routes',
        review: '- No secrets in web',
        tests: '- Health unit'
      },
      {
        name: 'LISTINGS & SEARCH',
        goal: 'Listing CRUD and search API with Browse UI.',
        nonGoals: ['Payments', 'Reviews'],
        filesCreate: ['apps/api/src/routes/listings.ts', 'apps/web/src/pages/BrowsePage.tsx'],
        filesModify: ['packages/shared/src/types.ts'],
        ac: ['Create listing as seller', 'Search returns filters', 'Empty state'],
        commands: 'pnpm --filter api test\npnpm --filter web test -- BrowsePage',
        dod: ['Empty/error states'],
        pitfalls: ['Paginate search'],
        build: '2.1 Listing model\n2.2 Search\n2.3 Browse UI',
        review: '- Auth on create',
        tests: '- Search filter'
      }
    ],
    answers: [
      'A two-sided marketplace where sellers list products or services and buyers discover, compare, and purchase with ratings and messaging.',
      'Seller creates a listing → buyer searches → views detail → messages or checks out → order and payouts tracked.',
      'Search and filters, payments, reviews, dispute basics, and admin moderation tools.'
    ]
  },
  {
    id: 'booking',
    templateId: 'booking',
    title: 'Slotly',
    category: 'Booking',
    icon: 'fa-calendar-check',
    shortDesc: 'Appointments with availability, reminders, and payments.',
    demoAnchor: 'diagrams',
    replacePairs: [
      ['RelayDesk', 'Slotly'],
      ['relaydesk', 'slotly'],
      ['shared support inbox', 'appointment booking platform'],
      ['support inbox', 'booking calendar'],
      ['indie SaaS', 'local services'],
      ['Thread', 'Appointment'],
      ['thread', 'appointment'],
      ['Macro', 'Service package'],
      ['Mailbox', 'Calendar'],
      ['SLA lite', 'Reminder window'],
      ['Founder or Agent', 'Customer or Provider']
    ],
    overview: {
      shortTitle: 'Slotly Appointment Booking',
      ideaSummary:
        'Slotly helps local services (clinics, salons, tutors) offer real-time availability, reminders, and optional deposits so customers book without phone tag.',
      problemStatement:
        'Providers juggle paper calendars and Instagram DMs; customers cannot see open slots reliably. No-shows hurt revenue and reminder tools are fragmented.',
      targetAudience: {
        ageRange: '25-55 service providers and their customers',
        sector: 'Local services scheduling',
        interests: ['appointments', 'SMS reminders', 'deposits', 'staff calendars'],
        needs: ['availability', 'booking', 'reminders', 'deposits', 'staff roles', 'customer history']
      },
      valueProposition:
        'Slotly turns availability into bookable slots with reminders and deposits—so local services fill calendars without phone tag.',
      coreFeaturesOverview: [
        'Real-time availability by service and staff',
        'Customer booking flow with confirmation',
        'SMS/email reminders',
        'Optional deposits',
        'Staff calendars and roles',
        'Customer history'
      ],
      userJourneySummary:
        'Customer picks service and provider, chooses a slot, confirms (and deposits), receives reminders, attends or reschedules; provider manages calendar and no-shows.',
      detailedUserFlow: {
        steps: [
          'Step 1: Provider sets services, hours, and staff.',
          'Step 2: Customer selects service and open slot.',
          'Step 3: Confirms booking; optional deposit.',
          'Step 4: Reminders send before appointment.',
          'Step 5: Attend, no-show, or reschedule.'
        ]
      },
      screenDescriptions: {
        screens: [
          {
            name: 'Public Booking',
            description: 'Service picker and slot grid.',
            uiComponents: ['Service list', 'Slot grid', 'Confirm CTA'],
            emptyState: 'No open slots this week.',
            errorState: 'Slot just taken—pick another.',
            edgeCases: ['Double-book race']
          },
          {
            name: 'Provider Calendar',
            description: 'Day/week view of appointments.',
            uiComponents: ['Calendar', 'Appointment card', 'Block time'],
            emptyState: 'No appointments today.',
            errorState: 'Calendar sync failed.',
            edgeCases: ['Overlapping blocks']
          },
          {
            name: 'Services',
            description: 'Manage duration and price.',
            uiComponents: ['Service table', 'Duration', 'Deposit toggle'],
            emptyState: 'Add your first service.',
            errorState: 'Could not save service.',
            edgeCases: ['Zero duration invalid']
          },
          {
            name: 'Reminders',
            description: 'Configure reminder windows.',
            uiComponents: ['Timing chips', 'Channel toggles'],
            emptyState: null,
            errorState: 'SMS provider error.',
            edgeCases: ['Quiet hours']
          }
        ],
        navigationStructure: 'Provider: Calendar, Services, Staff, Settings. Public booking is a separate route.'
      },
      complexityScore: { architecture: 70, integrations: 65, functionality: 65, userSystem: 55 },
      personas: [
        {
          name: 'Elena',
          role: 'Salon owner',
          goals: ['Fill the book', 'Cut no-shows'],
          pains: ['Phone tag', 'No-show losses'],
          jtbd: 'When a client wants a cut, I want them to self-book a real open slot.'
        },
        {
          name: 'Nate',
          role: 'Customer',
          goals: ['Book fast on mobile', 'Get reminders'],
          pains: ['Calling during work', 'Forgotten appointments'],
          jtbd: 'When I need an appointment, I want open slots and a reminder.'
        },
        {
          name: 'Samira',
          role: 'Front-desk staff',
          goals: ['Reschedule quickly', 'See staff load'],
          pains: ['Double books', 'Scattered notes'],
          jtbd: 'When someone cancels, I want to free the slot instantly.'
        }
      ],
      epics: [
        {
          name: 'Availability',
          description: 'Compute and expose open slots.',
          stories: [
            {
              title: 'View open slots',
              description: 'As Nate, I see open times for a service.',
              acceptanceCriteria: [
                'Slots respect hours and existing bookings',
                'Taken slot cannot be booked',
                'Timezone displayed clearly'
              ]
            }
          ]
        },
        {
          name: 'Booking',
          description: 'Create and manage appointments.',
          stories: [
            {
              title: 'Confirm booking',
              description: 'As Nate, I book a slot.',
              acceptanceCriteria: [
                'Appointment created',
                'Confirmation sent',
                'Race loses with clear error'
              ]
            }
          ]
        },
        {
          name: 'Reminders',
          description: 'Notify before appointment.',
          stories: [
            {
              title: 'Send reminder',
              description: 'As system, I send SMS/email before start.',
              acceptanceCriteria: [
                'Respects configured window',
                'Skips cancelled',
                'Logs delivery status'
              ]
            }
          ]
        }
      ],
      nonGoals: [
        'Full EHR / clinical charting',
        'Multi-location franchise ERP',
        'Marketplace of providers v1',
        'Hardware POS'
      ],
      successMetrics: {
        northStar: 'Booked appointments attended rate',
        leading: ['Online booking share', 'Reminder delivery success', 'No-show rate']
      },
      permissionsMatrix: [
        { role: 'Owner', permissions: ['billing', 'services', 'staff', 'all calendars'] },
        { role: 'Staff', permissions: ['own calendar', 'book/reschedule'] },
        { role: 'Customer', permissions: ['book', 'reschedule own'] }
      ],
      glossary: [
        { term: 'Slot', definition: 'A bookable time interval for a service and provider.' },
        { term: 'Deposit', definition: 'Optional prepayment to reduce no-shows.' },
        { term: 'Reminder window', definition: 'Hours before start when notifications send.' }
      ],
      suggestionsIdeaSummary: { toInclude: [], notToInclude: ['No-show reduction', 'Self-serve booking'] },
      suggestionsCoreFeatures: { toInclude: [], notToInclude: ['Deposits', 'Staff roles'] },
      inferredItems: ['[INFERRED] Quiet hours for SMS']
    },
    mermaidTweaks: [
      ['MAILBOX', 'CALENDAR'],
      ['THREAD', 'APPOINTMENT'],
      ['MACRO', 'SERVICE'],
      ['Inbound email', 'Booking request'],
      ['Email Worker', 'Reminder Worker'],
      ['Mail Provider', 'SMS Provider']
    ],
    designColors: {
      primary: '#7C3AED',
      secondary: '#1E1B4B',
      accent: '#14B8A6',
      background: '#FAF5FF',
      text: '#1E1B4B',
      success: '#16A34A',
      warning: '#EAB308',
      danger: '#E11D48',
      muted: '#6B7280',
      surface: '#FFFFFF',
      border: '#E9D5FF'
    },
    competitors: [
      {
        name: 'Calendly',
        advantages: 'Simple scheduling brand',
        disadvantages: 'Weak local service ops (deposits/staff)',
        strengths: 'Ease',
        weaknesses: 'Service business features',
        differentiators: 'Link-based booking',
        marketPosition: 'Meeting scheduling',
        features: ['availability', 'reminders'],
        gaps: ['deposits', 'staff services'],
        marketShare: 'High',
        pricingSummary: 'Freemium seats',
        featureGapVsUs: ['Service duration catalog', 'Deposit collection']
      },
      {
        name: 'Square Appointments',
        advantages: 'Payments ecosystem',
        disadvantages: 'Heavier for tutors/indie',
        strengths: 'POS + payments',
        weaknesses: 'Complexity',
        differentiators: 'Commerce suite',
        marketPosition: 'SMB appointments',
        features: ['booking', 'payments'],
        gaps: ['lighter UX'],
        marketShare: 'Strong SMB',
        pricingSummary: 'Processing + software',
        featureGapVsUs: ['Tutor-friendly simplicity']
      }
    ],
    promptStages: [
      {
        name: 'PROJECT SETUP & BASIC STRUCTURE',
        goal: 'Scaffold Slotly web/API for booking flows.',
        nonGoals: ['SMS live', 'Payments live'],
        filesCreate: ['apps/web/package.json', 'apps/api/src/index.ts', 'packages/shared/src/types.ts'],
        filesModify: ['Root package.json workspaces'],
        ac: ['Health 200', 'Public booking shell', 'Provider calendar shell'],
        commands: 'pnpm install\npnpm --filter api dev\npnpm --filter web dev',
        dod: ['README', 'CI lint'],
        pitfalls: ['No secrets in web'],
        build: '1.1 Workspaces\n1.2 Health\n1.3 Shells',
        review: '- Strict TS',
        tests: '- Health'
      },
      {
        name: 'AVAILABILITY & BOOKING',
        goal: 'Slot computation and booking create with race handling.',
        nonGoals: ['Reminders', 'Deposits'],
        filesCreate: ['apps/api/src/routes/slots.ts', 'apps/api/src/routes/appointments.ts', 'apps/web/src/pages/BookingPage.tsx'],
        filesModify: ['packages/shared/src/types.ts'],
        ac: ['Open slots exclude conflicts', 'Booking create atomic', 'Taken slot errors clearly'],
        commands: 'pnpm --filter api test\npnpm --filter web test -- BookingPage',
        dod: ['Race test green'],
        pitfalls: ['Timezone math'],
        build: '2.1 Hours model\n2.2 Slot API\n2.3 Booking UI',
        review: '- TZ tests',
        tests: '- Double-book rejected'
      }
    ],
    answers: [
      'An appointment booking platform for local services with real-time availability, reminders, and optional deposits.',
      'Customer picks service and provider → chooses slot → confirms → reminders → attends or reschedules; provider manages calendar.',
      'Calendar sync, SMS/email reminders, deposits, staff roles, and customer history.'
    ]
  },
  {
    id: 'ai-saas',
    templateId: 'ai-saas',
    title: 'PromptForge',
    category: 'AI SaaS',
    icon: 'fa-robot',
    shortDesc: 'AI workspace with prompts, history, and team seats.',
    demoAnchor: 'prompts',
    replacePairs: [
      ['RelayDesk', 'PromptForge'],
      ['relaydesk', 'promptforge'],
      ['shared support inbox', 'AI workflow workspace'],
      ['support inbox', 'AI workspace'],
      ['indie SaaS', 'product teams'],
      ['Thread', 'Run'],
      ['thread', 'run'],
      ['Macro', 'Prompt template'],
      ['Mailbox', 'Project'],
      ['SLA lite', 'Usage budget'],
      ['Founder or Agent', 'Member or Admin']
    ],
    overview: {
      shortTitle: 'PromptForge AI Workspace',
      ideaSummary:
        'PromptForge is an AI SaaS workspace where teams run guided workflows (summarize, research, draft) with saved prompts, usage limits, and shared projects.',
      problemStatement:
        'Teams paste prompts into chat UIs with no shared history, weak governance, or usage control. Admins cannot meter seats or standardize workflows.',
      targetAudience: {
        ageRange: '24-45 PMs, marketers, and ops leads',
        sector: 'B2B AI productivity software',
        interests: ['prompt ops', 'team AI', 'usage metering', 'workflow templates'],
        needs: ['auth', 'projects', 'prompt templates', 'run history', 'usage limits', 'roles']
      },
      valueProposition:
        'PromptForge gives teams guided AI workflows with shared prompts, history, and seat-level usage—so AI work is repeatable and governed.',
      coreFeaturesOverview: [
        'Guided workflows: summarize, research, draft',
        'Saved prompt templates',
        'Run history and exports',
        'Usage metering and limits',
        'Team roles: owner, member',
        'Shared projects'
      ],
      userJourneySummary:
        'User signs up, creates a project, runs an AI workflow, edits output, saves to history or exports; admins manage seats and billing.',
      detailedUserFlow: {
        steps: [
          'Step 1: Owner invites members and sets usage limits.',
          'Step 2: Member creates a project.',
          'Step 3: Picks a workflow template and runs it.',
          'Step 4: Reviews output; saves or exports.',
          'Step 5: Admin reviews usage dashboard.'
        ]
      },
      screenDescriptions: {
        screens: [
          {
            name: 'Projects',
            description: 'List of shared AI projects.',
            uiComponents: ['Project cards', 'New project', 'Usage chip'],
            emptyState: 'Create your first project.',
            errorState: 'Could not load projects.',
            edgeCases: ['Over quota']
          },
          {
            name: 'Run Workspace',
            description: 'Prompt, model settings, output pane.',
            uiComponents: ['Template picker', 'Editor', 'Output'],
            emptyState: null,
            errorState: 'Model error—retry or switch model.',
            edgeCases: ['Token limit exceeded']
          },
          {
            name: 'History',
            description: 'Past runs with filters.',
            uiComponents: ['Run list', 'Search', 'Export'],
            emptyState: 'No runs yet.',
            errorState: 'History query failed.',
            edgeCases: ['Large export']
          },
          {
            name: 'Admin Usage',
            description: 'Seats and metering.',
            uiComponents: ['Seat table', 'Usage chart', 'Limit controls'],
            emptyState: null,
            errorState: 'Billing provider unavailable.',
            edgeCases: ['Soft vs hard limit']
          }
        ],
        navigationStructure: 'Top: Projects, History, Templates, Admin. Run workspace is project-scoped.'
      },
      complexityScore: { architecture: 75, integrations: 70, functionality: 70, userSystem: 60 },
      personas: [
        {
          name: 'Jordan',
          role: 'Product marketer',
          goals: ['Repeatable drafts', 'Share best prompts'],
          pains: ['Lost chat threads', 'Inconsistent tone'],
          jtbd: 'When I need a brief, I want a saved workflow with history.'
        },
        {
          name: 'Avery',
          role: 'Team admin',
          goals: ['Control spend', 'Seat management'],
          pains: ['Shadow AI tools', 'No usage visibility'],
          jtbd: 'When month ends, I want usage by seat without spreadsheet export.'
        },
        {
          name: 'Dev',
          role: 'Ops engineer',
          goals: ['Reliable model routing', 'Export audit'],
          pains: ['Provider outages', 'Secret sprawl'],
          jtbd: 'When a provider fails, I want fallback and clear errors.'
        }
      ],
      epics: [
        {
          name: 'Workflows',
          description: 'Run guided AI workflows.',
          stories: [
            {
              title: 'Run template',
              description: 'As Jordan, I run a draft workflow.',
              acceptanceCriteria: [
                'Template inputs validated',
                'Run stored in history',
                'Usage incremented'
              ]
            }
          ]
        },
        {
          name: 'Templates',
          description: 'Save and share prompts.',
          stories: [
            {
              title: 'Save template',
              description: 'As Jordan, I save a prompt template to the project.',
              acceptanceCriteria: [
                'Visible to project members',
                'Version noted',
                'Variables documented'
              ]
            }
          ]
        },
        {
          name: 'Usage',
          description: 'Meter seats and enforce limits.',
          stories: [
            {
              title: 'Enforce soft limit',
              description: 'As Avery, members see warnings near quota.',
              acceptanceCriteria: [
                'Warning at 80%',
                'Hard block at 100% if configured',
                'Admin can raise limit'
              ]
            }
          ]
        }
      ],
      nonGoals: [
        'Fine-tuning custom models v1',
        'On-prem LLM hosting',
        'Full CMS for content teams',
        'Agentic multi-day autonomous runs'
      ],
      successMetrics: {
        northStar: 'Weekly workflows completed per active seat',
        leading: ['Template reuse rate', 'Export rate', 'Seat utilization']
      },
      permissionsMatrix: [
        { role: 'Owner', permissions: ['billing', 'limits', 'invite', 'all projects'] },
        { role: 'Member', permissions: ['run', 'save templates', 'export own'] },
        { role: 'Viewer', permissions: ['read history', 'no run'] }
      ],
      glossary: [
        { term: 'Run', definition: 'A single workflow execution with inputs and output.' },
        { term: 'Template', definition: 'A reusable prompt with variables.' },
        { term: 'Usage budget', definition: 'Seat or workspace token/run allowance.' }
      ],
      suggestionsIdeaSummary: { toInclude: [], notToInclude: ['Governance angle', 'Template reuse'] },
      suggestionsCoreFeatures: { toInclude: [], notToInclude: ['Usage metering', 'Roles'] },
      inferredItems: ['[INFERRED] Provider fallback from reliability needs']
    },
    mermaidTweaks: [
      ['MAILBOX', 'PROJECT'],
      ['THREAD', 'RUN'],
      ['MACRO', 'TEMPLATE'],
      ['Inbound email', 'Model response'],
      ['Email Worker', 'AI Worker'],
      ['Mail Provider', 'LLM Provider']
    ],
    designColors: {
      primary: '#4F46E5',
      secondary: '#312E81',
      accent: '#06B6D4',
      background: '#EEF2FF',
      text: '#1E1B4B',
      success: '#059669',
      warning: '#F59E0B',
      danger: '#DC2626',
      muted: '#6366F1',
      surface: '#FFFFFF',
      border: '#C7D2FE'
    },
    competitors: [
      {
        name: 'ChatGPT Team',
        advantages: 'Model quality and brand',
        disadvantages: 'Weak workflow governance for ops',
        strengths: 'Models',
        weaknesses: 'Team prompt ops',
        differentiators: 'General chat',
        marketPosition: 'Consumer+team AI',
        features: ['chat', 'sharing'],
        gaps: ['metered workflows'],
        marketShare: 'Dominant',
        pricingSummary: 'Per seat',
        featureGapVsUs: ['Workflow templates', 'Usage budgets']
      },
      {
        name: 'Notion AI',
        advantages: 'Docs context',
        disadvantages: 'Not a dedicated prompt ops product',
        strengths: 'Workspace',
        weaknesses: 'Run metering',
        differentiators: 'Docs-native',
        marketPosition: 'Knowledge work',
        features: ['AI in docs'],
        gaps: ['exportable run history'],
        marketShare: 'High in Notion',
        pricingSummary: 'Add-on',
        featureGapVsUs: ['Dedicated run history', 'Admin limits']
      }
    ],
    promptStages: [
      {
        name: 'PROJECT SETUP & BASIC STRUCTURE',
        goal: 'Scaffold PromptForge web/API with auth shell.',
        nonGoals: ['Live LLM calls', 'Billing'],
        filesCreate: ['apps/web/package.json', 'apps/api/src/index.ts', 'packages/shared/src/types.ts'],
        filesModify: ['Root package.json workspaces'],
        ac: ['Health 200', 'Projects shell', 'Admin shell'],
        commands: 'pnpm install\npnpm --filter api dev\npnpm --filter web dev',
        dod: ['README', 'CI lint'],
        pitfalls: ['API keys server-only'],
        build: '1.1 Workspaces\n1.2 Health\n1.3 Shells',
        review: '- No key in web',
        tests: '- Health'
      },
      {
        name: 'RUN WORKSPACE',
        goal: 'Template run against mocked model with history write.',
        nonGoals: ['Streaming v2 polish', 'Fine-tunes'],
        filesCreate: ['apps/api/src/routes/runs.ts', 'apps/web/src/pages/RunWorkspace.tsx'],
        filesModify: ['packages/shared/src/types.ts'],
        ac: ['Run stored', 'Usage increment', 'Error path shown'],
        commands: 'pnpm --filter api test\npnpm --filter web test -- RunWorkspace',
        dod: ['History list shows run'],
        pitfalls: ['Never log raw API keys'],
        build: '2.1 Run model\n2.2 Mock provider\n2.3 UI',
        review: '- Redaction',
        tests: '- Usage increment'
      }
    ],
    answers: [
      'An AI SaaS workspace where teams run guided workflows with saved prompts, usage limits, and shared projects.',
      'User signs up → creates a project → runs a workflow → reviews output → saves or exports; admins manage seats and billing.',
      'Auth, usage metering, prompt templates, export, and team roles (owner, member).'
    ]
  },
  {
    id: 'social',
    templateId: 'social',
    title: 'Trailfeed',
    category: 'Social Network',
    icon: 'fa-users',
    shortDesc: 'Feed, profiles, follows, and notifications for a niche community.',
    demoAnchor: 'market',
    replacePairs: [
      ['RelayDesk', 'Trailfeed'],
      ['relaydesk', 'trailfeed'],
      ['shared support inbox', 'niche social network'],
      ['support inbox', 'community feed'],
      ['indie SaaS', 'outdoor community'],
      ['Thread', 'Post'],
      ['thread', 'post'],
      ['Macro', 'Composer template'],
      ['Mailbox', 'Feed'],
      ['SLA lite', 'Notification SLA'],
      ['Founder or Agent', 'Member or Moderator']
    ],
    overview: {
      shortTitle: 'Trailfeed Niche Social',
      ideaSummary:
        'Trailfeed is a niche social network for outdoor enthusiasts with profiles, follows, a ranked feed, media posts, and notifications.',
      problemStatement:
        'General social apps bury niche outdoor content in noise and ads. Communities want follows, media posts, and moderation without building from scratch.',
      targetAudience: {
        ageRange: '18-45 outdoor hobbyists',
        sector: 'Consumer social / niche community',
        interests: ['hiking', 'community', 'photo posts', 'local trails'],
        needs: ['profiles', 'follows', 'feed', 'media upload', 'notifications', 'report/block']
      },
      valueProposition:
        'Trailfeed gives outdoor communities a focused feed, follows, and notifications—without general-purpose social noise.',
      coreFeaturesOverview: [
        'Profiles and follows',
        'Chronological or ranked feed',
        'Posts with media',
        'Likes and comments',
        'Push/email notifications',
        'Report and block'
      ],
      userJourneySummary:
        'User creates a profile, follows people or topics, posts updates, engages via likes/comments, and gets notified on activity.',
      detailedUserFlow: {
        steps: [
          'Step 1: Sign up and set profile.',
          'Step 2: Follow people or topics.',
          'Step 3: Post with optional media.',
          'Step 4: Engage on feed.',
          'Step 5: Receive notifications; report if needed.'
        ]
      },
      screenDescriptions: {
        screens: [
          {
            name: 'Feed',
            description: 'Ranked or chrono posts.',
            uiComponents: ['Post cards', 'Composer', 'Rank toggle'],
            emptyState: 'Follow people to fill your feed.',
            errorState: 'Feed failed to load.',
            edgeCases: ['Muted authors']
          },
          {
            name: 'Profile',
            description: 'Bio, posts grid, follow button.',
            uiComponents: ['Avatar', 'Follow CTA', 'Grid'],
            emptyState: 'No posts yet.',
            errorState: 'Profile unavailable.',
            edgeCases: ['Blocked viewer']
          },
          {
            name: 'Notifications',
            description: 'Likes, comments, follows.',
            uiComponents: ['Notif list', 'Mark read'],
            emptyState: 'You are all caught up.',
            errorState: 'Notifications unavailable.',
            edgeCases: ['Burst fanout']
          },
          {
            name: 'Composer',
            description: 'Create post with media.',
            uiComponents: ['Text area', 'Upload', 'Post CTA'],
            emptyState: null,
            errorState: 'Upload failed—retry.',
            edgeCases: ['Large image rejected']
          }
        ],
        navigationStructure: 'Tab bar: Feed, Search, Compose, Notifications, Profile.'
      },
      complexityScore: { architecture: 78, integrations: 40, functionality: 65, userSystem: 70 },
      personas: [
        {
          name: 'Chris',
          role: 'Weekend hiker',
          goals: ['Share trips', 'Find local tips'],
          pains: ['IG algorithm noise', 'Hard to find niche peers'],
          jtbd: 'When I finish a trail, I want a community that cares about the route.'
        },
        {
          name: 'Taylor',
          role: 'Community moderator',
          goals: ['Keep spam out', 'Help new members'],
          pains: ['Weak report tools'],
          jtbd: 'When spam appears, I want report/block with a clear queue.'
        },
        {
          name: 'Jamie',
          role: 'Creator',
          goals: ['Grow followers', 'Post media reliably'],
          pains: ['Upload failures', 'No analytics lite'],
          jtbd: 'When I post a reel-like clip, I want reliable upload and reach in-feed.'
        }
      ],
      epics: [
        {
          name: 'Feed',
          description: 'Follow graph and feed ranking basics.',
          stories: [
            {
              title: 'View feed',
              description: 'As Chris, I see posts from people I follow.',
              acceptanceCriteria: [
                'Followed authors appear',
                'Blocked authors hidden',
                'Empty state when no follows'
              ]
            }
          ]
        },
        {
          name: 'Posts',
          description: 'Create posts with media.',
          stories: [
            {
              title: 'Create post',
              description: 'As Jamie, I publish a post with an image.',
              acceptanceCriteria: [
                'Image size limits enforced',
                'Post appears on profile and followers feed',
                'Failed upload keeps draft'
              ]
            }
          ]
        },
        {
          name: 'Safety',
          description: 'Report and block.',
          stories: [
            {
              title: 'Block user',
              description: 'As Chris, I block another user.',
              acceptanceCriteria: [
                'Their posts hidden',
                'They cannot comment on mine',
                'Block is reversible in settings'
              ]
            }
          ]
        }
      ],
      nonGoals: [
        'Global ads marketplace',
        'Live video at scale v1',
        'Crypto tips',
        'Dating features'
      ],
      successMetrics: {
        northStar: 'Weekly active posters in the niche community',
        leading: ['Follows per new user', 'Posts with media ratio', 'Report resolution time']
      },
      permissionsMatrix: [
        { role: 'Member', permissions: ['post', 'follow', 'comment', 'report'] },
        { role: 'Moderator', permissions: ['review reports', 'remove posts'] },
        { role: 'Admin', permissions: ['ban', 'feature flags'] }
      ],
      glossary: [
        { term: 'Feed', definition: 'Ordered stream of posts for a member.' },
        { term: 'Follow', definition: 'Subscription to another member’s posts.' },
        { term: 'Report', definition: 'Safety flag sent to moderators.' }
      ],
      suggestionsIdeaSummary: { toInclude: [], notToInclude: ['Niche focus', 'Safety basics'] },
      suggestionsCoreFeatures: { toInclude: [], notToInclude: ['Report/block', 'Media upload'] },
      inferredItems: ['[INFERRED] Rank toggle from feed needs']
    },
    mermaidTweaks: [
      ['MAILBOX', 'FEED'],
      ['THREAD', 'POST'],
      ['MACRO', 'COMPOSER'],
      ['Inbound email', 'Fanout event'],
      ['Email Worker', 'Feed Worker'],
      ['Mail Provider', 'Push Provider']
    ],
    designColors: {
      primary: '#166534',
      secondary: '#14532D',
      accent: '#EA580C',
      background: '#F7FEE7',
      text: '#14532D',
      success: '#15803D',
      warning: '#CA8A04',
      danger: '#B91C1C',
      muted: '#4D7C0F',
      surface: '#FFFFFF',
      border: '#D9F99D'
    },
    competitors: [
      {
        name: 'Instagram',
        advantages: 'Distribution and polish',
        disadvantages: 'Algorithmic noise for niches',
        strengths: 'Media',
        weaknesses: 'Niche signal',
        differentiators: 'General social',
        marketPosition: 'Mass social',
        features: ['feed', 'media'],
        gaps: ['niche community tools'],
        marketShare: 'Dominant',
        pricingSummary: 'Ads',
        featureGapVsUs: ['Niche ranking', 'Moderator queue']
      },
      {
        name: 'AllTrails',
        advantages: 'Trail data brand',
        disadvantages: 'Not a general social graph',
        strengths: 'Maps/data',
        weaknesses: 'Social depth',
        differentiators: 'Trail database',
        marketPosition: 'Outdoor utility',
        features: ['trails', 'reviews'],
        gaps: ['follow feed'],
        marketShare: 'Strong outdoor',
        pricingSummary: 'Freemium',
        featureGapVsUs: ['Social follows', 'Media-first feed']
      }
    ],
    promptStages: [
      {
        name: 'PROJECT SETUP & BASIC STRUCTURE',
        goal: 'Scaffold Trailfeed web/API with feed shell.',
        nonGoals: ['Push provider live', 'Rank ML'],
        filesCreate: ['apps/web/package.json', 'apps/api/src/index.ts', 'packages/shared/src/types.ts'],
        filesModify: ['Root package.json workspaces'],
        ac: ['Health 200', 'Feed shell', 'Profile shell'],
        commands: 'pnpm install\npnpm --filter api dev\npnpm --filter web dev',
        dod: ['README', 'CI lint'],
        pitfalls: ['Media URLs signed'],
        build: '1.1 Workspaces\n1.2 Health\n1.3 Shells',
        review: '- No secrets in web',
        tests: '- Health'
      },
      {
        name: 'FEED & POSTS',
        goal: 'Post create and follow-based feed list.',
        nonGoals: ['Ranking ML', 'Live video'],
        filesCreate: ['apps/api/src/routes/posts.ts', 'apps/api/src/routes/feed.ts', 'apps/web/src/pages/FeedPage.tsx'],
        filesModify: ['packages/shared/src/types.ts'],
        ac: ['Create post', 'Feed shows follows', 'Empty state'],
        commands: 'pnpm --filter api test\npnpm --filter web test -- FeedPage',
        dod: ['Block hides posts'],
        pitfalls: ['N+1 feed query'],
        build: '2.1 Post model\n2.2 Follow graph\n2.3 Feed UI',
        review: '- Pagination',
        tests: '- Block filter'
      }
    ],
    answers: [
      'A niche social network with profiles, follows, a chronological or ranked feed, posts with media, and notifications.',
      'User creates a profile → follows people or topics → posts updates → engages → gets notified.',
      'Feed ranking basics, media upload, report/block, and push/email notifications.'
    ]
  }
];

function applyProduct(gold, product) {
  if (product.useGoldAsIs) {
    const spec = deepClone(gold);
    spec.meta = {
      product: product.title,
      category: product.category,
      exampleId: product.id,
      description: 'Public enriched example specification',
      generatedAt: new Date().toISOString(),
      source: 'scripts/build-example-specs.mjs'
    };
    return spec;
  }

  let spec = deepClone(gold);
  spec = replaceIn(spec, product.replacePairs || []);
  if (product.mermaidTweaks) spec = replaceIn(spec, product.mermaidTweaks);

  spec.overview = deepMerge(spec.overview, product.overview);
  if (product.designColors) {
    spec.design.visualStyleGuide.colors = {
      ...spec.design.visualStyleGuide.colors,
      ...product.designColors
    };
    if (spec.design.visualStyleGuide.themes?.light) {
      spec.design.visualStyleGuide.themes.light = {
        ...spec.design.visualStyleGuide.themes.light,
        name: `${product.title} Light`,
        background: product.designColors.background,
        surface: product.designColors.surface,
        text: product.designColors.text,
        primary: product.designColors.primary,
        border: product.designColors.border
      };
    }
    if (spec.design.logoIconography?.appIcon) {
      spec.design.logoIconography.appIcon = {
        ...spec.design.logoIconography.appIcon,
        letters: product.title.slice(0, 2).toUpperCase(),
        bgColor: product.designColors.primary,
        description: `${product.title} app icon`
      };
    }
  }
  if (product.competitors) {
    spec.market.competitiveLandscape = product.competitors;
  }

  const techStack = spec.technical.techStack;
  spec.prompts = {
    generated: true,
    fullPrompt: buildPrompt({
      product: product.title,
      shortTitle: spec.overview.shortTitle,
      ideaSummary: spec.overview.ideaSummary,
      valueProposition: spec.overview.valueProposition,
      techStack,
      stages: product.promptStages
    }),
    contextSummary: `${product.title} enriched example: ${product.category}.`,
    integrationChecklist: spec.prompts.integrationChecklist,
    thirdPartyIntegrations: spec.prompts.thirdPartyIntegrations
  };

  spec.meta = {
    product: product.title,
    category: product.category,
    exampleId: product.id,
    description: 'Public enriched example specification',
    generatedAt: new Date().toISOString(),
    source: 'scripts/build-example-specs.mjs'
  };

  // Visibility product naming already replaced; refresh FAQ answers lightly
  if (spec.visibility?.aiCitationFaq) {
    spec.visibility.aiCitationFaq = [
      {
        question: `What is ${product.title}?`,
        answer: spec.overview.ideaSummary
      },
      {
        question: `Who is ${product.title} for?`,
        answer: spec.overview.targetAudience.sector
      }
    ];
  }

  return spec;
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function main() {
  const gold = JSON.parse(fs.readFileSync(goldPath, 'utf8'));
  fs.mkdirSync(outBackend, { recursive: true });
  fs.mkdirSync(outAssets, { recursive: true });

  const manifest = {
    generatedAt: new Date().toISOString(),
    defaultExampleId: 'relaydesk',
    examples: []
  };

  for (const product of PRODUCTS) {
    const spec = applyProduct(gold, product);
    writeJson(path.join(outBackend, `${product.id}.json`), spec);
    writeJson(path.join(outAssets, `${product.id}.json`), spec);
    manifest.examples.push({
      id: product.id,
      templateId: product.templateId,
      title: product.title,
      category: product.category,
      icon: product.icon,
      shortDesc: product.shortDesc,
      demoAnchor: product.demoAnchor,
      answers: product.answers,
      path: `/assets/data/example-specs/${product.id}.json`
    });
    console.log(`Wrote ${product.id} (${product.title})`);
  }

  writeJson(path.join(outAssets, 'manifest.json'), manifest);
  writeJson(path.join(outBackend, 'manifest.json'), manifest);
  console.log(`\nManifest: ${manifest.examples.length} examples`);
}

main();
