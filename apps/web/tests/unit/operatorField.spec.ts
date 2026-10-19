import { describe, expect, it, vi } from 'vitest'

import { withOperatorField } from '@/collections/operatorField'

const validateOperatorField = () => {
  const [field] = withOperatorField({ slug: 'test', fields: [] }).fields
  if (!field || field.type !== 'relationship' || typeof field.validate !== 'function') {
    throw new Error('The Operator relationship field must include a validator.')
  }
  return field.validate
}

describe('Operator relationship field validation', () => {
  it('requires an Operator relationship value', async () => {
    const validate = validateOperatorField()
    const req = { payloadAPI: 'local', payload: { findByID: vi.fn() } }

    await expect(validate(null, { req } as never)).resolves.toBe('An Operator is required.')
    expect(req.payload.findByID).not.toHaveBeenCalled()
  })

  it('confirms local assignments exist', async () => {
    const validate = validateOperatorField()
    const findByID = vi.fn().mockResolvedValue({ id: 17, status: 'active' })
    const req = { payloadAPI: 'local', payload: { findByID } }

    await expect(validate({ id: 17 } as never, { req } as never)).resolves.toBe(true)
    expect(findByID).toHaveBeenCalledWith({
      collection: 'operators',
      depth: 0,
      id: 17,
      overrideAccess: true,
      select: { status: true },
    })
  })

  it('requires public assignments to match the request Host', async () => {
    const validate = validateOperatorField()
    const req = {
      headers: new Headers({ host: 'club.example.test' }),
      payload: {
        find: vi.fn().mockResolvedValue({
          docs: [{ domain: 'club.example.test', id: 17, status: 'active' }],
        }),
      },
      payloadAPI: 'REST',
      user: { platformAdmin: true },
    }

    await expect(validate(17 as never, { req } as never)).resolves.toBe(true)
    await expect(validate(18 as never, { req } as never)).resolves.toBe(
      'The assigned operator must match this request host.',
    )
  })
})
