/**
 * Tests for Error Handling
 */
import * as Sentry from '@sentry/cloudflare'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMockBindings } from '../../test/setup'
import type { Bindings, Variables } from '../types/bindings'
import {
  AppError,
  ErrorCodes,
  errorHandler,
  fightNotFound,
  firestoreError,
  invalidFightId,
  invalidReportCode,
  reportNotFound,
  unauthorized,
  wclApiError,
  wclRateLimited,
} from './error'

vi.mock('@sentry/cloudflare', () => ({
  captureException: vi.fn(),
}))

describe('AppError', () => {
  it('creates error with all properties', () => {
    const error = new AppError('TEST_CODE', 'Test message', 400, {
      key: 'value',
    })

    expect(error.code).toBe('TEST_CODE')
    expect(error.message).toBe('Test message')
    expect(error.statusCode).toBe(400)
    expect(error.details).toEqual({ key: 'value' })
    expect(error.name).toBe('AppError')
  })

  it('defaults to 500 status code', () => {
    const error = new AppError('TEST_CODE', 'Test message')

    expect(error.statusCode).toBe(500)
  })

  it('is an instance of Error', () => {
    const error = new AppError('TEST_CODE', 'Test message')

    expect(error instanceof Error).toBe(true)
    expect(error instanceof AppError).toBe(true)
  })
})

describe('Error factory functions', () => {
  describe('invalidReportCode', () => {
    it('creates 400 error with correct code', () => {
      const error = invalidReportCode('bad!code')

      expect(error.code).toBe(ErrorCodes.INVALID_REPORT_CODE)
      expect(error.statusCode).toBe(400)
      expect(error.message).toContain('bad!code')
    })
  })

  describe('invalidFightId', () => {
    it('creates 400 error with correct code', () => {
      const error = invalidFightId('abc')

      expect(error.code).toBe(ErrorCodes.INVALID_FIGHT_ID)
      expect(error.statusCode).toBe(400)
      expect(error.message).toContain('abc')
    })
  })

  describe('reportNotFound', () => {
    it('creates 404 error with correct code', () => {
      const error = reportNotFound('ABC123')

      expect(error.code).toBe(ErrorCodes.REPORT_NOT_FOUND)
      expect(error.statusCode).toBe(404)
      expect(error.message).toContain('ABC123')
    })
  })

  describe('fightNotFound', () => {
    it('creates 404 error with report code and fight id', () => {
      const error = fightNotFound('ABC123', 5)

      expect(error.code).toBe(ErrorCodes.FIGHT_NOT_FOUND)
      expect(error.statusCode).toBe(404)
      expect(error.message).toContain('ABC123')
      expect(error.message).toContain('5')
    })
  })

  describe('wclApiError', () => {
    it('creates 502 error with message', () => {
      const error = wclApiError('GraphQL error')

      expect(error.code).toBe(ErrorCodes.WCL_API_ERROR)
      expect(error.statusCode).toBe(502)
      expect(error.message).toBe('GraphQL error')
    })

    it('accepts optional details', () => {
      const error = wclApiError('Error', { query: 'GetReport' })

      expect(error.details).toEqual({ query: 'GetReport' })
    })
  })

  describe('wclRateLimited', () => {
    it('creates 429 error', () => {
      const error = wclRateLimited()

      expect(error.code).toBe(ErrorCodes.WCL_RATE_LIMITED)
      expect(error.statusCode).toBe(429)
    })

    it('accepts optional details', () => {
      const error = wclRateLimited({ retryAfterSeconds: 15 })

      expect(error.details).toEqual({ retryAfterSeconds: 15 })
    })
  })

  describe('unauthorized', () => {
    it('creates 401 error with default message', () => {
      const error = unauthorized()

      expect(error.code).toBe(ErrorCodes.UNAUTHORIZED)
      expect(error.statusCode).toBe(401)
      expect(error.message).toBe('Unauthorized')
    })

    it('accepts custom message', () => {
      const error = unauthorized('Invalid token')

      expect(error.message).toBe('Invalid token')
    })
  })
})

describe('ErrorCodes', () => {
  it('contains all expected error codes', () => {
    expect(ErrorCodes.INVALID_REPORT_CODE).toBe('INVALID_REPORT_CODE')
    expect(ErrorCodes.INVALID_FIGHT_ID).toBe('INVALID_FIGHT_ID')
    expect(ErrorCodes.INVALID_GAME_VERSION).toBe('INVALID_GAME_VERSION')
    expect(ErrorCodes.REPORT_NOT_FOUND).toBe('REPORT_NOT_FOUND')
    expect(ErrorCodes.FIGHT_NOT_FOUND).toBe('FIGHT_NOT_FOUND')
    expect(ErrorCodes.WCL_API_ERROR).toBe('WCL_API_ERROR')
    expect(ErrorCodes.WCL_RATE_LIMITED).toBe('WCL_RATE_LIMITED')
    expect(ErrorCodes.UNAUTHORIZED).toBe('UNAUTHORIZED')
    expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
  })
})

describe('errorHandler Sentry integration', () => {
  let app: Hono<{ Bindings: Bindings; Variables: Variables }>

  beforeEach(() => {
    app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
    app.onError(errorHandler)
    vi.clearAllMocks()
  })

  it('calls captureException for 5xx AppErrors', async () => {
    app.get('/test', () => {
      throw firestoreError('DB connection failed')
    })

    await app.request('http://localhost/test', {}, createMockBindings())

    expect(Sentry.captureException).toHaveBeenCalledOnce()
  })

  it('does not call captureException for 4xx AppErrors', async () => {
    app.get('/test', () => {
      throw invalidReportCode('bad!code')
    })

    await app.request('http://localhost/test', {}, createMockBindings())

    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('does not call captureException for 404 AppErrors', async () => {
    app.get('/test', () => {
      throw reportNotFound('ABC123')
    })

    await app.request('http://localhost/test', {}, createMockBindings())

    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('calls captureException for unknown errors', async () => {
    app.get('/test', () => {
      throw new Error('Unexpected failure')
    })

    await app.request('http://localhost/test', {}, createMockBindings())

    expect(Sentry.captureException).toHaveBeenCalledOnce()
  })

  it('calls captureException with the original error', async () => {
    const err = firestoreError('DB error')
    app.get('/test', () => {
      throw err
    })

    await app.request('http://localhost/test', {}, createMockBindings())

    expect(Sentry.captureException).toHaveBeenCalledWith(err)
  })
})
