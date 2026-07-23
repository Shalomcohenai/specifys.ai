/**
 * Zod schemas for spec generation (v2) — full output structure as in legacy system.
 * Used for OpenAI Structured Outputs (strict mode). Every section must be present.
 *
 * Strict-mode rules enforced here:
 *  1. No .optional() — all fields use .nullable() so they appear in the JSON Schema
 *     `required` array. OpenAI strict mode rejects any field not in `required`.
 *  2. No z.record() / z.any() — replaced with explicit objects that have
 *     additionalProperties:false (zodToJsonSchema sets this automatically).
 *  3. No z.union() mixing object with string — DatabaseTableSchema.fields uses
 *     a single object shape so array items have a consistent schema.
 *
 * Enrichment wave (2026-07): personas/stories/AC, richer API contracts, market
 * qualitative GTM, design tokens, ADR objects, visibility paste-ready assets.
 * New fields are nullable where needed so older Firestore specs still render
 * via UI fallbacks (missing keys are simply skipped).
 *
 * @see docs/architecture/ARCHITECTURE.md
 */

const { z } = require('zod');

// ─────────────────────────────────────────────────────────────────────────────
// Overview
// ─────────────────────────────────────────────────────────────────────────────
const OverviewTargetAudienceSchema = z.object({
  ageRange: z.string(),
  sector: z.string(),
  interests: z.array(z.string()),
  needs: z.array(z.string())
});

const OverviewDetailedUserFlowSchema = z.object({
  // minItems enforced so structured output cannot legally return an empty journey
  steps: z.array(z.string().min(1)).min(3)
});

const OverviewScreenSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  uiComponents: z.array(z.string().min(1)).min(1),
  emptyState: z.string().nullable(),
  errorState: z.string().nullable(),
  edgeCases: z.array(z.string()).nullable()
});

const OverviewScreenDescriptionsSchema = z.object({
  // Empty screens[] was previously valid and produced "Screens (0 total)" in the UI
  screens: z.array(OverviewScreenSchema).min(3),
  navigationStructure: z.string().min(1)
});

const OverviewComplexityScoreSchema = z.object({
  architecture: z.number(),
  integrations: z.number(),
  functionality: z.number(),
  userSystem: z.number()
});

const OverviewSuggestionsSchema = z.object({
  toInclude: z.array(z.string()),
  notToInclude: z.array(z.string())
});

const OverviewPersonaSchema = z.object({
  name: z.string(),
  role: z.string(),
  goals: z.array(z.string()),
  pains: z.array(z.string()),
  jtbd: z.string()
});

const OverviewUserStorySchema = z.object({
  title: z.string(),
  description: z.string(),
  acceptanceCriteria: z.array(z.string())
});

const OverviewEpicSchema = z.object({
  name: z.string(),
  description: z.string(),
  stories: z.array(OverviewUserStorySchema)
});

const OverviewSuccessMetricsSchema = z.object({
  northStar: z.string(),
  leading: z.array(z.string())
});

const OverviewPermissionRowSchema = z.object({
  role: z.string(),
  permissions: z.array(z.string())
});

const OverviewGlossaryEntrySchema = z.object({
  term: z.string(),
  definition: z.string()
});

const OverviewSchema = z.object({
  shortTitle: z.string(),
  ideaSummary: z.string(),
  problemStatement: z.string(),
  targetAudience: OverviewTargetAudienceSchema,
  valueProposition: z.string(),
  // Empty coreFeaturesOverview was previously valid and rendered a blank section
  coreFeaturesOverview: z.array(z.string().min(1)).min(3),
  userJourneySummary: z.string(),
  detailedUserFlow: OverviewDetailedUserFlowSchema,
  screenDescriptions: OverviewScreenDescriptionsSchema,
  complexityScore: OverviewComplexityScoreSchema,
  suggestionsIdeaSummary: OverviewSuggestionsSchema,
  suggestionsCoreFeatures: OverviewSuggestionsSchema,
  inferredItems: z.array(z.string()).nullable(),
  personas: z.array(OverviewPersonaSchema).nullable(),
  epics: z.array(OverviewEpicSchema).nullable(),
  nonGoals: z.array(z.string()).nullable(),
  successMetrics: OverviewSuccessMetricsSchema.nullable(),
  permissionsMatrix: z.array(OverviewPermissionRowSchema).nullable(),
  glossary: z.array(OverviewGlossaryEntrySchema).nullable()
});

