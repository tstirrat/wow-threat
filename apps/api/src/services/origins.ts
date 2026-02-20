/**
 * Allowed origin parsing utilities.
 */

/** Parse a comma-delimited allowlist into normalized origins. */
export function parseAllowedOrigins(rawOrigins: string | undefined): string[] {
  if (!rawOrigins) {
    return []
  }

  return rawOrigins
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

/** Check whether an origin is explicitly allowed. */
export function isOriginAllowed(
  origin: string,
  allowedOrigins: string[],
): boolean {
  return allowedOrigins.includes(origin)
}
