/** Collections whose published documents are rendered by public slug routes. */
export type PublicContentCollection = 'places' | 'articles' | 'products'

export const emptyPublicContentSlug = '__no-published-content__'

/** Cache tag for one published public document lookup. */
export function getPublicContentDocCacheTag(collection: string, slug: string) {
  return `public-content:${collection}:${slug}`
}

/** Cache tag shared by a public collection's listing and slug enumeration. */
export function getPublicContentCollectionCacheTag(collection: string) {
  return `public-content:${collection}`
}

/** Ensure Cache Components receives one param even for an empty collection. */
export function getPublicContentStaticParams(slugs: string[]) {
  return slugs.length > 0 ? slugs.map((slug) => ({ slug })) : [{ slug: emptyPublicContentSlug }]
}
