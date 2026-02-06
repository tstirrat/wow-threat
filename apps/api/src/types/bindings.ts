/**
 * Cloudflare Workers Bindings
 *
 * Type definitions for environment bindings available in the Worker.
 */

export interface Bindings {
  // Environment variables
  ENVIRONMENT: 'production' | 'staging' | 'development' | 'test'

  // WCL API credentials
  WCL_CLIENT_ID: string
  WCL_CLIENT_SECRET: string

  // API authentication
  API_KEY_SALT: string

  // KV Namespaces
  WCL_CACHE: KVNamespace
  AUGMENTED_CACHE: KVNamespace
}

// Hono context variables
export interface Variables {
  requestId: string
  startTime: number
}

export interface HealthCheckResponse {
  status: string
  environment: string
  requestId: string
}
