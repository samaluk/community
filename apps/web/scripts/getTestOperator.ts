import type { Payload } from 'payload'

/** Find or create the active Operator used by browser tests for their base URL. */
export async function getTestOperator(payload: Payload) {
  const baseURL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
  const domain = new URL(baseURL).hostname.toLowerCase().replace(/\.$/, '')
  const existing = await payload.find({
    collection: 'operators',
    depth: 0,
    limit: 2,
    overrideAccess: true,
    where: { domain: { equals: domain } },
  })

  if (existing.docs.length > 1) throw new Error(`Multiple test Operators use the ${domain} domain`)

  const operator =
    existing.docs[0] ??
    (await payload.create({
      collection: 'operators',
      data: { domain, name: `E2E ${domain}`, status: 'active' },
      overrideAccess: true,
    }))

  if (operator.status !== 'active') throw new Error(`The E2E Operator for ${domain} is suspended`)
  return operator
}
