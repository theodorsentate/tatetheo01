import {
  Anchor,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Contact,
  FileSpreadsheet,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  ListOrdered,
  Megaphone,
  Sailboat,
  Settings,
  ShieldCheck,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react'
import { type NavGroup } from '../types'

export function adminNav(badges: {
  waitlist: number
  certIssues: number
  outstandingForms: number
  openIncidents?: number
  boatIssues?: number
  missingDocs?: number
}): NavGroup[] {
  const b = (n?: number) => (n && n > 0 ? String(n) : undefined)
  return [
    {
      title: 'Season',
      items: [
        { title: 'Today', url: '/admin', icon: LayoutDashboard },
        { title: 'Calendar', url: '/admin/calendar', icon: CalendarDays },
        { title: 'Programs & sessions', url: '/admin/programs', icon: CalendarRange },
        { title: 'Registrations', url: '/admin/registrations', icon: ListOrdered, badge: b(badges.waitlist) },
        { title: 'Attendance', url: '/admin/attendance', icon: ListChecks },
      ],
    },
    {
      title: 'People',
      items: [
        { title: 'Families', url: '/admin/families', icon: Users },
        { title: 'Sailors', url: '/admin/sailors', icon: Sailboat },
        { title: 'Staff directory', url: '/admin/directory', icon: Contact },
        { title: 'Certifications', url: '/admin/staff', icon: ShieldCheck, badge: b(badges.certIssues) },
      ],
    },
    {
      title: 'Communication',
      items: [
        { title: 'Messages', url: '/admin/messages', icon: Megaphone },
        { title: 'Forms & waivers', url: '/admin/forms', icon: ClipboardCheck, badge: b(badges.outstandingForms) },
        { title: 'Documents', url: '/admin/documents', icon: FolderOpen, badge: b(badges.missingDocs) },
        { title: 'Incident reports', url: '/admin/incidents', icon: TriangleAlert, badge: b(badges.openIncidents) },
      ],
    },
    {
      title: 'Club',
      items: [
        { title: 'Boats & equipment', url: '/admin/equipment', icon: Anchor, badge: b(badges.boatIssues) },
        { title: 'Payments', url: '/admin/payments', icon: Wallet },
        { title: 'Reports', url: '/admin/reports', icon: FileSpreadsheet },
        { title: 'Settings', url: '/admin/settings', icon: Settings },
      ],
    },
  ]
}