const OverviewPayloadSchema = z.object({ overview: OverviewSchema });

// ─────────────────────────────────────────────────────────────────────────────
// Technical
// ─────────────────────────────────────────────────────────────────────────────
const TechStackSchema = z.object({
  frontend: z.string(),
  backend: z.string(),
  database: z.string(),
  storage: z.string(),
  authentication: z.string()
});

const DatabaseTableFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean().nullable(),
  constraints: z.string().nullable(),
  description: z.string().nullable()
});

const DatabaseTableSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  fields: z.array(DatabaseTableFieldSchema),
  relationships: z.string()
});

/** Legacy shape (pre–diagram-embedded v2); kept for docs/tests referencing table lists */
const DatabaseSchemaSchema = z.object({
  description: z.string(),
  tables: z.array(DatabaseTableSchema),
  relationships: z.string().nullable()
});

const ApiEndpointSchema = z.object({
  path: z.string(),
  method: z.string(),
  description: z.string(),
  parameters: z.string().nullable(),
  requestBody: z.string(),
  responseBody: z.string(),
  statusCodes: z.string().nullable(),
  errorResponses: z.string().nullable(),
  authScope: z.string().nullable(),
  rateLimit: z.string().nullable(),
  idempotency: z.string().nullable()
});

const SecurityAuthenticationSchema = z.object({
  authentication: z.string(),
  authorization: z.string(),
  encryption: z.string().nullable(),
  securityMeasures: z.string(),
  securityCriticalPoints: z.array(z.string()),
  authFlowDiagramMermaid: z.string().nullable()
});

const IntegrationExternalApisSchema = z.object({
  thirdPartyServices: z.array(z.string()),
  integrations: z.string(),
  dataFlow: z.string(),
  integrationLandscapeDiagramMermaid: z.string().nullable()
});

const DevOpsSchema = z.object({
  deploymentStrategy: z.string(),
  infrastructure: z.string(),
  monitoring: z.string(),
  scaling: z.string(),
  backup: z.string(),
  automation: z.string(),
  cicdPipelineDiagramMermaid: z.string().nullable()
});

const DataStorageSchema = z.object({
  storageStrategy: z.string(),
  dataRetention: z.string(),
  dataBackup: z.string(),
  storageArchitecture: z.string()
});

const AnalyticsSchema = z.object({
  analyticsStrategy: z.string(),
  trackingMethods: z.string(),
  analysisTools: z.string(),
  reporting: z.string()
});

const TechnicalArchitectureOverviewBlockSchema = z.object({
  narrative: z.string(),
  systemContextDiagramMermaid: z.string().nullable()
});

const TechnicalDatabaseSchemaBlockSchema = z.object({
  description: z.string(),
  erDiagramMermaid: z.string(),
  tablesSupplement: z.array(DatabaseTableSchema).nullable()
});

const TechnicalApiDesignSchema = z.object({
  endpointsOverviewDiagramMermaid: z.string().nullable(),
  endpoints: z.array(ApiEndpointSchema)
});

const TechnicalDataFlowBlockSchema = z.object({
  narrative: z.string(),
  diagramMermaid: z.string().nullable()
});

const TechnicalEventSchema = z.object({
  name: z.string(),
  description: z.string(),
  payloadSummary: z.string(),
  consumers: z.array(z.string()),
  deliveryGuarantees: z.string().nullable()
});

const TechnicalEnvSecretSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  required: z.boolean(),
  exampleHint: z.string().nullable()
});

const TechnicalPerformanceBudgetsSchema = z.object({
  lcpMs: z.number().nullable(),
  inpMs: z.number().nullable(),
  cls: z.number().nullable(),
  apiP95Ms: z.number().nullable(),
  notes: z.string().nullable()
});

