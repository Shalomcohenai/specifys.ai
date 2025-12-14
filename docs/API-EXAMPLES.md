# API Examples - Specifys.ai

## Authentication Examples

### Get Current User

```javascript
// Using API Client
const user = await window.api.get('/api/users/me');

// Using Fetch
const token = await firebase.auth().currentUser.getIdToken();
const response = await fetch('https://specifys-ai-development.onrender.com/api/users/me', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
const user = await response.json();
```

## Spec Management Examples

### Create a New Spec

```javascript
// Using API Client
const spec = await window.api.post('/api/specs', {
  title: 'My Awesome App',
  content: {
    overview: 'App overview...',
    technical: 'Technical details...',
    market: 'Market research...'
  }
});

// Response
{
  id: 'spec-123',
  userId: 'user-456',
  title: 'My Awesome App',
  content: { ... },
  createdAt: '2025-01-21T10:00:00Z',
  updatedAt: '2025-01-21T10:00:00Z'
}
```

### Get User Specs

```javascript
const specs = await window.api.get('/api/specs');
// Returns array of specs
```

### Update a Spec

```javascript
await window.api.put(`/api/specs/${specId}`, {
  title: 'Updated Title',
  content: { ... }
});
```

### Delete a Spec

```javascript
await window.api.delete(`/api/specs/${specId}`);
```

## Credits Examples

### Get User Credits

```javascript
const credits = await window.api.get('/api/credits');
// Response: { credits: 10, entitlements: {...} }
```

### Consume Credits

```javascript
const result = await window.api.post('/api/credits/consume', {
  amount: 1,
  reason: 'spec-generation'
});
```

### Refund Credits

```javascript
await window.api.post('/api/credits/refund', {
  amount: 1,
  reason: 'spec-generation-failed'
});
```

## Blog Examples

### Get Published Posts (Public)

```javascript
const posts = await window.api.get('/api/blog/public/posts');
// No authentication required
```

### Create Post (Admin)

```javascript
const post = await window.api.post('/api/blog/create-post', {
  title: 'New Blog Post',
  content: 'Post content...',
  published: true
});
```

## Error Handling Examples

### Handling Errors

```javascript
try {
  const spec = await window.api.post('/api/specs', data);
} catch (error) {
  if (error.status === 401) {
    // Unauthorized - redirect to login
    window.location.href = '/pages/auth.html';
  } else if (error.status === 403) {
    // Forbidden - show error message
    alert('You do not have permission to perform this action');
  } else if (error.status === 429) {
    // Rate limited - show message
    alert('Too many requests. Please try again later.');
  } else {
    // Other error
    console.error('API Error:', error);
    alert('An error occurred. Please try again.');
  }
}
```

## Advanced Examples

### Upload Spec to OpenAI

```javascript
const result = await window.api.post(`/api/specs/${specId}/upload-to-openai`, {
  assistantId: 'asst-123'
});
```

### Track Academy Guide View

```javascript
await window.api.post(`/api/academy/guides/${guideId}/view`);
```

### Get Admin Statistics

```javascript
const stats = await window.api.get('/api/admin/stats');
// Requires admin authentication
```

## Using with React/Vue/etc.

### React Hook Example

```javascript
import { useState, useEffect } from 'react';

function useSpecs() {
  const [specs, setSpecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSpecs() {
      try {
        setLoading(true);
        const data = await window.api.get('/api/specs');
        setSpecs(data);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }
    fetchSpecs();
  }, []);

  return { specs, loading, error };
}
```

## Testing with cURL

### Get Current User

```bash
curl -X GET \
  https://specifys-ai-development.onrender.com/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### Create Spec

```bash
curl -X POST \
  https://specifys-ai-development.onrender.com/api/specs \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My App",
    "content": {
      "overview": "App overview..."
    }
  }'
```

## Postman Collection

You can import the OpenAPI specification into Postman:

1. Go to Postman
2. Click "Import"
3. Select "Link"
4. Enter: `https://specifys-ai-development.onrender.com/api-docs/swagger.json`
5. Click "Import"

This will create a Postman collection with all API endpoints.


