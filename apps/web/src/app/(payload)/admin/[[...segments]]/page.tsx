/* Payload integration wrapper: preserve the request boundary when regenerating. */
import type { Metadata } from 'next'
import { connection } from 'next/server'

import config from '@payload-config'
import { RootPage, generatePageMetadata } from '@payloadcms/next/views'
import { importMap } from '../importMap'

type Args = {
  params: Promise<{
    segments: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}

export const generateMetadata = async ({ params, searchParams }: Args): Promise<Metadata> => {
  await connection()
  return generatePageMetadata({ config, params, searchParams })
}

const Page = async ({ params, searchParams }: Args) => {
  await connection()
  return RootPage({ config, params, searchParams, importMap })
}

export default Page
