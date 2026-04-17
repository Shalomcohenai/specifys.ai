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
  steps: z.array(z.string())
});

const OverviewScreenSchema = z.object({
  name: z.string(),
  description: z.string(),
  uiComponents: z.array(z.string())
});

const OverviewScreenDescriptionsSchema = z.object({
  screens: z.array(OverviewScreenSchema),
  navigationStructure: z.string()
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

const OverviewSchema = z.object({
  shortTitle: z.string(),
  ideaSummary: z.string(),
  problemStatement: z.string(),
  targetAudience: OverviewTargetAudienceSchema,
  valueProposition: z.string(),
  coreFeaturesOverview: z.array(z.string()),
  userJourneySummary: z.string(),
  detailedUserFlow: OverviewDetailedUserFlowSchema,
  screenDescriptions: OverviewScreenDescriptionsSchema,
  complexityScore: OverviewComplexityScoreSchema,
  suggestionsIdeaSummary: OverviewSuggestionsSchema,
  suggestionsCoreFeatures: OverviewSuggestionsSchema
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

// Fields are always objects — removes the z.union([string, object]) that broke strict mode.
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
  parameters: z.string().nullable(),     // was .optional()
  requestBody: z.string(),
  responseBody: z.string(),
  statusCodes: z.string().nullable()     // was .optional()
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

/** High-level system context: narrative + optional flowchart/graph Mermaid */
const TechnicalArchitectureOverviewBlockSchema = z.object({
  narrative: z.string(),
  systemContextDiagramMermaid: z.string().nullable()
});

/** Primary database representation is erDiagram; optional structured table list for export/search */
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
  analytics: AnalyticsSchema
});

const TechnicalPayloadSchema = z.object({ technical: TechnicalSchema });

// ─────────────────────────────────────────────────────────────────────────────
// Market
// ─────────────────────────────────────────────────────────────────────────────

// Replaced z.record(z.any()) with an explicit object — records generate
// additionalProperties which is forbidden in strict mode.
const AudienceSegmentSchema = z.object({
  description: z.string(),
  ageRange: z.string().nullable(),
  occupation: z.string().nullable(),
  goals: z.string().nullable(),
  painPoints: z.string().nullable()
});

const MarketSchema = z.object({
  industryOverview: z.object({
    trends: z.string(),
    marketData: z.string(),
    growthProjections: z.string().nullable(),  // was .optional()
    growthPotential: z.string().nullable()     // was .optional()
  }),
  targetAudienceInsights: z.object({
    primaryAudience: AudienceSegmentSchema,    // was z.record(z.any()).optional()
    secondaryAudience: AudienceSegmentSchema,  // was z.record(z.any()).optional()
    needsAnalysis: z.string().nullable(),      // was .optional()
    usageHabits: z.string().nullable(),        // was .optional()
    demographics: z.string().nullable()        // was .optional()
  }),
  competitiveLandscape: z.array(z.object({
    name: z.string(),
    advantages: z.string(),
    disadvantages: z.string(),
    strengths: z.string().nullable(),
    weaknesses: z.string().nullable(),
    differentiators: z.string().nullable(),
    marketPosition: z.string().nullable(),
    features: z.array(z.string()).nullable(),
    gaps: z.array(z.string()).nullable(),
    marketShare: z.string().nullable()
  })),
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
    recommendations: z.string().nullable()
  }),
  marketingStrategy: z.object({
    channels: z.string().nullable(),
    messaging: z.string().nullable(),
    goToMarket: z.string().nullable()
  })
});

const MarketPayloadSchema = z.object({ market: MarketSchema });

// ─────────────────────────────────────────────────────────────────────────────
// Design
// z.record() generates open schemas (additionalProperties:true) which strict
// mode forbids. Replaced with explicit objects matching the prompt structure.
// ─────────────────────────────────────────────────────────────────────────────
const VisualStyleGuideSchema = z.object({
  colors: z.string(),
  typography: z.string(),
  spacing: z.string(),
  buttons: z.string(),
  animations: z.string()
});

const LogoIconographySchema = z.object({
  logoConcepts: z.string(),
  colorVersions: z.string(),
  iconSet: z.string(),
  appIcon: z.string()
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

const DesignSchema = z.object({
  visualStyleGuide: VisualStyleGuideSchema,
  logoIconography: LogoIconographySchema,
  uiLayout: UiLayoutSchema,
  uxPrinciples: UxPrinciplesSchema
});

const DesignPayloadSchema = z.object({ design: DesignSchema });

// ─────────────────────────────────────────────────────────────────────────────
// Architecture (structured; serialized to Markdown for storage)
// Narrative + Mermaid per section; raw Mermaid only (no markdown fences inside JSON)
// ─────────────────────────────────────────────────────────────────────────────
const ArchitectureNarrativeDiagramSchema = z.object({
  narrative: z.string(),
  diagramMermaid: z.string().nullable()
});

const ArchitectureCoreFlowsSchema = z.object({
  narrative: z.string(),
  primarySequenceDiagramMermaid: z.string().nullable()
});

const ArchitectureSchema = z.object({
  executiveSummary: z.string(),
  logicalSystemArchitecture: ArchitectureNarrativeDiagramSchema,
  informationArchitecture: ArchitectureNarrativeDiagramSchema,
  functionalArchitecture: ArchitectureNarrativeDiagramSchema,
  coreFlows: ArchitectureCoreFlowsSchema,
  integrationLandscape: ArchitectureNarrativeDiagramSchema,
  nonFunctionalQuality: z.string(),
  risksAndOpenDecisions: z.string()
});

const ArchitecturePayloadSchema = z.object({ architecture: ArchitectureSchema });

// ─────────────────────────────────────────────────────────────────────────────
// Stage maps
// ─────────────────────────────────────────────────────────────────────────────
const STAGE_PAYLOAD_SCHEMAS = {
  overview: OverviewPayloadSchema,
  technical: TechnicalPayloadSchema,
  market: MarketPayloadSchema,
  design: DesignPayloadSchema,
  architecture: ArchitecturePayloadSchema
};

const STAGE_ROOT_KEYS = {
  overview: 'overview',
  technical: 'technical',
  market: 'market',
  design: 'design',
  architecture: 'architecture'
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
  ArchitectureNarrativeDiagramSchema,
  ArchitectureCoreFlowsSchema,
  DatabaseSchemaSchema,
  ApiEndpointSchema,
  STAGE_PAYLOAD_SCHEMAS,
  STAGE_ROOT_KEYS,
  buildResponseFormat,
  parseAndValidateStage
};
