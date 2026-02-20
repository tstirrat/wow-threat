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
  WCL_OAUTH_REDIRECT_URI: string

  // Firebase/Firestore credentials
  FIREBASE_PROJECT_ID: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
  FIRESTORE_PROJECT_ID: string

  // Security and CORS settings
  WCL_TOKEN_ENCRYPTION_KEY: string
  BRIDGE_CODE_SIGNING_SECRET: string
  ALLOWED_ORIGINS: string

  // KV Namespaces
  WCL_CACHE: KVNamespace
  AUGMENTED_CACHE: KVNamespace
}

// Hono context variables
export interface Variables {
  requestId: string
  startTime: number
  uid?: string
}

export interface HealthCheckResponse {
  status: string
  environment: string
  requestId: string
}
