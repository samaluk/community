export function getInitialOperatorDomain(serverURL: string | undefined): string {
  if (!serverURL) {
    throw new Error('NEXT_PUBLIC_SERVER_URL is required to create the initial Operator.')
  }

  let hostname: string

  try {
    hostname = new URL(serverURL).hostname.toLowerCase().replace(/\.$/, '')
  } catch {
    throw new Error('NEXT_PUBLIC_SERVER_URL must be a valid absolute URL.')
  }

  if (
    hostname.length === 0 ||
    hostname.length > 253 ||
    !hostname.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  ) {
    throw new Error('NEXT_PUBLIC_SERVER_URL must contain a valid canonical hostname.')
  }

  return hostname
}