const TechnicalCostLineSchema = z.object({
  category: z.string(),
  monthlyEstimateUsd: z.number().nullable(),
  notes: z.string()
});

const TechnicalMvpCostModelSchema = z.object({
  monthlyEstimateUsd: z.number().nullable(),
  assumptions: z.string(),
  breakdown: z.array(TechnicalCostLineSchema)
});

const TechnicalTestPlanSchema = z.object({
  unit: z.string(),
  integration: z.string(),
  e2e: z.string(),
  load: z.string().nullable(),
  security: z.string().nullable()
});

const TechnicalSchema = z.object({
  techStack: TechStackSchema,
  architectureOverview: TechnicalArchitectureOverviewBlockSchema,
  databaseSchema: TechnicalDatabaseSchemaBlockSchema,
  apiDesign: TechnicalApiDesignSchema,
  dataFlow: TechnicalDataFlowBlockSchema,
  securityAuthentication: SecurityAuthenticationSchema,
  integrationExternalApis: IntegrationExternalApisSchema,
  devops: DevOpsSchema,
  dataStorage: DataStorageSchema,
  analytics: AnalyticsSchema,
  eventCatalog: z.array(TechnicalEventSchema).nullable(),
  envSecrets: z.array(TechnicalEnvSecretSchema).nullable(),
  migrationAndSeed: z.string().nullable(),
  performanceBudgets: TechnicalPerformanceBudgetsSchema.nullable(),
  mvpCostModel: TechnicalMvpCostModelSchema.nullable(),
  testPlan: TechnicalTestPlanSchema.nullable()
});

const TechnicalPayloadSchema = z.object({ technical: TechnicalSchema });

// ─────────────────────────────────────────────────────────────────────────────
// Market
// ─────────────────────────────────────────────────────────────────────────────
const AudienceSegmentSchema = z.object({
  description: z.string(),
  ageRange: z.string().nullable(),
  occupation: z.string().nullable(),
  goals: z.string().nullable(),
  painPoints: z.string().nullable()
});

const MarketCompetitorSchema = z.object({
  name: z.string(),
  advantages: z.string(),
  disadvantages: z.string(),
  strengths: z.string().nullable(),
  weaknesses: z.string().nullable(),
  differentiators: z.string().nullable(),
  marketPosition: z.string().nullable(),
  features: z.array(z.string()).nullable(),
  gaps: z.array(z.string()).nullable(),
  marketShare: z.string().nullable(),
  pricingSummary: z.string().nullable(),
  featureGapVsUs: z.array(z.string()).nullable()
});

const MarketIcpCriterionSchema = z.object({
  criterion: z.string(),
  weight: z.number().nullable(),
  score: z.number().nullable(),
  notes: z.string().nullable()
});

const MarketGtmPhaseSchema = z.object({
  days: z.string(),
  goals: z.array(z.string()),
  tactics: z.array(z.string()),
  successSignals: z.array(z.string()).nullable()
});

const MarketInterviewScriptSchema = z.object({
  audience: z.string(),
  objective: z.string(),
  questions: z.array(z.string())
});

const MarketSearchTrendSchema = z.object({
  topic: z.string(),
  direction: z.string(),
  confidence: z.string(),
  notes: z.string().nullable()
});

