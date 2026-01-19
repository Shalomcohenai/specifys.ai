/**
 * Swagger/OpenAPI Configuration
 * Generates API documentation from JSDoc comments
 */

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Specifys.ai API',
      version: '2.0.0',
      description: 'API documentation for Specifys.ai - AI-powered app planning platform',
      contact: {
        name: 'Specifys.ai Support',
        email: 'support@specifys-ai.com',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: 'https://specifys-ai-development2.onrender.com',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Firebase ID Token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            details: {
              type: 'string',
              description: 'Error details',
            },
            status: {
              type: 'number',
              description: 'HTTP status code',
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            uid: {
              type: 'string',
              description: 'User ID',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email',
            },
            displayName: {
              type: 'string',
              description: 'User display name',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation date',
            },
          },
        },
        Spec: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Spec ID',
            },
            userId: {
              type: 'string',
              description: 'User ID',
            },
            title: {
              type: 'string',
              description: 'Spec title',
            },
            content: {
              type: 'object',
              description: 'Spec content',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation date',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update date',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './server/*.js', // Path to the API files
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;


