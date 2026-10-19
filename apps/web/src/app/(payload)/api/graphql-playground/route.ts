/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import '@payloadcms/next/css'
import { GRAPHQL_PLAYGROUND_GET } from '@payloadcms/next/routes'
import { getOperatorForHost, OperatorResolutionError } from '@/lib/operator'

const playgroundGet = GRAPHQL_PLAYGROUND_GET(config)
export const GET = async (request: Request) => {
  try {
    await getOperatorForHost(request.headers.get('host'))
  } catch (error) {
    if (error instanceof OperatorResolutionError) return new Response('Not found', { status: 404 })
    throw error
  }

  return playgroundGet(request)
}
