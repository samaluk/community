/** Applies query updates in place; null or an empty value removes the key. */
export function applyParamUpdates(params: URLSearchParams, updates: Record<string, null | string>) {
  for (const [key, value] of Object.entries(updates)) {
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
  }
}
