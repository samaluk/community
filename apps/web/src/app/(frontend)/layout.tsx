import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import React, { cache, Suspense } from 'react'

import { RefreshRouteOnSave } from '@/components/cms/RefreshRouteOnSave'
import { MobileNav } from '@/components/layout/MobileNav'
import { OfflineBanner } from '@/components/layout/OfflineBanner'
import { OperatorLanguage } from '@/components/layout/OperatorLanguage'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { env } from '@/env'
import { OperatorResolutionError } from '@/lib/operator'
import { DEFAULT_SITE_SETTINGS, getSiteSettings, type PublicSiteSettings } from '@/lib/siteSettings'

import './styles.css'

const getLayoutSiteSettings = cache(async () => {
  try {
    return await getSiteSettings()
  } catch (error) {
    if (error instanceof OperatorResolutionError) notFound()
    throw error
  }
})

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getLayoutSiteSettings()

  return {
    description: siteSettings.siteDescription ?? undefined,
    openGraph: {
      locale: siteSettings.defaultLocale ?? 'en',
    },
    title: {
      default: siteSettings.brandName,
      template: `%s · ${siteSettings.brandName}`,
    },
  }
}

const navItems = [
  { href: '/places', label: 'Lugares' },
  { href: '/articles', label: 'Articles' },
  { href: '/verify', label: 'Verify' },
  { href: '/products', label: 'Products' },
]

function SiteHeader({ brandName }: { brandName: string }) {
  return (
    <header className="site-header">
      <Link className="font-extrabold no-underline max-[760px]:text-lg" href="/">
        {brandName}
      </Link>
      <nav
        className="flex flex-wrap justify-end gap-4 text-sm text-muted max-[760px]:hidden"
        aria-label="Principal"
      >
        {navItems.map((item) => (
          <Link className="no-underline" href={item.href} key={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <MobileNav items={navItems} />
    </header>
  )
}

function SocialLink({ href, label }: { href: string | null | undefined; label: string }) {
  if (!href) return null
  return (
    <a
      className="no-underline hover:underline"
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {label}
    </a>
  )
}

function SiteFooter({ siteSettings }: { siteSettings: PublicSiteSettings }) {
  return (
    <footer className="mx-auto flex max-w-280 flex-wrap items-center justify-between gap-4 border-bs border-line p-6 text-sm text-muted">
      <span>{siteSettings.brandName}</span>
      <div className="flex gap-4">
        <Link className="no-underline hover:underline" href="/privacy">
          Privacy
        </Link>
        <SocialLink href={siteSettings.instagramUrl} label="Instagram" />
        <SocialLink href={siteSettings.whatsappUrl} label="WhatsApp" />
      </div>
    </footer>
  )
}

async function OperatorHeader() {
  const [siteSettings, requestHeaders] = await Promise.all([getLayoutSiteSettings(), headers()])
  const lang = siteSettings.lang || 'en'
  const protocol = new URL(env.NEXT_PUBLIC_SERVER_URL).protocol
  const serverURL = new URL(`${protocol}//${requestHeaders.get('host')}`).origin

  return (
    <div lang={lang}>
      <OperatorLanguage lang={lang} />
      <RefreshRouteOnSave serverURL={serverURL} />
      <SiteHeader brandName={siteSettings.brandName} />
    </div>
  )
}

async function OperatorFooter() {
  const siteSettings = await getLayoutSiteSettings()

  return (
    <div lang={siteSettings.lang || 'en'}>
      <SiteFooter siteSettings={siteSettings} />
    </div>
  )
}

export default function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <Suspense fallback={<SiteHeader brandName="Community" />}>
            <OperatorHeader />
          </Suspense>
          <OfflineBanner />
          <main>{children}</main>
          <Suspense fallback={<SiteFooter siteSettings={DEFAULT_SITE_SETTINGS} />}>
            <OperatorFooter />
          </Suspense>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
