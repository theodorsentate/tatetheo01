import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { CERT_TYPES, FORM_TEMPLATES } from '@/data/catalog'
import { useNow } from '@/data/hooks'
import { useStore } from '@/data/store'
import { ACTIVE_STATUSES } from '@/domain/pricing'
import { coachCertRows, coachCertSummary, outstandingForms } from '@/domain/rules'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { BurgeeMark } from '@/components/burgee/marks'
import { RoleSwitcher } from '@/components/burgee/role-switcher'
import { adminNav } from './data/sidebar-data'
import { NavGroup } from './nav-group'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const regs = useStore((s) => s.registrations)
  const coaches = useStore((s) => s.coaches)
  const sailors = useStore((s) => s.sailors)
  const submissions = useStore((s) => s.submissions)
  const settings = useStore((s) => s.settings)
  const now = useNow(60_000)

  const nav = useMemo(() => {
    const active = new Set(regs.filter((r) => ACTIVE_STATUSES.has(r.status)).map((r) => r.sailorId))
    return adminNav({
      waitlist: regs.filter((r) => r.status === 'waitlisted').length,
      certIssues: coaches.filter(
        (c) => coachCertSummary(coachCertRows(c, CERT_TYPES, now, settings.certWarningDays)) !== 'valid'
      ).length,
      outstandingForms: sailors.filter(
        (s) => active.has(s.id) && outstandingForms(s, FORM_TEMPLATES, submissions, settings.season).length > 0
      ).length,
    })
  }, [regs, coaches, sailors, submissions, settings, now])

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader className='px-3 pt-4'>
        <Link to='/admin' className='flex items-center gap-2.5 rounded-md px-1 py-1 text-sidebar-primary'>
          <BurgeeMark className='size-8 shrink-0' />
          <span className='grid leading-tight group-data-[collapsible=icon]:hidden'>
            <span className='font-display text-base font-bold'>Burgee</span>
            <span className='truncate text-xs text-sidebar-foreground'>{settings.clubName}</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {nav.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter className='border-t border-sidebar-border group-data-[collapsible=icon]:hidden'>
        <RoleSwitcher variant='dark' className='w-full' />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
