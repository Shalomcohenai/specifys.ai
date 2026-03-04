/**
 * Zod schemas for spec generation (v2) — full output structure as in legacy system.
 * Used for OpenAI Structured Outputs (strict mode). Every section must be present.
 * @see docs/architecture/ARCHITECTURE_REFRESH.md
 */

const { z } = require('zod');

// ---- Overview (same full structure as prompts.js / worker) ----
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

// Wrapper: API returns { overview: { ... } }
const OverviewPayloadSchema = z.object({
  overview: OverviewSchema
});

// ---- Technical (full structure: techStack, databaseSchema, apiEndpoints, devops, etc.) ----
const TechStackSchema = z.object({
  frontend: z.string(),
  backend: z.string(),
  database: z.string(),
  storage: z.string(),
  authentication: z.string()
});

const DatabaseTableSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  fields: z.array(z.union([z.string(), z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean().optional(),
    constraints: z.string().optional(),
    description: z.string().optional()
  })])),
  relationships: z.string()
});

const DatabaseSchemaSchema = z.object({
  description: z.string(),
  tables: z.array(DatabaseTableSchema),
  relationships: z.string().optional()
});

const ApiEndpointSchema = z.object({
  path: z.string(),
  method: z.string(),
  description: z.string(),
  parameters: z.string().optional(),
  requestBody: z.string(),
  responseBody: z.string(),
  statusCodes: z.string().optional()
});

const SecurityAuthenticationSchema = z.object({
  authentication: z.string(),
  authorization: z.string(),
  encryption: z.string().optional(),
  securityMeasures: z.string(),
  securityCriticalPoints: z.array(z.string()).min(3)
});

const IntegrationExternalApisSchema = z.object({
  thirdPartyServices: z.array(z.string()),
  integrations: z.string(),
  dataFlow: z.string()
});

const DevOpsSchema = z.object({
  deploymentStrategy: z.string(),
  infrastructure: z.string(),
  monitoring: z.string(),
  scaling: z.string(),
  backup: z.string(),
  automation: z.string()
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

const DetailedDataModelFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  required: z.boolean().optional(),
  constraints: z.string().optional(),
  description: z.string().optional()
});

const DetailedDataModelSchema = z.object({
  name: z.string(),
  purpose: z.string(),
  fields: z.array(DetailedDataModelFieldSchema),
  relationships: z.string().optional(),
  validationRules: z.string().optional(),
  indexes: z.string().optional(),
  sampleData: z.string().optional()
});

const DetailedDataModelsSchema = z.object({
  models: z.array(DetailedDataModelSchema),
  overallStructure: z.string().optional(),
  totalModelsCount: z.string().optional(),
  crudOperations: z.string().optional()
});

const DataFlowDetailedSchema = z.object({
  authenticationFlow: z.string().optional(),
  dataSubmissionFlow: z.string().optional(),
  queryPatterns: z.string().optional(),
  cachingStrategy: z.string().optional(),
  errorScenarios: z.string().optional(),
  dataValidation: z.string().optional(),
  transactionFlow: z.string().optional()
});

const TechnicalSchema = z.object({
  techStack: TechStackSchema,
  architectureOverview: z.string(),
  databaseSchema: DatabaseSchemaSchema,
  apiEndpoints: z.array(ApiEndpointSchema),
  securityAuthentication: SecurityAuthenticationSchema,
  integrationExternalApis: IntegrationExternalApisSchema,
  devops: DevOpsSchema,
  dataStorage: DataStorageSchema,
  analytics: AnalyticsSchema,
  detailedDataModels: DetailedDataModelsSchema,
  dataFlowDetailed: DataFlowDetailedSchema
});

const TechnicalPayloadSchema = z.object({
  technical: TechnicalSchema
});

// ---- Market (full structure as in prompts.js) ----
const IndustryOverviewSchema = z.object({
  trends: z.string(),
  marketData: z.string(),
  growthProjections: z.string().optional(),
  growthPotential: z.string().optional()
});

const TargetAudienceInsightsSchema = z.object({
  primaryAudience: z.record(z.any()).optional(),
  secondaryAudience: z.record(z.any()).optional(),
  needsAnalysis: z.string().optional(),
  usageHabits: z.string().optional(),
  demographics: z.string().optional(),
  definition: z.string().optional(),
  psychographics: z.string().optional(),
  behaviors: z.string().optional(),
  technologySkills: z.string().optional(),
  specificRoles: z.array(z.string()).optional()
});

const CompetitorSchema = z.object({
  competitor: z.string().optional(),
  name: z.string().optional(),
  advantages: z.string().optional(),
  disadvantages: z.string().optional(),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  differentiators: z.string().optional(),
  marketPosition: z.string().optional(),
  features: z.array(z.string()).optional(),
  uxStrengths: z.string().optional(),
  uxWeaknesses: z.string().optional(),
  monetization: z.string().optional(),
  gaps: z.array(z.string()).optional(),
  marketShare: z.string().optional()
});

const SwotAnalysisSchema = z.object({
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  opportunities: z.array(z.string()),
  threats: z.array(z.string())
});

