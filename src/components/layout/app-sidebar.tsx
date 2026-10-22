import { useMemo } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { CERT_TYPES } from '@/data/catalog'
import { useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import { coachCertRows, coachCertSummary } from '@/domain/rules'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { BurgeeMark } from '@/components/burgee/marks'
import { RoleSwitcher } from '@/components/burgee/role-switcher'
import { useUnreadCount } from '@/features/inbox/inbox'
import { SECTIONS, sectionFor } from './data/sidebar-data'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const coaches = useStore((s) => s.coaches)
  const settings = useStore((s) => s.settings)
  const incidents = useStore((s) => s.incidents)
  const boats = useStore((s) => s.boats)
  const now = useNow(60_000)
  const unread = useUnreadCount('director')

  const pathname = useLocation({ select: (l) => l.pathname })
  const current = sectionFor(pathname)
  const { setOpenMobile } = useSidebar()

  // Only flag sections where something is actually wrong.
  const badges = useMemo<Record<string, number>>(() => {
    return {
      staff: coaches.filter((c) => coachCertSummary(coachCertRows(c, CERT_TYPES, now, settings.certWarningDays)) !== 'valid').length,
      messages: unread + incidents.filter((i) => i.status === 'open').length,
      club: boats.filter((b) => b.status !== 'ready').length,
    }
  }, [coaches, settings, now, incidents, boats, unread])
  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader className='px-3 pt-4'>
        <Link to='/admin' className='flex items-center gap-2.5 rounded-md px-1 py-1 text-sidebar-primary'>
          <BurgeeMark className='size-8 shrink-0 text-heading' />
          <span className='grid leading-tight group-data-[collapsible=icon]:hidden'>
            <span className='font-display text-base font-semibold'>Burgee</span>
            <span className='truncate text-xs text-sidebar-foreground'>{settings.clubName}</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className='pt-4'>
          <SidebarMenu className='gap-1'>
            {SECTIONS.map((sec) => (
              <SidebarMenuItem key={sec.id}>
                <SidebarMenuButton asChild size='lg' isActive={current?.id === sec.id} tooltip={sec.title} className='h-10 text-[15px]'>
                  <Link to={sec.url} onClick={() => setOpenMobile(false)}>
                    <sec.icon />
                    <span>{sec.title}</span>
                    {!!badges[sec.id] && (
                      <span className='ms-auto rounded-full bg-signal/15 px-1.5 text-[11px] font-semibold text-signal' aria-label={`${badges[sec.id]} need attention`}>
                        {badges[sec.id]}
                      </span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className='border-t border-sidebar-border group-data-[collapsible=icon]:hidden'>
        <RoleSwitcher className='w-full' />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