const MarketSchema = z.object({
  industryOverview: z.object({
    trends: z.string(),
    marketData: z.string(),
    growthProjections: z.string().nullable(),
    growthPotential: z.string().nullable(),
    estimateDisclaimer: z.string().nullable()
  }),
  targetAudienceInsights: z.object({
    primaryAudience: AudienceSegmentSchema,
    secondaryAudience: AudienceSegmentSchema,
    needsAnalysis: z.string().nullable(),
    usageHabits: z.string().nullable(),
    demographics: z.string().nullable()
  }),
  competitiveLandscape: z.array(MarketCompetitorSchema),
  swotAnalysis: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    opportunities: z.array(z.string()),
    threats: z.array(z.string())
  }),
  monetizationModel: z.object({
    pricingStrategy: z.string().nullable(),
    revenueStreams: z.string().nullable(),
    rationale: z.string().nullable(),
    proposedModels: z.array(z.string()).nullable(),
    recommendations: z.string().nullable(),
    methodology: z.string().nullable()
  }),
  marketingStrategy: z.object({
    channels: z.string().nullable(),
    messaging: z.string().nullable(),
    goToMarket: z.string().nullable()
  }),
  icpScorecard: z.array(MarketIcpCriterionSchema).nullable(),
  disqualificationCriteria: z.array(z.string()).nullable(),
  gtmPlan: z.array(MarketGtmPhaseSchema).nullable(),
  interviewScripts: z.array(MarketInterviewScriptSchema).nullable(),
  positioningOnePager: z.string().nullable(),
  searchTrends: z.array(MarketSearchTrendSchema).nullable()
});

const MarketPayloadSchema = z.object({ market: MarketSchema });

// ─────────────────────────────────────────────────────────────────────────────
// Design — tokens, themes, components, motion, microcopy
// ─────────────────────────────────────────────────────────────────────────────
const VisualStyleGuideColorsSchema = z.object({
  primary: z.string(),
  secondary: z.string(),
  accent: z.string(),
  background: z.string(),
  text: z.string(),
  success: z.string().nullable(),
  warning: z.string().nullable(),
  danger: z.string().nullable(),
  muted: z.string().nullable(),
  surface: z.string().nullable(),
  border: z.string().nullable()
});

const DesignTypeStyleSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.string(),
  fontWeight: z.string(),
  lineHeight: z.string(),
  letterSpacing: z.string().nullable()
});

const VisualStyleGuideTypographySchema = z.object({
  headings: z.string(),
  body: z.string(),
  captions: z.string(),
  display: DesignTypeStyleSchema.nullable(),
  h1: DesignTypeStyleSchema.nullable(),
  h2: DesignTypeStyleSchema.nullable(),
  h3: DesignTypeStyleSchema.nullable(),
  bodyLg: DesignTypeStyleSchema.nullable(),
  bodyMd: DesignTypeStyleSchema.nullable(),
  bodySm: DesignTypeStyleSchema.nullable(),
  label: DesignTypeStyleSchema.nullable()
});

const DesignSpacingScaleSchema = z.object({
  xs: z.string(),
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  xxl: z.string().nullable()
});

const DesignRadiiScaleSchema = z.object({
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  full: z.string().nullable()
});

const DesignShadowScaleSchema = z.object({
  sm: z.string(),
  md: z.string(),
  lg: z.string().nullable()
});

const DesignZIndexScaleSchema = z.object({
  base: z.number(),
  dropdown: z.number(),
  sticky: z.number(),
  modal: z.number(),
  toast: z.number().nullable()
});

const DesignThemeSchema = z.object({
  name: z.string(),
  background: z.string(),
  surface: z.string(),
  text: z.string(),
  textMuted: z.string().nullable(),
  primary: z.string(),
  border: z.string().nullable()
});

const VisualStyleGuideSchema = z.object({
  colors: VisualStyleGuideColorsSchema,
  colorHarmony: z.string(),
  colorReasoning: z.string(),
  typography: VisualStyleGuideTypographySchema,
  spacing: z.string(),
  buttons: z.string(),
  animations: z.string(),
  spacingScale: DesignSpacingScaleSchema.nullable(),
  radiiScale: DesignRadiiScaleSchema.nullable(),
  shadowScale: DesignShadowScaleSchema.nullable(),
  zIndexScale: DesignZIndexScaleSchema.nullable(),
  themes: z.object({
    light: DesignThemeSchema,
    dark: DesignThemeSchema.nullable()
  }).nullable()
});

const AppIconSchema = z.object({
  letters: z.string(),
  bgColor: z.string(),
  description: z.string()
});

const LogoIconographySchema = z.object({
  logoConcepts: z.string(),
  colorVersions: z.string(),
  iconSet: z.string(),
  appIcon: AppIconSchema
});

