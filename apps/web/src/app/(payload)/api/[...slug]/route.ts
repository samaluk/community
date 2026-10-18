/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config'
import '@payloadcms/next/css'
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes'
import { getOperatorForHost, OperatorResolutionError } from '@/lib/operator'

type RestArgs = { params: Promise<{ slug?: string[] }> }
type RestHandler = (request: Request, args: RestArgs) => Promise<Response>

const guardHost =
  (handler: RestHandler): RestHandler =>
  async (request, args) => {
    try {
      await getOperatorForHost(request.headers.get('host'))
    } catch (error) {
      if (error instanceof OperatorResolutionError)
        return new Response('Not found', { status: 404 })
      throw error
    }

    return handler(request, args)
  }

export const GET = guardHost(REST_GET(config))
export const POST = guardHost(REST_POST(config))
export const DELETE = guardHost(REST_DELETE(config))
export const PATCH = guardHost(REST_PATCH(config))
export const PUT = guardHost(REST_PUT(config))
export const OPTIONS = guardHost(REST_OPTIONS(config))
