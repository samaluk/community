import { describe, expect, it } from 'vitest'

import { getInitialOperatorDomain } from '@/collections/operatorDomain'

describe('initial Operator domain', () => {
  it('requires an absolute server URL', () => {
    expect(() => getInitialOperatorDomain(undefined)).toThrow(
      'NEXT_PUBLIC_SERVER_URL is required to create the initial Operator.',
    )
    expect(() => getInitialOperatorDomain('not a URL')).toThrow(
      'NEXT_PUBLIC_SERVER_URL must be a valid absolute URL.',
    )
  })

  it('returns the lowercase canonical hostname without a trailing dot', () => {
    expect(getInitialOperatorDomain('https://Community.Example.COM./admin')).toBe(
      'community.example.com',
    )
  })

  it('rejects hostnames outside the canonical DNS hostname format', () => {
    const tooLongHostname = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`

    for (const serverURL of [
      'https://bad_host.example.com',
      'https://-bad.example.com',
      'https://bad-.example.com',
      `https://${tooLongHostname}`,
    ]) {
      expect(() => getInitialOperatorDomain(serverURL)).toThrow(
        'NEXT_PUBLIC_SERVER_URL must contain a valid canonical hostname.',
      )
    }
  })
})