const UiLayoutSchema = z.object({
  landingPage: z.string(),
  dashboard: z.string(),
  navigation: z.string(),
  responsiveDesign: z.string()
});

const UxPrinciplesSchema = z.object({
  userFlow: z.string(),
  accessibility: z.string(),
  informationHierarchy: z.string()
});

const DesignComponentSchema = z.object({
  name: z.string(),
  variants: z.array(z.string()),
  states: z.array(z.string()),
  a11yChecklist: z.array(z.string()),
  usageNotes: z.string().nullable()
});

const DesignScreenLayoutSchema = z.object({
  screenName: z.string(),
  layout: z.string(),
  empty: z.string().nullable(),
  loading: z.string().nullable(),
  error: z.string().nullable(),
  success: z.string().nullable()
});

const DesignMotionSpecSchema = z.object({
  name: z.string(),
  trigger: z.string(),
  durationMs: z.number().nullable(),
  easing: z.string().nullable(),
  notes: z.string().nullable()
});

const DesignSchema = z.object({
  visualStyleGuide: VisualStyleGuideSchema,
  logoIconography: LogoIconographySchema,
  uiLayout: UiLayoutSchema,
  uxPrinciples: UxPrinciplesSchema,
  componentInventory: z.array(DesignComponentSchema).nullable(),
  screenLayouts: z.array(DesignScreenLayoutSchema).nullable(),
  motionSpecs: z.array(DesignMotionSpecSchema).nullable(),
  toneOfVoice: z.string().nullable(),
  microcopy: z.array(z.object({
    context: z.string(),
    copy: z.string()
  })).nullable(),
  tokenExport: z.object({
    cssVariables: z.string(),
    jsonTokens: z.string()
  }).nullable()
});

const DesignPayloadSchema = z.object({ design: DesignSchema });

// ─────────────────────────────────────────────────────────────────────────────
// Architecture (structured; serialized to Markdown for storage)
// ─────────────────────────────────────────────────────────────────────────────
const ArchitectureNarrativeDiagramSchema = z.object({
  narrative: z.string(),
  diagramMermaid: z.string().nullable()
});

const ArchitectureCoreFlowsSchema = z.object({
  narrative: z.string(),
  primarySequenceDiagramMermaid: z.string().nullable()
});

const ArchitectureAdrSchema = z.object({
  title: z.string(),
  context: z.string(),
  options: z.array(z.string()),
  decision: z.string(),
  consequences: z.array(z.string()),
  revisitWhen: z.string()
});

const ArchitectureSloSchema = z.object({
  name: z.string(),
  sli: z.string(),
  target: z.string(),
  window: z.string().nullable()
});

const ArchitectureDataClassSchema = z.object({
  name: z.string(),
  classification: z.string(),
  handling: z.string()
});

const ArchitectureFailureModeSchema = z.object({
  failure: z.string(),
  impact: z.string(),
  detection: z.string(),
  runbook: z.string()
});

const ArchitectureThreatSchema = z.object({
  threat: z.string(),
  severity: z.string(),
  mitigation: z.string()
});

const ArchitectureSchema = z.object({
  executiveSummary: z.string(),
  systemBoundaries: z.string(),
  logicalSystemArchitecture: ArchitectureNarrativeDiagramSchema,
  informationArchitecture: ArchitectureNarrativeDiagramSchema,
  functionalArchitecture: ArchitectureNarrativeDiagramSchema,
  repositoryStructure: z.string(),
  coreFlows: ArchitectureCoreFlowsSchema,
  integrationLandscape: ArchitectureNarrativeDiagramSchema,
  deploymentTopology: ArchitectureNarrativeDiagramSchema,
  nonFunctionalQuality: z.string(),
  observabilityOperability: z.string(),
  securityArchitectureDeepDive: z.string(),
  architectureDecisionLog: z.string(),
  risksAndOpenDecisions: z.string(),
  contextDiagramMermaid: z.string().nullable(),
  containerDiagramMermaid: z.string().nullable(),
  adrs: z.array(ArchitectureAdrSchema).nullable(),
  threatModel: z.array(ArchitectureThreatSchema).nullable(),
  sloSli: z.array(ArchitectureSloSchema).nullable(),
  dataClassification: z.array(ArchitectureDataClassSchema).nullable(),
  failureModes: z.array(ArchitectureFailureModeSchema).nullable(),
  repoToPromptsMap: z.string().nullable()
});

