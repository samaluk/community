import { Suspense } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { PageKicker, PageLede, PageShell, PageTitle } from '@/components/page'
import { Spinner } from '@/components/ui/spinner'
import { getSiteSettings } from '@/lib/siteSettings'

import { VerifyForm } from './VerifyForm'

export const metadata = { title: 'Verify Membership' }

export default function VerifyPage() {
  return (
    <PageShell className="grid grid-cols-verify items-start gap-8 max-[760px]:grid-cols-1 max-[760px]:gap-4">
      <div>
        <PageKicker>Membership</PageKicker>
        <PageTitle>Verify active membership.</PageTitle>
        <PageLede>
          Enter a member identifier to confirm active community membership status. The public result
          never exposes member names or internal details.
        </PageLede>
      </div>
      <Suspense fallback={<VerifyFormFallback />}>
        <OperatorVerifyForm />
      </Suspense>
    </PageShell>
  )
}

async function OperatorVerifyForm() {
  const siteSettings = await getSiteSettings()

  return <VerifyForm identifierType={siteSettings.memberIdentifierType} />
}

function VerifyFormFallback() {
  return (
    <Card aria-busy="true" className="shadow-card" size="sm">
      <CardContent>
        <output className="flex min-h-24 items-center justify-center gap-2 text-muted">
          <Spinner />
          <span>Loading membership verification options…</span>
        </output>
      </CardContent>
    </Card>
  )
}
