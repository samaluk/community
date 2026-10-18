import { expect, it, vi } from 'vitest'

import { ensureHomeVideoOperator } from '@/access/homeVideoOperator'

it('keeps home video ownership on create and partial updates, rejecting another Operator’s media', async () => {
  const findByID = vi.fn().mockResolvedValue({ operator: { id: 101 } })
  const req = { payload: { findByID } }
  const data = { operator: 101, heroVideo: 7 }
  const args = { data, req, operation: 'create' } as never

  await expect(ensureHomeVideoOperator(args)).resolves.toBe(data)
  expect(findByID).toHaveBeenCalledWith(
    expect.objectContaining({
      collection: 'media',
      id: 7,
      depth: 0,
      req,
    }),
  )

  findByID.mockResolvedValue({ operator: 202 })
  await expect(ensureHomeVideoOperator(args)).rejects.toThrow('same operator')

  findByID.mockResolvedValue({ operator: 101 })
  const update = { heroVideo: { id: 8 } }
  await expect(
    ensureHomeVideoOperator({
      data: update,
      originalDoc: { operator: { id: 101 }, heroVideo: 7 },
      req,
      operation: 'update',
    } as never),
  ).resolves.toBe(update)
  expect(findByID).toHaveBeenLastCalledWith(expect.objectContaining({ id: 8 }))

  findByID.mockResolvedValue({ operator: 202 })
  await expect(
    ensureHomeVideoOperator({
      data: { heroVideoAlt: 'Updated description' },
      originalDoc: { operator: 101, heroVideo: 7 },
      req,
      operation: 'update',
    } as never),
  ).rejects.toThrow('same operator')
})

it('leaves incomplete draft values to the required field validators', async () => {
  const findByID = vi.fn()
  const req = { payload: { findByID } }
  for (const data of [{ operator: 101 }, { heroVideo: 7 }, {}]) {
    await expect(
      ensureHomeVideoOperator({ data, req, operation: 'create' } as never),
    ).resolves.toBe(data)
  }
  expect(findByID).not.toHaveBeenCalled()
})
