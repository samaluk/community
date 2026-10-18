import { describe, expect, it } from 'vitest'

import {
  getPublicContentCollectionCacheTag,
  getPublicContentDocCacheTag,
} from '@/lib/publicContentCache'

describe('operator-scoped public content cache tags', () => {
  it('keeps same-slug content and collection entries separate between operators', () => {
    expect(getPublicContentDocCacheTag(101, 'articles', 'same-slug')).not.toBe(
      getPublicContentDocCacheTag(202, 'articles', 'same-slug'),
    )
    expect(getPublicContentCollectionCacheTag(101, 'articles')).not.toBe(
      getPublicContentCollectionCacheTag(202, 'articles'),
    )
  })
})
