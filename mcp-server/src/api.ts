/**
 * HTTP client for Specifys.ai backend /api/mcp/* endpoints.
 * Uses API key from env (SPECIFYS_API_KEY or MCP_API_KEY).
 */

const BASE_URL = process.env.SPECIFYS_API_BASE_URL || process.env.MCP_API_BASE_URL || 'http://localhost:10000';
const API_KEY = process.env.SPECIFYS_API_KEY || process.env.MCP_API_KEY || '';

function getHeaders(): Record<string, string> {
  const key = API_KEY.trim();
  if (!key) {
    console.error('[specifys-mcp] SPECIFYS_API_KEY or MCP_API_KEY must be set');
  }
  return {
    'Content-Type': 'application/json',
    'X-API-Key': key,
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const url = `${BASE_URL.replace(/\/$/, '')}/api/mcp${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { method: 'GET', headers: getHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPut<T = unknown>(path: string, body: object): Promise<T> {
  const url = `${BASE_URL.replace(/\/$/, '')}/api/mcp${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface SpecSummary {
  id: string;
  title?: string;
  createdAt?: string;
  status?: Record<string, string>;
  [key: string]: unknown;
}

export interface SpecFull {
  id: string;
  title?: string;
  overview?: string;
  technical?: string;
  market?: string;
  design?: string;
  architecture?: string;
  status?: Record<string, string>;
  [key: string]: unknown;
}

export interface ListSpecsResponse {
  success: boolean;
  specs: SpecSummary[];
}

export interface GetSpecResponse {
  success: boolean;
  spec: SpecFull;
}

export interface PromptTemplatesResponse {
  success: boolean;
  prompts: { overview: string; technical: string; market: string; design: string };
  systemPrompts?: Record<string, string>;
}

export interface ListToolsResponse {
  success: boolean;
  count: number;
  tools: unknown[];
}
