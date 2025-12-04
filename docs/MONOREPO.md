# Monorepo Structure - Specifys.ai

## Overview

The Specifys.ai project is organized as a monorepo using npm workspaces. This allows us to share code between frontend and backend, maintain consistent versions, and improve code organization.

## Structure

```
specifys-ai/
├── packages/
│   ├── api-client/        # Shared API client
│   │   ├── src/
│   │   │   └── index.js
│   │   └── package.json
│   ├── ui/                # Shared UI components
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── base.js
│   │   │   │   └── Modal.js
│   │   │   └── index.js
│   │   └── package.json
│   └── design-system/     # Design tokens
│       ├── tokens/
│       │   └── index.js
│       └── package.json
├── assets/                # Frontend assets (Jekyll)
├── backend/               # Backend server (Node/Express)
├── package.json           # Root workspace config
└── ...
```

## Packages

### @specifys/api-client

Centralized API client with:
- Authentication headers
- Error handling
- Retry logic
- Caching
- Request/response interceptors

**Usage:**
```javascript
// The API client is automatically available as window.api
// No import needed in browser context
window.api.get('/api/users')
  .then(data => console.log(data))
  .catch(error => console.error(error));
```

### @specifys/ui

Reusable UI components:
- `Component` - Base component class
- `Modal` - Modal dialog component

**Usage:**
```javascript
import { Modal } from '@specifys/ui/components/Modal';

const modal = new Modal('#myModal');
modal.open();
```

### @specifys/design-system

Design tokens for colors, spacing, typography, etc.

**Usage:**
```javascript
import { colors, spacing } from '@specifys/design-system/tokens';

console.log(colors.primary.DEFAULT); // '#FF6B35'
console.log(spacing.md); // '1rem'
```

## Workspace Configuration

The root `package.json` includes:

```json
{
  "workspaces": [
    "packages/*"
  ]
}
```

This tells npm to treat all directories in `packages/` as workspace packages.

## Installation

Install all dependencies (including workspace packages):

```bash
npm install
```

This will:
1. Install root dependencies
2. Install dependencies for each workspace package
3. Link workspace packages together

## Development

### Adding a New Package

1. Create directory: `packages/my-package/`
2. Create `package.json` with name `@specifys/my-package`
3. Run `npm install` to link it

### Using Workspace Packages

In any package or the root, you can import workspace packages:

```javascript
import { something } from '@specifys/api-client';
```

### Building

Each package can have its own build process. The root can orchestrate builds:

```bash
npm run build  # Build all packages
```

## Benefits

1. **Code Sharing**: Share code between frontend and backend
2. **Version Management**: Consistent versions across packages
3. **Better Organization**: Clear separation of concerns
4. **Easier Testing**: Test packages independently
5. **Type Safety**: Can add TypeScript to individual packages

## Migration Notes

The monorepo structure was introduced in Phase 2. The following files were moved:

- `assets/js/api-client.js` → `packages/api-client/src/index.js`
- `assets/js/components/base.js` → `packages/ui/src/components/base.js`
- `assets/js/components/Modal.js` → `packages/ui/src/components/Modal.js`

For backward compatibility, the original files still exist and are symlinked or copied to maintain compatibility with existing code.

## Future Improvements

- Add TypeScript to packages
- Add build processes for each package
- Add testing infrastructure
- Add linting/formatting rules
- Add CI/CD for packages


