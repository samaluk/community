/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import { GRAPHQL_POST, REST_OPTIONS } from '@payloadcms/next/routes'
import { getOperatorForHost, OperatorResolutionError } from '@/lib/operator'

const graphqlPost = GRAPHQL_POST(config)
export const POST = async (request: Request) => {
  try {
    await getOperatorForHost(request.headers.get('host'))
  } catch (error) {
    if (error instanceof OperatorResolutionError) return new Response('Not found', { status: 404 })
    throw error
  }

  return graphqlPost(request)
}

const options = REST_OPTIONS(config)
export const OPTIONS = async (request: Request, args: { params: Promise<{ slug?: string[] }> }) => {
  try {
    await getOperatorForHost(request.headers.get('host'))
  } catch (error) {
    if (error instanceof OperatorResolutionError) return new Response('Not found', { status: 404 })
    throw error
  }

  return options(request, args)
}
