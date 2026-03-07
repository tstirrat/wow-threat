/**
 * Shared URL query-param parsing helpers.
 */

const truthyBooleanParamValues = new Set(['1', 'true'])
const falsyBooleanParamValues = new Set(['0', 'false'])

/** Parse a boolean-like query-param value into true/false/null. */
export function parseBooleanQueryParam(value: string | null): boolean | null {
  if (!value) {
    return null
  }

  const normalized = value.trim().toLowerCase()
  if (truthyBooleanParamValues.has(normalized)) {
    return true
  }

  if (falsyBooleanParamValues.has(normalized)) {
    return false
  }

  return null
}
