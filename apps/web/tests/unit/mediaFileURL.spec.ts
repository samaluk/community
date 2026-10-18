import { describe, expect, it } from 'vitest'

import { getMediaFileURL } from '@/lib/mediaFileURL'

describe('media file URLs', () => {
  it('returns local file paths relative to the current Operator origin', () => {
    expect(
      getMediaFileURL({
        apiRoute: '/api',
        filename: 'operator-b image.png',
        serverURL: 'https://primary.example.test',
        value: 'https://primary.example.test/api/media/file/operator-b%20image.png',
      }),
    ).toBe('/api/media/file/operator-b%20image.png')
  })

  it('recognizes local relative media paths and filename-only data', () => {
    expect(
      getMediaFileURL({
        apiRoute: '/api',
        filename: 'operator-b.png',
        value: '/api/media/file/old-name.png',
      }),
    ).toBe('/api/media/file/operator-b.png')
    expect(getMediaFileURL({ apiRoute: '/api', filename: 'operator-b.png' })).toBe(
      '/api/media/file/operator-b.png',
    )
  })

  it('keeps Vercel Blob URLs external', () => {
    const blobURL = 'https://abc.public.blob.vercel-storage.com/operator-b.png'

    expect(
      getMediaFileURL({
        apiRoute: '/api',
        filename: 'operator-b.png',
        serverURL: 'https://primary.example.test',
        value: blobURL,
      }),
    ).toBe(blobURL)
  })

  it('preserves URLs that only share the configured hostname prefix or media path', () => {
    const externalURLs = [
      'https://primary.example.test.evil/api/media/file/operator-b.png',
      '//cdn.example.test/api/media/file/operator-b.png',
      'https://other.example.test/api/media/file/operator-b.png',
      'https://primary.example.test.evil/api/media/file/operator-b.png?download=1',
      'https://primary.example.test/another-route/operator-b.png',
    ]

    for (const value of externalURLs) {
      expect(
        getMediaFileURL({
          apiRoute: '/api',
          filename: 'operator-b.png',
          serverURL: 'https://primary.example.test',
          value,
        }),
      ).toBe(value)
    }
  })

  it('returns null when no file URL or filename exists', () => {
    expect(getMediaFileURL({ apiRoute: '/api' })).toBeNull()
    expect(getMediaFileURL({ apiRoute: '/api', filename: { id: 1 } })).toBeNull()
  })
})
