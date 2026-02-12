/**
 * Minimal fetch client for API requests.
 */

export class ApiClientError extends Error {
  public readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Execute a JSON request and return parsed data. */
export async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    let message = body || `Request failed with status ${response.status}`

    if (body) {
      try {
        const parsed = JSON.parse(body) as {
          error?: {
            message?: unknown
          }
        }
        if (typeof parsed.error?.message === 'string') {
          message = parsed.error.message
        }
      } catch {
        // Keep raw body when the response is not valid JSON.
      }
    }

    throw new ApiClientError(
      message,
      response.status,
    )
  }

  return (await response.json()) as T
}
