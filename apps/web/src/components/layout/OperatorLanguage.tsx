'use client'

import { useEffect } from 'react'

/** Keep the shared static shell while applying the resolved Operator's language. */
export function OperatorLanguage({ lang }: { lang: string }) {
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  return null
}
