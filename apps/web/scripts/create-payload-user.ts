import { getPayload, type Payload } from 'payload'

import { loadEnvForScript } from './loadScriptEnv.js'
import {
  provisionStaffUser,
  type StaffProvisioningPort,
  type StaffUserData,
} from './staffProvisioning.js'

loadEnvForScript()
await import('../src/env.js')

const getRequiredEnv = (name: string) => {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required`)
  }

  return value
}

function payloadPort(payload: Payload): StaffProvisioningPort {
  return {
    async findUserByEmail(email) {
      const { docs } = await payload.find({
        collection: 'users',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { email: { equals: email } },
      })
      return docs[0] ?? null
    },
    async assertOperatorExists(operatorId) {
      await payload.findByID({
        collection: 'operators',
        id: operatorId,
        depth: 0,
        overrideAccess: true,
      })
    },
    async createUser(data: StaffUserData) {
      if (!data.email) throw new Error('CMS_USER_EMAIL is required')
      await payload.create({
        collection: 'users',
        data: { ...data, email: data.email },
        overrideAccess: true,
      })
    },
    async updateUser(id, data: StaffUserData) {
      await payload.update({
        collection: 'users',
        id,
        data,
        overrideAccess: true,
      })
    },
  }
}

async function provisionUser(payload: Payload) {
  const email = getRequiredEnv('CMS_USER_EMAIL').toLowerCase()
  const result = await provisionStaffUser(payloadPort(payload), {
    email,
    password: getRequiredEnv('CMS_USER_PASSWORD'),
    operatorId: process.env.CMS_OPERATOR_ID,
    role: process.env.CMS_USER_ROLE,
    grantPlatformAdmin: process.env.CMS_PLATFORM_ADMIN === 'true',
    updateExisting: process.env.CMS_USER_UPDATE_EXISTING === 'true',
  })

  console.log(`${result === 'updated' ? 'Updated' : 'Created'} Payload staff user ${email}.`)
}

const main = async () => {
  const { default: config } = await import('@payload-config')
  const payload = await getPayload({ config })
  try {
    await provisionUser(payload)
  } finally {
    await payload.destroy()
  }
}

main()
  // Payload can retain an adapter-owned handle after destroy; all writes and
  // cleanup have completed when this short-lived provisioning command exits.
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
