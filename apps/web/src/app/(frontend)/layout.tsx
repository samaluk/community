import type { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'

import { RefreshRouteOnSave } from '@/components/cms/RefreshRouteOnSave'
import { MobileNav } from '@/components/layout/MobileNav'
import { OfflineBanner } from '@/components/layout/OfflineBanner'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { getSiteSettings } from '@/lib/siteSettings'
import type { SiteSetting } from '@/payload-types'

import './styles.css'

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings()

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

function SiteFooter({ siteSettings }: { siteSettings: SiteSetting }) {
  return (
    <footer className="mx-auto flex max-w-280 flex-wrap items-center justify-between gap-4 border-t border-line p-6 text-sm text-muted">
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

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props
  const siteSettings = await getSiteSettings()

  return (
    <html lang={siteSettings.lang ?? 'en'} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <RefreshRouteOnSave />
          <SiteHeader brandName={siteSettings.brandName} />
          <OfflineBanner />
          <main>{children}</main>
          <SiteFooter siteSettings={siteSettings} />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
