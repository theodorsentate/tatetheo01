import {
  CalendarRange,
  ClipboardCheck,
  LayoutDashboard,
  ListOrdered,
  Megaphone,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { type NavGroup } from '../types'

export function adminNav(badges: {
  waitlist: number
  certIssues: number
  outstandingForms: number
}): NavGroup[] {
  const b = (n: number) => (n > 0 ? String(n) : undefined)
  return [
    {
      title: 'Season',
      items: [
        { title: 'Today', url: '/admin', icon: LayoutDashboard },
        { title: 'Programs & sessions', url: '/admin/programs', icon: CalendarRange },
        { title: 'Registrations', url: '/admin/registrations', icon: ListOrdered, badge: b(badges.waitlist) },
      ],
    },
    {
      title: 'People',
      items: [
        { title: 'Families', url: '/admin/families', icon: Users },
        { title: 'Staff & certifications', url: '/admin/staff', icon: ShieldCheck, badge: b(badges.certIssues) },
      ],
    },
    {
      title: 'Communication',
      items: [
        { title: 'Messages', url: '/admin/messages', icon: Megaphone },
        { title: 'Forms & waivers', url: '/admin/forms', icon: ClipboardCheck, badge: b(badges.outstandingForms) },
      ],
    },
    {
      title: 'Club',
      items: [{ title: 'Settings', url: '/admin/settings', icon: Settings }],
    },
  ]
}
