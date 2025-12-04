# API Documentation - Specifys.ai

## Overview

The Specifys.ai API provides endpoints for user management, spec generation, credits, blog management, and more.

## Base URL

- **Production**: `https://specifys-ai.onrender.com`
- **Development**: `http://localhost:3000`

## Authentication

Most endpoints require authentication using Firebase ID tokens.

### Getting a Token

1. Authenticate with Firebase on the frontend
2. Get the ID token: `const token = await firebase.auth().currentUser.getIdToken()`
3. Include in requests: `Authorization: Bearer <token>`

### Example

```javascript
const token = await firebase.auth().currentUser.getIdToken();
const response = await fetch('https://specifys-ai.onrender.com/api/users/me', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## API Documentation

### Swagger UI

Interactive API documentation is available at:
- **Swagger UI**: `/api-docs/swagger`
- **OpenAPI JSON**: `/api-docs/swagger.json`
- **OpenAPI YAML**: `/api-docs/swagger.yaml`

### Accessing Documentation

1. **Local Development**: `http://localhost:3000/api-docs/swagger`
2. **Production**: `https://specifys-ai.onrender.com/api-docs/swagger`

## API Endpoints

### User Management (`/api/users`)

- `GET /api/users/me` - Get current user
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Specs (`/api/specs`)

- `GET /api/specs` - List user specs
- `GET /api/specs/:id` - Get spec by ID
- `POST /api/specs` - Create new spec
- `PUT /api/specs/:id` - Update spec
- `DELETE /api/specs/:id` - Delete spec
- `POST /api/specs/:id/upload-to-openai` - Upload spec to OpenAI

### Credits (`/api/credits`)

- `GET /api/credits` - Get user credits
- `POST /api/credits/consume` - Consume credits
- `POST /api/credits/refund` - Refund credits

### Blog (`/api/blog`)

- `GET /api/blog/public/posts` - List published posts (public)
- `GET /api/blog/posts` - List all posts (admin)
- `GET /api/blog/posts/:id` - Get post by ID
- `POST /api/blog/create-post` - Create post (admin)
- `PUT /api/blog/posts/:id` - Update post (admin)
- `DELETE /api/blog/posts/:id` - Delete post (admin)

### Articles (`/api/articles`)

- `GET /api/articles` - List articles
- `GET /api/articles/:id` - Get article by ID
- `POST /api/articles` - Create article (admin)
- `PUT /api/articles/:id` - Update article (admin)
- `DELETE /api/articles/:id` - Delete article (admin)

### Academy (`/api/academy`)

- `GET /api/academy/guides` - List academy guides
- `GET /api/academy/guides/:id` - Get guide by ID
- `POST /api/academy/guides/:id/view` - Track guide view

### Chat (`/api/chat`)

- `POST /api/chat` - Send chat message
- `GET /api/chat/history` - Get chat history

### Admin (`/api/admin`)

- `GET /api/admin/users` - List all users (admin)
- `GET /api/admin/stats` - Get admin statistics (admin)
- `GET /api/admin/health` - Health check (admin)

### Stats (`/api/stats`)

- `GET /api/stats` - Get public statistics
- `GET /api/stats/detailed` - Get detailed statistics (admin)

### Health (`/api/health`)

- `GET /api/health` - Health check
- `GET /api/health/detailed` - Detailed health check

### Lemon Squeezy (`/api/lemon`)

- `POST /api/lemon/webhook` - Lemon Squeezy webhook
- `GET /api/lemon/products` - Get products
- `POST /api/lemon/checkout` - Create checkout session

## Error Handling

All errors follow this format:

```json
{
  "error": "Error message",
  "details": "Additional error details",
  "status": 400
}
```

### Common Error Codes

- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **General**: 100 requests per 15 minutes
- **Auth**: 5 requests per 15 minutes
- **Feedback**: 10 requests per 15 minutes

Rate limit headers are included in responses:
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset time (Unix timestamp)

## Examples

### Using the API Client

The frontend uses a centralized API client (`window.api`):

```javascript
// GET request
const users = await window.api.get('/api/users/me');

// POST request
const spec = await window.api.post('/api/specs', {
  title: 'My App',
  content: { ... }
});

// PUT request
await window.api.put(`/api/specs/${specId}`, {
  title: 'Updated Title'
});

// DELETE request
await window.api.delete(`/api/specs/${specId}`);
```

### Direct Fetch

```javascript
const token = await firebase.auth().currentUser.getIdToken();

const response = await fetch('https://specifys-ai.onrender.com/api/specs', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    title: 'My App',
    content: { ... }
  })
});

const data = await response.json();
```

## Support

For API support:
- **Email**: support@specifys-ai.com
- **Documentation**: `/api-docs/swagger`
- **GitHub**: [Repository URL]

## Changelog

### Version 2.0.0
- Added Swagger/OpenAPI documentation
- Improved error handling
- Added rate limiting
- Enhanced security headers