const ArchitecturePayloadSchema = z.object({ architecture: ArchitectureSchema });

// ─────────────────────────────────────────────────────────────────────────────
// Visibility (GEO & SEO)
// ─────────────────────────────────────────────────────────────────────────────
const VisibilityContentBriefSchema = z.object({
  title: z.string(),
  intent: z.string(),
  outline: z.array(z.string()),
  cta: z.string().nullable()
});

const VisibilityCalendarItemSchema = z.object({
  week: z.string(),
  channel: z.string(),
  topic: z.string(),
  status: z.string().nullable()
});

const VisibilityProgrammaticUrlSchema = z.object({
  pattern: z.string(),
  sampleUrls: z.array(z.string()),
  notes: z.string().nullable()
});

const VisibilityFaqSchema = z.object({
  question: z.string(),
  answer: z.string()
});

const VisibilitySchema = z.object({
  strategySummary: z.string(),
  seoFoundation: z.object({
    positioning: z.string(),
    pillarTopics: z.array(z.string()),
    targetIntents: z.array(z.string())
  }),
  geoReadiness: z.object({
    llmsTxt: z.string(),
    aiInfoTxt: z.string(),
    schemaGuidance: z.string(),
    jsonLd: z.string().nullable(),
    metaTemplates: z.object({
      titleTemplate: z.string(),
      descriptionTemplate: z.string(),
      ogNotes: z.string().nullable()
    }).nullable()
  }),
  contentEngine: z.object({
    editorialTracks: z.array(z.string()),
    publishingCadence: z.string(),
    authoritySignals: z.array(z.string()),
    contentCalendar: z.array(VisibilityCalendarItemSchema).nullable(),
    contentBriefs: z.array(VisibilityContentBriefSchema).nullable()
  }),
  programmaticSeo: z.object({
    templateFamilies: z.array(z.string()),
    dataRequirements: z.array(z.string()),
    qualityGuardrails: z.array(z.string()),
    sampleUrlSets: z.array(VisibilityProgrammaticUrlSchema).nullable()
  }),
  launchChecklist: z.array(z.string()),
  aiCitationFaq: z.array(VisibilityFaqSchema).nullable(),
  technicalSeoChecklist: z.array(z.string()).nullable()
});

const VisibilityPayloadSchema = z.object({ visibility: VisibilitySchema });

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────
const PromptsSchema = z.object({
  generated: z.boolean(),
  fullPrompt: z.string(),
  contextSummary: z.string(),
  integrationChecklist: z.array(z.string()),
  thirdPartyIntegrations: z.array(z.object({
    service: z.string(),
    description: z.string(),
    instructions: z.array(z.string())
  })).nullable()
});

const PromptsStageOnlySchema = z.object({
  fullPrompt: z.string()
});

const PromptsStageOnlyPayloadSchema = z.object({ prompts: PromptsStageOnlySchema });

const IntegrationsOnlyPayloadSchema = z.object({
  thirdPartyIntegrations: z.array(z.object({
    service: z.string(),
    description: z.string(),
    instructions: z.array(z.string())
  }))
});

const PromptsPayloadSchema = z.object({ prompts: PromptsSchema });

// ─────────────────────────────────────────────────────────────────────────────
// Stage maps
// ─────────────────────────────────────────────────────────────────────────────
const STAGE_PAYLOAD_SCHEMAS = {
  overview: OverviewPayloadSchema,
  technical: TechnicalPayloadSchema,
  market: MarketPayloadSchema,
  design: DesignPayloadSchema,
  architecture: ArchitecturePayloadSchema,
  visibility: VisibilityPayloadSchema,
  prompts: PromptsPayloadSchema,
  'prompt-stage': PromptsStageOnlyPayloadSchema,
  'prompt-integrations': IntegrationsOnlyPayloadSchema
};

