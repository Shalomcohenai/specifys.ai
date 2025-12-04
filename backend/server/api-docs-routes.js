/**
 * API Documentation Routes
 * Serves Swagger UI and OpenAPI specification
 */

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const { logger } = require('./logger');

const router = express.Router();

// Swagger UI options
const swaggerUiOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Specifys.ai API Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
};

// Serve Swagger UI
router.use('/swagger', swaggerUi.serve);
router.get('/swagger', swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Serve OpenAPI JSON specification
router.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Serve OpenAPI YAML specification (if needed)
router.get('/swagger.yaml', (req, res) => {
  res.setHeader('Content-Type', 'text/yaml');
  // Convert JSON to YAML (would need yaml library)
  res.json(swaggerSpec);
});

// API documentation info endpoint
router.get('/info', (req, res) => {
  res.json({
    title: 'Specifys.ai API Documentation',
    version: '2.0.0',
    description: 'API documentation for Specifys.ai',
    endpoints: {
      swaggerUI: '/api-docs/swagger',
      openAPIJSON: '/api-docs/swagger.json',
      openAPIYAML: '/api-docs/swagger.yaml',
    },
    authentication: {
      type: 'Bearer Token (Firebase ID Token)',
      header: 'Authorization: Bearer <token>',
    },
  });
});

logger.info({ type: 'api_docs_routes_mounted' }, '[API DOCS] ✅ API documentation routes mounted');

module.exports = router;


