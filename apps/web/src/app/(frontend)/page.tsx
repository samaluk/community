import Link from 'next/link'
import { draftMode } from 'next/headers'
import { Suspense } from 'react'

import {
  HomeHeroContent,
  HomeHeroVideo,
  PageKicker,
  PageLede,
  PageShell,
  PageTitle,
} from '@/components/page'
import { buttonVariants } from '@/components/ui/button-variants'
import { getHomePageContent } from '@/lib/homePageContent'
import { assertActiveOperator, getRequestOperator } from '@/lib/operator'
import { getSiteSettings, type PublicSiteSettings } from '@/lib/siteSettings'
import { cn } from '@/lib/utils'
import type { Media } from '@/payload-types'

function getMediaUrl(media: number | Media | null | undefined) {
  if (!media || typeof media === 'number') {
    return undefined
  }

  return media.url ?? undefined
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  )
}

async function HomePageContent() {
  const [resolvedOperator, { isEnabled: draft }] = await Promise.all([
    getRequestOperator(),
    draftMode(),
  ])
  const operator = assertActiveOperator(resolvedOperator)
  const [homePage, siteSettings] = await Promise.all([
    getHomePageContent(operator.id, operator.domain, draft),
    getSiteSettings(),
  ])

  return <HomePageView heroVideo={homePage?.heroVideo} siteSettings={siteSettings} />
}

function HomeHeroCtas() {
  return (
    <div className="mbs-5 flex flex-wrap gap-2">
      <Link
        className={cn(buttonVariants(), 'min-h-10 px-4 font-bold')}
        data-testid="home-verify-cta"
        href="/verify"
        prefetch={true}
      >
        Verify membership
      </Link>
      <Link
        className={cn(buttonVariants({ variant: 'outline' }), 'min-h-10 px-4 font-bold')}
        href="/places"
      >
        Ver lugares
      </Link>
    </div>
  )
}

function HomeHeroVideoBg({ heroVideo }: { heroVideo: number | Media | null | undefined }) {
  const heroVideoUrl = getMediaUrl(heroVideo)
  if (!heroVideoUrl) return null
  return <HomeHeroVideo src={heroVideoUrl} />
}

function HomePageView({
  heroVideo,
  siteSettings,
}: {
  heroVideo: number | Media | null | undefined
  siteSettings: PublicSiteSettings
}) {
  return (
    <PageShell variant="hero">
      <HomeHeroVideoBg heroVideo={heroVideo} />
      <HomeHeroContent>
        <PageKicker tone="hero">Community</PageKicker>
        <PageTitle size="hero">{siteSettings.brandName}</PageTitle>
        <PageLede>{siteSettings.siteDescription}</PageLede>
        <HomeHeroCtas />
      </HomeHeroContent>
    </PageShell>
  )
}
