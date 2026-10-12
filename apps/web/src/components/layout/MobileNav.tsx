import Link from 'next/link'

export type NavItem = {
  href: string
  label: string
}

export function MobileNav({ items }: { items: NavItem[] }) {
  return (
    <details className="mobile-nav-details">
      <summary
        className="grid size-9 cursor-pointer list-none place-items-center rounded-md border border-line bg-white-soft open:fixed open:inset-e-3 open:inset-bs-2 open:z-30"
        aria-label="Abrir navegacion"
      >
        <span className="mobile-nav-bar" />
        <span className="mobile-nav-bar" />
        <span className="mobile-nav-bar" />
      </summary>
      <div className="mobile-nav-panel">
        <div className="mobile-nav-label">Navegacion</div>
        <nav className="grid gap-1" aria-label="Principal movil">
          {items.map((item) => (
            <Link
              className="border-be border-line py-3 text-base font-extrabold no-underline"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </details>
  )
}
