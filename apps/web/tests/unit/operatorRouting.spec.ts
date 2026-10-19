import { describe, expect, it } from 'vitest'

import {
  assertActiveOperator,
  normalizeOperatorHost,
  OperatorResolutionError,
} from '@/lib/operator'

describe('operator host routing', () => {
  it('canonicalizes a single Host value and rejects malformed routing inputs', () => {
    expect(normalizeOperatorHost('Club.Example.COM.:3000')).toBe('club.example.com')
    expect(normalizeOperatorHost('club.example.com')).toBe('club.example.com')

    for (const host of [
      null,
      '',
      ' club.example.com',
      'club.example.com,evil.test',
      'https://club.example.com',
    ]) {
      expect(normalizeOperatorHost(host)).toBeNull()
    }
  })

  it('allows public access for active operators and rejects suspended operators', () => {
    const active = { id: 101, name: 'Club', domain: 'club.example.com', status: 'active' as const }
    const suspended = {
      id: 202,
      name: 'Old Club',
      domain: 'old.example.com',
      status: 'suspended' as const,
    }

    expect(assertActiveOperator(active)).toBe(active)
    expect(() => assertActiveOperator(suspended)).toThrow(OperatorResolutionError)
  })
})
