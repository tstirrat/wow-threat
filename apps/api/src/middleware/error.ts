/**
 * Error Handling Middleware
 *
 * Provides structured error responses and logging.
 */
import type { ErrorHandler } from 'hono'

import type { Bindings, Variables } from '../types/bindings'

export interface ApiError {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  requestId: string
}

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// Common error codes
export const ErrorCodes = {
  INVALID_REPORT_CODE: 'INVALID_REPORT_CODE',
  INVALID_FIGHT_ID: 'INVALID_FIGHT_ID',
  INVALID_EVENTS_CURSOR: 'INVALID_EVENTS_CURSOR',
  INVALID_GAME_VERSION: 'INVALID_GAME_VERSION',
  INVALID_CONFIG_VERSION: 'INVALID_CONFIG_VERSION',
  REPORT_NOT_FOUND: 'REPORT_NOT_FOUND',
  FIGHT_NOT_FOUND: 'FIGHT_NOT_FOUND',
  WCL_API_ERROR: 'WCL_API_ERROR',
  WCL_RATE_LIMITED: 'WCL_RATE_LIMITED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FIRESTORE_ERROR: 'FIRESTORE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

// Error factory functions
export function invalidReportCode(code: string): AppError {
  return new AppError(
    ErrorCodes.INVALID_REPORT_CODE,
    `Invalid report code format: ${code}`,
    400,
  )
}

export function invalidFightId(id: string): AppError {
  return new AppError(
    ErrorCodes.INVALID_FIGHT_ID,
    `Fight ID must be a number: ${id}`,
    400,
  )
}

export function invalidEventsCursor(cursor: string): AppError {
  return new AppError(
    ErrorCodes.INVALID_EVENTS_CURSOR,
    `Events cursor must be a number: ${cursor}`,
    400,
  )
}

export function invalidGameVersion(
  gameVersion: number,
  supportedVersions: number[],
  details?: Record<string, unknown>,
): AppError {
  return new AppError(
    ErrorCodes.INVALID_GAME_VERSION,
    `Unsupported game version: ${gameVersion}. Supported versions: ${supportedVersions.join(', ')}`,
    400,
    {
      gameVersion,
      supportedVersions,
      ...details,
    },
  )
}

export function invalidConfigVersion(
  requestedVersion: string,
  supportedVersion: string,
): AppError {
  return new AppError(
    ErrorCodes.INVALID_CONFIG_VERSION,
    `Unsupported configVersion "${requestedVersion}". Supported version is "${supportedVersion}"`,
    400,
    {
      requestedVersion,
      supportedVersion,
    },
  )
}

export function reportNotFound(code: string): AppError {
  return new AppError(
    ErrorCodes.REPORT_NOT_FOUND,
    `Report not found: ${code}`,
    404,
  )
}

export function fightNotFound(reportCode: string, fightId: number): AppError {
  return new AppError(
    ErrorCodes.FIGHT_NOT_FOUND,
    `Fight ${fightId} not found in report ${reportCode}`,
    404,
  )
}

export function wclApiError(
  message: string,
  details?: Record<string, unknown>,
): AppError {
  return new AppError(ErrorCodes.WCL_API_ERROR, message, 502, details)
}

export function wclRateLimited(details?: Record<string, unknown>): AppError {
  return new AppError(
    ErrorCodes.WCL_RATE_LIMITED,
    'WCL API rate limit exceeded. Please try again later.',
    429,
    details,
  )
}

export function unauthorized(message = 'Unauthorized'): AppError {
  return new AppError(ErrorCodes.UNAUTHORIZED, message, 401)
}

export function firestoreError(message: string): AppError {
  return new AppError(ErrorCodes.FIRESTORE_ERROR, message, 500)
}

function resolveRetryAfterHeader(
  details?: Record<string, unknown>,
): string | null {
  const retryAfter = details?.retryAfter
  if (typeof retryAfter === 'string' && retryAfter.length > 0) {
    return retryAfter
  }

  const retryAfterSeconds = details?.retryAfterSeconds
  if (
    typeof retryAfterSeconds === 'number' &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds >= 0
  ) {
    return String(Math.ceil(retryAfterSeconds))
  }

  return null
}

/**
 * Global error handler
 */
export const errorHandler: ErrorHandler<{
  Bindings: Bindings
  Variables: Variables
}> = (err, c) => {
  const requestId = c.get('requestId') || 'unknown'

  // Log the error
  console.error(`[${requestId}] Error:`, err)

  if (err instanceof AppError) {
    const response: ApiError = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      requestId,
    }

    if (err.code === ErrorCodes.WCL_RATE_LIMITED) {
      const retryAfter = resolveRetryAfterHeader(err.details)
      if (retryAfter) {
        c.header('Retry-After', retryAfter)
      }
    }

    return c.json(response, err.statusCode as 400 | 401 | 404 | 429 | 500 | 502)
  }

  // Unknown error
  const response: ApiError = {
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message:
        c.env.ENVIRONMENT === 'production'
          ? 'An unexpected error occurred'
          : err.message || 'Unknown error',
    },
    requestId,
  }
  return c.json(response, 500)
}
