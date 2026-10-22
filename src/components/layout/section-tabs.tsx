import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { sectionFor } from './data/sidebar-data'

/** Tabs for the pages inside the current director section. */
export function SectionTabs() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const section = sectionFor(pathname)
  if (!section || section.tabs.length < 2) return null
  const isActive = (url: string) =>
    pathname === url || pathname.startsWith(`${url}/`) || (url === '/admin/programs' && pathname.startsWith('/admin/sessions'))
  return (
    <nav aria-label={section.title} className='-mt-2 mb-6 overflow-x-auto border-b'>
      <ul className='flex min-w-max gap-1'>
        {section.tabs.map((t) => {
          const active = isActive(t.url)
          return (
            <li key={t.url}>
              <Link
                to={t.url}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors',
                  active ? 'border-brass text-heading' : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {t.title}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
