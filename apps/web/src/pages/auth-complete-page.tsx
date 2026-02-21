/**
 * OAuth bridge completion page.
 */
import { type FC, useEffect, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'

import { useAuth } from '../auth/auth-provider'
import {
  type WclAuthPopupResult,
  createWclAuthPopupErrorResult,
  createWclAuthPopupSuccessResult,
  publishWclAuthPopupResult,
} from '../auth/wcl-popup-bridge'
import { Alert, AlertDescription } from '../components/ui/alert'

function readBridgeCode(hash: string): string | null {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(normalizedHash)
  const bridgeCode = params.get('bridge')

  return bridgeCode && bridgeCode.length > 0 ? bridgeCode : null
}

function createPopupResult(
  authEnabled: boolean,
  bridgeCode: string | null,
): WclAuthPopupResult {
  if (!authEnabled) {
    return createWclAuthPopupErrorResult(
      'Firebase auth configuration is missing for this environment.',
    )
  }

  if (!bridgeCode) {
    return createWclAuthPopupErrorResult('Missing bridge code in callback URL.')
  }

  return createWclAuthPopupSuccessResult(bridgeCode)
}

export const AuthCompletePage: FC = () => {
  const location = useLocation()
  const { authEnabled } = useAuth()
  const hasPublished = useRef(false)
  const bridgeCode = readBridgeCode(location.hash)
  const result = useMemo(
    () => createPopupResult(authEnabled, bridgeCode),
    [authEnabled, bridgeCode],
  )

  useEffect(() => {
    if (!hasPublished.current) {
      try {
        publishWclAuthPopupResult(result)
        hasPublished.current = true
      } catch {
        // If storage is unavailable, keep this page visible so users can
        // manually return to the main window and retry.
        return
      }
    }

    const closeTimer = window.setTimeout(() => {
      window.close()
    }, 250)

    return () => {
      window.clearTimeout(closeTimer)
    }
  }, [result])

  return (
    <section className="mx-auto max-w-lg space-y-3">
      <h2 className="text-lg font-semibold">
        {result.status === 'success'
          ? 'Sign-in complete'
          : 'Unable to complete sign-in'}
      </h2>
      <p className="text-sm text-muted-foreground">
        {result.status === 'success'
          ? 'Authentication finished. This window should close automatically.'
          : 'Return to the main app and retry sign-in.'}
      </p>
      {result.status === 'error' ? (
        <Alert variant="destructive">
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
