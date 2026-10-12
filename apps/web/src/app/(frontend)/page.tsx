import Link from 'next/link'
import config from '@payload-config'
import { cacheLife } from 'next/cache'
import { draftMode } from 'next/headers'
import { Suspense } from 'react'
import { getPayload } from 'payload'

import {
  HomeHeroContent,
  HomeHeroVideo,
  PageKicker,
  PageLede,
  PageShell,
  PageTitle,
} from '@/components/page'
import { buttonVariants } from '@/components/ui/button-variants'
import { getCmsQueryOptions } from '@/lib/cmsQuery'
import { getSiteSettings } from '@/lib/siteSettings'
import { cn } from '@/lib/utils'
import { isPayloadUnavailableError } from '@/lib/payloadUnavailableError'
import type { HomePage as HomePageGlobal, Media, SiteSetting } from '@/payload-types'

function getMediaUrl(media: number | Media | null | undefined) {
  if (!media || typeof media === 'number') {
    return undefined
  }

  return media.url ?? undefined
}

async function getPublishedHomePageContent(): Promise<HomePageGlobal | null> {
  'use cache'
  cacheLife('publicContent')

  try {
    const payload = await getPayload({ config })

    return await payload.findGlobal({
      slug: 'home-page',
      depth: 1,
      draft: false,
      overrideAccess: false,
    })
  } catch (error) {
    if (!isPayloadUnavailableError(error)) {
      console.error('Failed to load home page content', error)
    }

    return null
  }
}

async function getDraftHomePageContent(): Promise<HomePageGlobal | null> {
  try {
    const payload = await getPayload({ config })
    const cmsQuery = await getCmsQueryOptions()

    return await payload.findGlobal({
      slug: 'home-page',
      depth: 1,
      ...cmsQuery,
    })
  } catch (error) {
    if (!isPayloadUnavailableError(error)) {
      console.error('Failed to load home page content', error)
    }

    return null
  }
}

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageContent />
    </Suspense>
  )
}

async function HomePageContent() {
  const { isEnabled: draft } = await draftMode()
  const [homePage, siteSettings] = await Promise.all([
    draft ? getDraftHomePageContent() : getPublishedHomePageContent(),
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
  siteSettings: SiteSetting
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
