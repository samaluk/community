import type { RichTextField, TextField } from 'payload'

/** Shared field builders for the public content collections, which all carry
 * a localized title, a unique slug, and a localized rich-text body. */

export const localizedTitleField = (): TextField => ({
  name: 'title',
  type: 'text',
  localized: true,
  required: true,
})

export const uniqueSlugField = (): TextField => ({
  name: 'slug',
  type: 'text',
  index: true,
  required: true,
})

export const localizedRichBodyField = (): RichTextField => ({
  name: 'body',
  type: 'richText',
  label: 'Body',
  localized: true,
  required: true,
})