const STAGE_ROOT_KEYS = {
  overview: 'overview',
  technical: 'technical',
  market: 'market',
  design: 'design',
  architecture: 'architecture',
  visibility: 'visibility',
  prompts: 'prompts',
  'prompt-stage': 'prompts',
  'prompt-integrations': 'thirdPartyIntegrations'
};

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI response_format builder
// ─────────────────────────────────────────────────────────────────────────────
const { zodToJsonSchema } = require('zod-to-json-schema');
const { logger } = require('../server/logger');

/**
 * Build an OpenAI response_format object for strict structured output.
 *
 * zodToJsonSchema wraps every top-level schema in:
 *   { "$ref": "#/definitions/<name>", "definitions": { "<name>": { type:"object", ... } } }
 * OpenAI rejects this because the root has no `type` field (it sees type:"None").
 * We unwrap the envelope to give OpenAI a clean { type:"object", properties:{...}, ... }.
 *
 * @param {string} stage - overview | technical | market | design | architecture
 * @returns {object} response_format for OpenAI runs.create
 */
function buildResponseFormat(stage) {
  const zodSchema = STAGE_PAYLOAD_SCHEMAS[stage];
  if (!zodSchema) throw new Error(`Unknown stage: ${stage}`);

  const name = `${stage}_response`;
  let jsonSchema = zodToJsonSchema(zodSchema, { name, $refStrategy: 'none' });

  // Unwrap $ref envelope — the real schema is inside definitions[name].
  if (jsonSchema.$ref) {
    const refKey = jsonSchema.$ref
      .replace(/^#\/definitions\//, '')
      .replace(/^#\/\$defs\//, '');
    const defs = jsonSchema.definitions || jsonSchema.$defs || {};
    if (defs[refKey]) jsonSchema = { ...defs[refKey] };
  }

  // Remove JSON Schema meta-fields that OpenAI rejects.
  delete jsonSchema.$schema;
  delete jsonSchema.definitions;
  delete jsonSchema.$defs;

  if (!jsonSchema.type) jsonSchema.type = 'object';

  logger.info({ stage, rootType: jsonSchema.type }, '[buildResponseFormat] Built response_format for OpenAI');

  return {
    type: 'json_schema',
    json_schema: { name, strict: true, schema: jsonSchema }
  };
}

/**
 * Parse and validate an API response for a stage using the Zod schema.
 * Throws ZodError if the structure does not match.
 * @param {string} stage - overview | technical | market | design | architecture
 * @param {object} raw - Parsed JSON from OpenAI response
 * @returns {object} Validated payload (e.g. { overview: {...} })
 */
function parseAndValidateStage(stage, raw) {
  const schema = STAGE_PAYLOAD_SCHEMAS[stage];
  if (!schema) throw new Error(`Unknown stage: ${stage}`);
  return schema.parse(raw);
}

module.exports = {
  OverviewSchema,
  OverviewPayloadSchema,
  TechnicalSchema,
  TechnicalPayloadSchema,
  TechnicalArchitectureOverviewBlockSchema,
  TechnicalDatabaseSchemaBlockSchema,
  TechnicalApiDesignSchema,
  TechnicalDataFlowBlockSchema,
  MarketSchema,
  MarketPayloadSchema,
  DesignSchema,
  DesignPayloadSchema,
  ArchitectureSchema,
  ArchitecturePayloadSchema,
  VisibilitySchema,
  VisibilityPayloadSchema,
  PromptsSchema,
  PromptsPayloadSchema,
  ArchitectureNarrativeDiagramSchema,
  ArchitectureCoreFlowsSchema,
  DatabaseSchemaSchema,
  ApiEndpointSchema,
  STAGE_PAYLOAD_SCHEMAS,
  STAGE_ROOT_KEYS,
  buildResponseFormat,
  parseAndValidateStage
};
