import { Link, useLocation } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useStore } from '@/data/store'
import { BurgeeMark } from './marks'
import { RoleSwitcher } from './role-switcher'

export type PhoneTab = {
  to: string
  label: string
  icon: React.ElementType
  badge?: number
  exact?: boolean
}

/**
 * Phone-first layout for coaches and parents. Full-screen on a phone; on a
 * laptop it sits in a device-sized column with a short explainer beside it,
 * so the demo reads correctly when pitched from a big screen.
 */
export function PhoneShell({
  tabs,
  children,
  aside,
}: {
  tabs: PhoneTab[]
  children: React.ReactNode
  aside: { title: string; body: React.ReactNode }
}) {
  const path = useLocation({ select: (l) => l.pathname })
  const clubName = useStore((s) => s.settings.clubName)
  return (
    <div className='min-h-svh bg-background md:flex md:items-center md:justify-center md:gap-16 md:bg-mist md:p-6'>
      <aside className='hidden max-w-xs text-muted-foreground lg:block'>
        <BurgeeMark className='size-10 text-heading' />
        <h2 className='mt-6 text-2xl font-semibold'>{aside.title}</h2>
        <div className='mt-3 space-y-3 text-sm leading-relaxed'>{aside.body}</div>
        <div className='mt-8 rounded-lg border bg-card p-1 shadow-[var(--shadow-card)]'>
          <RoleSwitcher className='w-full' />
        </div>
      </aside>

      <div className='relative flex min-h-svh w-full flex-col bg-background md:h-[min(860px,calc(100svh-3rem))] md:min-h-0 md:max-w-[400px] md:overflow-hidden md:rounded-[2.25rem] md:border md:border-border md:shadow-[0_40px_80px_-30px_rgb(20_53_90/0.45)] md:ring-[10px] md:ring-card'>
        <header className='sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 px-4 py-2.5 backdrop-blur'>
          <BurgeeMark className='size-6 text-heading' />
          <span className='min-w-0 flex-1 truncate text-sm font-semibold'>{clubName}</span>
          <div className='lg:hidden'>
            <RoleSwitcher className='py-1' />
          </div>
        </header>
        <main id='content' className='flex-1 overflow-y-auto pb-24 md:pb-20'>
          {children}
        </main>
        <nav
          aria-label='Primary'
          className='fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:absolute'
        >
          <ul className='grid' style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map((t) => {
              const active = t.exact ? path === t.to || path === `${t.to}/` : path.startsWith(t.to)
              return (
                <li key={t.to}>
                  <Link
                    to={t.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground',
                      active && 'text-primary'
                    )}
                  >
                    <span className='relative'>
                      <t.icon className='size-5' aria-hidden='true' />
                      {!!t.badge && (
                        <span className='absolute -end-2 -top-1.5 min-w-4 rounded-full bg-burgee px-1 text-center text-[10px] leading-4 font-semibold text-white'>
                          {t.badge}
                        </span>
                      )}
                    </span>
                    {t.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </div>
  )
}
