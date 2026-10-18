import { formatAdminURL } from 'payload/shared'

export type MediaFileURLArgs = {
  apiRoute: string
  filename?: unknown
  serverURL?: string
  value?: string | null
}

const urlBase = 'http://payload.local'

function isLocalMediaPath(pathname: string, apiRoute: string) {
  const filePathPrefix = formatAdminURL({
    apiRoute,
    path: '/media/file/',
    relative: true,
  })
  const prefixPathname = new URL(filePathPrefix, urlBase).pathname
  return pathname.startsWith(prefixPathname) && pathname.length > prefixPathname.length
}

function isLocalMediaURL(value: string, apiRoute: string, serverURL?: string) {
  if (value.startsWith('//')) return false

  if (value.startsWith('/')) {
    try {
      return isLocalMediaPath(new URL(value, urlBase).pathname, apiRoute)
    } catch {
      return false
    }
  }

  if (!serverURL) return false

  try {
    const url = new URL(value)
    return url.origin === new URL(serverURL).origin && isLocalMediaPath(url.pathname, apiRoute)
  } catch {
    return false
  }
}

/** Keep locally served files on the request's current Operator origin. */
export function getMediaFileURL({ apiRoute, filename, serverURL, value }: MediaFileURLArgs) {
  if (value && !isLocalMediaURL(value, apiRoute, serverURL)) return value
  if (typeof filename !== 'string' || !filename) return null

  return formatAdminURL({
    apiRoute,
    path: `/media/file/${encodeURIComponent(filename)}`,
    relative: true,
  })
}
