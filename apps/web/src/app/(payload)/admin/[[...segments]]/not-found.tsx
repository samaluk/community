/* Payload integration wrapper: preserve the request boundary when regenerating. */
import type { Metadata } from 'next'
import { connection } from 'next/server'

import config from '@payload-config'
import { NotFoundPage, generatePageMetadata } from '@payloadcms/next/views'
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

const NotFound = async ({ params, searchParams }: Args) => {
  await connection()
  return NotFoundPage({ config, params, searchParams, importMap })
}

export default NotFound
