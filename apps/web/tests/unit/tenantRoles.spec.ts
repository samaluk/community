import { describe, expect, it } from 'vitest'

import {
  isAdmin,
  isPlatformAdmin,
  isStaff,
  isVersionEditorOrAdmin,
  ensureLexicalTargetsMatchOperator,
  ensureRequestHostOperator,
  getStaffAccessScope,
  operatorsReadAccess,
} from '@/access/roles'

function accessArgs(
  user: unknown,
  tenantId?: number,
  data?: unknown,
  isReadingStaticFile = false,
  operatorStatus: 'active' | 'suspended' = 'active',
) {
  const selectedOperator = tenantId ?? 101
  const domain = `operator-${selectedOperator}.example.test`

  return {
    data,
    isReadingStaticFile,
    req: {
      headers: new Headers({ cookie: `payload-tenant=${selectedOperator}`, host: domain }),
      payload: {
        find: async () => ({
          docs: [{ domain, id: selectedOperator, status: operatorStatus }],
        }),
      },
      user,
    },
  } as never
}

describe('tenant role access', () => {
  it('scopes each role to the host operator where that role was granted', async () => {
    const user = {
      id: 7,
      tenants: [
        { operator: 101, role: 'admin' },
        { operator: { id: 202 }, role: 'validation-manager' },
      ],
    }

    expect(await isAdmin(accessArgs(user, 101))).toEqual({
      and: [{ operator: { equals: 101 } }, { operator: { in: [101] } }],
    })
    expect(await isAdmin(accessArgs(user, 202))).toBe(false)
    expect(await isStaff(accessArgs(user, 101))).toEqual({
      and: [{ operator: { equals: 101 } }, { operator: { in: [101, 202] } }],
    })
    expect(await isStaff(accessArgs(user, 202))).toEqual({
      and: [{ operator: { equals: 202 } }, { operator: { in: [101, 202] } }],
    })
  })

  it('does not infer a role from another operator membership', async () => {
    const user = {
      id: 7,
      tenants: [{ operator: 101, role: 'admin' }],
    }

    expect(await isAdmin(accessArgs(user, 101))).toEqual({
      and: [{ operator: { equals: 101 } }, { operator: { in: [101] } }],
    })
    expect(
      await isAdmin(
        accessArgs({ id: 8, tenants: [{ operator: 202, role: 'validation-manager' }] }, 202),
      ),
    ).toBe(false)
    expect(await isStaff(accessArgs({ id: 9, tenants: [] }, 101))).toBe(false)
  })

  it('rejects creating a record under an operator where the user lacks that role', async () => {
    const user = {
      id: 7,
      tenants: [
        { operator: 101, role: 'admin' },
        { operator: 202, role: 'validation-manager' },
      ],
    }

    expect(await isAdmin(accessArgs(user, 101, { operator: 101 }))).toBe(true)
    expect(await isAdmin(accessArgs(user, 101, { operator: 202 }))).toBe(false)
    expect(await isStaff(accessArgs(user, 202, { operator: 202 }))).toBe(true)
    expect(await isAdmin(accessArgs(user, 101, {}))).toBe(false)
  })

  it('scopes version history to the current Operator and admin/editor membership', async () => {
    const user = {
      id: 7,
      tenants: [
        { operator: 101, role: 'admin' },
        { operator: 202, role: 'validation-manager' },
      ],
    }

    expect(await isVersionEditorOrAdmin(accessArgs(user, 101))).toEqual({
      and: [{ 'version.operator': { equals: 101 } }, { 'version.operator': { in: [101] } }],
    })
    expect(await isVersionEditorOrAdmin(accessArgs(user, 202))).toBe(false)
  })

  it('keeps platform administration separate from tenant membership roles', async () => {
    const platformAdmin = { id: 1, platformAdmin: true, tenants: [] }
    const tenantAdmin = { id: 2, platformAdmin: false, tenants: [{ operator: 101, role: 'admin' }] }

    expect(isPlatformAdmin(accessArgs(platformAdmin, 101))).toBe(true)
    expect(await isAdmin(accessArgs(platformAdmin, 202))).toEqual({
      and: [{ operator: { equals: 202 } }, { operator: { in: [202] } }],
    })
    expect(isPlatformAdmin(accessArgs(tenantAdmin, 101))).toBe(false)
    expect(await isAdmin(accessArgs(tenantAdmin, 101))).toEqual({
      and: [{ operator: { equals: 101 } }, { operator: { in: [101] } }],
    })
  })

  it('limits the Operator registry to assigned Operators for tenant staff', () => {
    const user = {
      id: 7,
      tenants: [
        { operator: 101, role: 'admin' },
        { operator: { id: 202 }, role: 'validation-manager' },
      ],
    }

    expect(operatorsReadAccess(accessArgs(user))).toEqual({ id: { in: [101, 202] } })
    expect(operatorsReadAccess(accessArgs({ id: 8, tenants: [] }))).toBe(false)
    expect(operatorsReadAccess(accessArgs(null))).toBe(false)
  })

  it('allows platform admins to read the complete Operator registry', () => {
    expect(operatorsReadAccess(accessArgs({ id: 1, platformAdmin: true, tenants: [] }))).toBe(true)
  })

  it('rejects rich-text references to another operator or an unpublished target', async () => {
    const args = (target: { operator: number; _status: string }) =>
      ({
        data: {
          operator: 101,
          _status: 'published',
          body: {
            root: {
              children: [{ type: 'relationship', relationTo: 'articles', value: { id: 55 } }],
            },
          },
        },
        originalDoc: undefined,
        req: {
          payload: {
            findByID: async () => target,
          },
        },
      }) as never

    await expect(
      ensureLexicalTargetsMatchOperator(args({ operator: 202, _status: 'published' })),
    ).rejects.toThrow('Rich text references must belong to the same operator.')
    await expect(
      ensureLexicalTargetsMatchOperator(args({ operator: 101, _status: 'draft' })),
    ).rejects.toThrow('Published rich text cannot reference draft content.')
    await expect(
      ensureLexicalTargetsMatchOperator(args({ operator: 101, _status: 'published' })),
    ).resolves.toBeDefined()
  })

  it('uses the explicit Operator for Local API writes and the Host for API writes', async () => {
    const localData = { operator: 101 }
    const localArgs = {
      data: localData,
      originalDoc: undefined,
      req: {
        payloadAPI: 'local',
        payload: {
          findByID: async () => ({
            id: 101,
            domain: 'operator-101.example.test',
            status: 'active',
          }),
        },
      },
    } as never
    const hostArgs = {
      data: { operator: 202 },
      originalDoc: undefined,
      req: {
        payloadAPI: 'REST',
        headers: new Headers({ host: 'operator-101.example.test' }),
        payload: {
          find: async () => ({
            docs: [{ id: 101, domain: 'operator-101.example.test', status: 'active' }],
          }),
        },
      },
    } as never

    await expect(ensureRequestHostOperator(localArgs)).resolves.toEqual(localData)
    await expect(ensureRequestHostOperator(hostArgs)).rejects.toThrow(
      'The assigned operator must match this request host.',
    )
  })

  it('scopes suspended-host static media file reads for assigned staff', async () => {
    const user = { id: 7, tenants: [{ operator: 101, role: 'admin' }] }

    await expect(
      getStaffAccessScope(
        accessArgs(user, 101, { filename: 'operator-logo.png' }, true, 'suspended'),
      ),
    ).resolves.toEqual({
      and: [{ operator: { equals: 101 } }, { operator: { in: [101] } }],
    })
  })
})
