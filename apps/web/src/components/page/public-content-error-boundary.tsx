'use client'

import { catchError, type ErrorInfo } from 'next/error'
import type { ReactNode } from 'react'

type PublicContentErrorBoundaryProps = {
  children?: ReactNode
  title?: string
}

function PublicContentErrorFallback(
  { title = 'Unable to load this content.' }: Omit<PublicContentErrorBoundaryProps, 'children'>,
  { retry }: ErrorInfo,
) {
  return (
    <div className="grid gap-3" data-testid="public-content-error" role="alert">
      <p className="m-0 text-lg text-muted">{title}</p>
      <button
        className="inline-flex min-h-10 w-fit items-center justify-center rounded-md bg-green px-4 font-bold text-white-soft"
        data-testid="public-content-retry"
        onClick={() => retry()}
        type="button"
      >
        Try again
      </button>
    </div>
  )
}

/** Recoverable boundary for public CMS content rendered by Server Components. */
export const PublicContentErrorBoundary = catchError<
  Omit<PublicContentErrorBoundaryProps, 'children'>
>(PublicContentErrorFallback)
