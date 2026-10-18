import { expect, test } from 'vitest'

import {
  provisionStaffUser,
  type StaffProvisioningInput,
  type StaffProvisioningPort,
  type StaffUser,
  type StaffUserData,
} from '../../scripts/staffProvisioning'

const defaultInput: StaffProvisioningInput = {
  email: ' New.User@Example.com ',
  password: 'secret',
  grantPlatformAdmin: false,
  updateExisting: false,
}

function createPort(
  options: {
    user?: StaffUser | null
    operatorIds?: number[]
  } = {},
) {
  const created: StaffUserData[] = []
  const updated: Array<{ id: number | string; data: StaffUserData }> = []
  const checkedOperators: number[] = []
  const port: StaffProvisioningPort = {
    async findUserByEmail(email) {
      expect(email).toBe('new.user@example.com')
      return options.user ?? null
    },
    async assertOperatorExists(operatorId) {
      checkedOperators.push(operatorId)
      if (!options.operatorIds?.includes(operatorId)) {
        throw new Error(`Operator ${operatorId} does not exist`)
      }
    },
    async createUser(data) {
      created.push(data)
    },
    async updateUser(id, data) {
      updated.push({ id, data })
    },
  }

  return { port, created, updated, checkedOperators }
}

test('creates a Platform Admin only when that authority is explicitly requested', async () => {
  const { port, created } = createPort()

  await expect(
    provisionStaffUser(port, { ...defaultInput, grantPlatformAdmin: true }),
  ).resolves.toBe('created')

  expect(created).toEqual([
    { email: 'new.user@example.com', password: 'secret', platformAdmin: true },
  ])

  const operatorStaff = createPort({ operatorIds: [7] })
  await provisionStaffUser(operatorStaff.port, {
    ...defaultInput,
    operatorId: '7',
  })
  expect(operatorStaff.created).toEqual([
    {
      email: 'new.user@example.com',
      password: 'secret',
      tenants: [{ operator: 7, role: 'admin' }],
    },
  ])
})

test('adds an Operator assignment without replacing other grants or changing platform authority', async () => {
  const existingUser: StaffUser = {
    id: 41,
    platformAdmin: true,
    tenants: [
      { operator: 8, role: 'admin' },
      { operator: 12, role: 'validation-manager' },
    ],
  }
  const { port, updated, checkedOperators } = createPort({ user: existingUser, operatorIds: [19] })

  await expect(
    provisionStaffUser(port, {
      ...defaultInput,
      operatorId: '19',
      role: 'editor',
      updateExisting: true,
    }),
  ).resolves.toBe('updated')

  expect(checkedOperators).toEqual([19])
  expect(updated).toEqual([
    {
      id: 41,
      data: {
        password: 'secret',
        tenants: [
          { operator: 8, role: 'admin' },
          { operator: 12, role: 'validation-manager' },
          { operator: 19, role: 'editor' },
        ],
      },
    },
  ])
})

test('requires explicit update permission and an existing target Operator before changing a user', async () => {
  const existingUser: StaffUser = { id: 42, tenants: [{ operator: 8, role: 'admin' }] }
  const { port, updated, checkedOperators } = createPort({ user: existingUser, operatorIds: [] })

  await expect(
    provisionStaffUser(port, { ...defaultInput, operatorId: '19', updateExisting: false }),
  ).rejects.toThrow('CMS_USER_UPDATE_EXISTING=true')
  expect(checkedOperators).toEqual([])

  await expect(
    provisionStaffUser(port, {
      ...defaultInput,
      operatorId: '19',
      updateExisting: true,
    }),
  ).rejects.toThrow('Operator 19 does not exist')
  expect(checkedOperators).toEqual([19])
  expect(updated).toEqual([])
})

test('rejects missing authority scope and invalid Operator IDs or roles before writing', async () => {
  const { port, created, updated, checkedOperators } = createPort({ operatorIds: [2] })

  await expect(provisionStaffUser(port, defaultInput)).rejects.toThrow('Set CMS_OPERATOR_ID')
  await expect(provisionStaffUser(port, { ...defaultInput, operatorId: '-2' })).rejects.toThrow(
    'CMS_OPERATOR_ID must be a positive integer',
  )
  await expect(
    provisionStaffUser(port, { ...defaultInput, operatorId: '2', role: 'owner' }),
  ).rejects.toThrow('CMS_USER_ROLE must be one of')

  expect(checkedOperators).toEqual([2])
  expect(created).toEqual([])
  expect(updated).toEqual([])
})
