import './src/env'

import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Share each route's shell across header, mobile, and content links.
  partialPrefetching: true,
  cacheLife: {
    publicContent: {
      expire: 86_400,
      revalidate: 900,
      stale: 900,
    },
  },
  reactCompiler: true,
  experimental: {
    useOffline: true,
    // TypeScript 7 has no JS compiler API; use the project-local tsc CLI.
    // https://nextjs.org/docs/app/api-reference/config/typescript#using-typescript-7
    useTypeScriptCli: true,
    // Run React Compiler natively in Turbopack instead of through Babel.
    turbopackRustReactCompiler: true,
    // Instant-navigation e2e verdicts come from production builds only; never
    // in real production. See instant-nav.rig.md.
    exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === '1',
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    // oxlint-disable-next-line typescript/no-unsafe-member-access
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    // oxlint-disable-next-line typescript/no-unsafe-return
    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname, '../..'),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
