/** Canonicalize HTTP Host values without trusting forwarded-host overrides. */
export function normalizeOperatorHost(hostHeader: string | null | undefined): string | null {
  if (!hostHeader || hostHeader !== hostHeader.trim() || /[,/\\@\s]/.test(hostHeader)) {
    return null
  }

  try {
    const parsed = new URL(`http://${hostHeader}`)
    if (
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    ) {
      return null
    }

    const host = parsed.hostname.toLowerCase().replace(/\.$/, '')
    return host.length > 0 ? host : null
  } catch {
    return null
  }
}