const MarketSchema = z.object({
  industryOverview: z.object({
    trends: z.string(),
    marketData: z.string(),
    growthProjections: z.string().optional(),
    growthPotential: z.string().optional()
  }),
  targetAudienceInsights: z.object({
    primaryAudience: z.record(z.any()).optional(),
    secondaryAudience: z.record(z.any()).optional(),
    needsAnalysis: z.string().optional(),
    usageHabits: z.string().optional(),
    demographics: z.string().optional()
  }),
  competitiveLandscape: z.array(z.object({
    competitor: z.string().optional(),
    name: z.string().optional(),
    advantages: z.string().optional(),
    disadvantages: z.string().optional(),
    strengths: z.string().optional(),
    weaknesses: z.string().optional(),
    differentiators: z.string().optional(),
    marketPosition: z.string().optional(),
    features: z.array(z.string()).optional(),
    gaps: z.array(z.string()).optional(),
    marketShare: z.string().optional()
  })).min(1),
  swotAnalysis: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    opportunities: z.array(z.string()),
    threats: z.array(z.string())
  }),
  monetizationModel: z.object({
    pricingStrategy: z.string().optional(),
    revenueStreams: z.string().optional(),
    rationale: z.string().optional(),
    proposedModels: z.array(z.string()).optional(),
    recommendations: z.string().optional()
  }),
  marketingStrategy: z.object({
    channels: z.string().optional(),
    messaging: z.string().optional(),
    goToMarket: z.string().optional()
  })
});

const MarketPayloadSchema = z.object({
  market: MarketSchema
});

// ---- Design (full structure) ----
const VisualStyleGuideSchema = z.record(z.union([z.string(), z.array(z.any())]));

const LogoIconographySchema = z.record(z.union([z.string(), z.array(z.any()), z.record(z.any())]));

const UiLayoutSchema = z.record(z.string());

const UxPrinciplesSchema = z.record(z.string());

const DesignSchema = z.object({
  visualStyleGuide: VisualStyleGuideSchema,
  logoIconography: LogoIconographySchema,
  uiLayout: UiLayoutSchema,
  uxPrinciples: UxPrinciplesSchema
});

const DesignPayloadSchema = z.object({
  design: DesignSchema
});

// ---- Exports and helpers for OpenAI response_format ----
const STAGE_PAYLOAD_SCHEMAS = {
  overview: OverviewPayloadSchema,
  technical: TechnicalPayloadSchema,
  market: MarketPayloadSchema,
  design: DesignPayloadSchema
};

const STAGE_ROOT_KEYS = {
  overview: 'overview',
  technical: 'technical',
  market: 'market',
  design: 'design'
};

const { zodToJsonSchema } = require('zod-to-json-schema');
const { logger } = require('../server/logger');

/**
 * Build OpenAI response_format for strict structured output.
 *
 * zodToJsonSchema always wraps the top-level schema in a { "$ref": "#/definitions/<name>", "definitions": { ... } }
 * envelope. OpenAI rejects that because the root has no `type` field (it sees type: "None").
 * We unwrap the envelope so OpenAI receives { "type": "object", "properties": { ... }, ... } directly.
 *
 * @param {string} stage - overview | technical | market | design
 * @returns {object} response_format for runs.create
 */
function buildResponseFormat(stage) {
  const schema = STAGE_PAYLOAD_SCHEMAS[stage];
  if (!schema) throw new Error(`Unknown stage: ${stage}`);
  const name = `${stage}_response`;

  let jsonSchema = zodToJsonSchema(schema, { name, $refStrategy: 'none' });

  // Unwrap the $ref envelope that zodToJsonSchema always generates.
  // The actual schema lives inside definitions[name].
  if (jsonSchema.$ref) {
    const refKey = jsonSchema.$ref
      .replace(/^#\/definitions\//, '')
      .replace(/^#\/\$defs\//, '');
    const defs = jsonSchema.definitions || jsonSchema.$defs || {};
    if (defs[refKey]) {
      jsonSchema = { ...defs[refKey] };
    }
  }

  // Strip JSON-Schema meta-fields that OpenAI does not accept.
  delete jsonSchema.$schema;
  delete jsonSchema.definitions;
  delete jsonSchema.$defs;

  // Safety: ensure root type is object.
  if (!jsonSchema.type) {
    jsonSchema.type = 'object';
  }

  logger.info({ stage, rootType: jsonSchema.type }, '[buildResponseFormat] Built response_format for OpenAI');

  return {
    type: 'json_schema',
    json_schema: {
      name,
      strict: true,
      schema: jsonSchema
    }
  };
}

/**
 * Parse and validate API response for a stage. Throws ZodError if invalid.
 * @param {string} stage - overview | technical | market | design
 * @param {object} raw - Parsed JSON from API
 * @returns {object} Validated payload (root key only, e.g. { overview: {...} })
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
  MarketSchema,
  MarketPayloadSchema,
  DesignSchema,
  DesignPayloadSchema,
  STAGE_PAYLOAD_SCHEMAS,
  STAGE_ROOT_KEYS,
  buildResponseFormat,
  parseAndValidateStage
};
