import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

function PageGrid({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'mbs-6 grid grid-cols-page-cards gap-3 max-[760px]:mbs-4 max-[760px]:grid-cols-1 max-[760px]:gap-2',
        className,
      )}
      {...props}
    />
  )
}

export { PageGrid }
