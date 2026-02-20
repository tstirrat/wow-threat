/**
 * OAuth bridge completion page.
 */
import { type FC, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/auth-provider'
import { Alert, AlertDescription } from '../components/ui/alert'

function readBridgeCode(hash: string): string | null {
  const normalizedHash = hash.startsWith('#') ? hash.slice(1) : hash
  const params = new URLSearchParams(normalizedHash)
  const bridgeCode = params.get('bridge')

  return bridgeCode && bridgeCode.length > 0 ? bridgeCode : null
}

export const AuthCompletePage: FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { completeBridgeSignIn, authEnabled } = useAuth()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const hasStarted = useRef(false)
  const bridgeCode = readBridgeCode(location.hash)

  useEffect(() => {
    if (!authEnabled || hasStarted.current || !bridgeCode) {
      return
    }

    hasStarted.current = true

    void completeBridgeSignIn(bridgeCode)
      .then(() => {
        navigate('/', { replace: true })
      })
      .catch((error: unknown) => {
        const nextMessage =
          error instanceof Error ? error.message : 'Unable to complete sign-in.'
        setErrorMessage(nextMessage)
      })
  }, [authEnabled, bridgeCode, completeBridgeSignIn, navigate])

  if (!authEnabled) {
    return (
      <section className="mx-auto max-w-lg space-y-3">
        <h2 className="text-lg font-semibold">Authentication unavailable</h2>
        <p className="text-sm text-muted-foreground">
          Firebase auth configuration is missing for this environment.
        </p>
      </section>
    )
  }

  if (!bridgeCode) {
    return (
      <section className="mx-auto max-w-lg space-y-3">
        <h2 className="text-lg font-semibold">Invalid callback URL</h2>
        <Alert variant="destructive">
          <AlertDescription>
            Missing bridge code in callback URL.
          </AlertDescription>
        </Alert>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-lg space-y-3">
      <h2 className="text-lg font-semibold">Completing sign-in</h2>
      <p className="text-sm text-muted-foreground">
        Finishing your Warcraft Logs authentication bridge.
      </p>
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
