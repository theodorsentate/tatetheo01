import { type ElementType } from 'react'
import { Anchor, CalendarDays, ClipboardList, Contact, House, MessagesSquare, Sailboat } from 'lucide-react'

/**
 * The director side has six sections. Each section's pages show as tabs at
 * the top of the page, so the sidebar stays short.
 */
export type Section = {
  id: string
  title: string
  icon: ElementType
  /** Where the sidebar link goes. */
  url: string
  tabs: { title: string; url: string }[]
  /** Other paths that belong to this section (detail pages). */
  match?: string[]
}

export const SECTIONS: Section[] = [
  { id: 'home', title: 'Home', icon: House, url: '/admin', tabs: [] },
  {
    id: 'schedule',
    title: 'Schedule',
    icon: CalendarDays,
    url: '/admin/calendar',
    tabs: [
      { title: 'Calendar', url: '/admin/calendar' },
      { title: 'Regattas', url: '/admin/regattas' },
      { title: 'Programs', url: '/admin/programs' },
      { title: 'Attendance', url: '/admin/attendance' },
    ],
    match: ['/admin/sessions'],
  },
  {
    id: 'registrations',
    title: 'Registrations',
    icon: ClipboardList,
    url: '/admin/registrations',
    tabs: [],
    match: ['/admin/registrations'],
  },
  {
    id: 'sailors',
    title: 'Sailors',
    icon: Sailboat,
    url: '/admin/sailors',
    tabs: [
      { title: 'Sailors', url: '/admin/sailors' },
      { title: 'Progress', url: '/admin/progress' },
      { title: 'Families', url: '/admin/families' },
    ],
  },
  {
    id: 'staff',
    title: 'Staff',
    icon: Contact,
    url: '/admin/directory',
    tabs: [
      { title: 'Directory', url: '/admin/directory' },
      { title: 'Certifications', url: '/admin/staff' },
      { title: 'Documents', url: '/admin/documents' },
    ],
  },
  {
    id: 'messages',
    title: 'Messages',
    icon: MessagesSquare,
    url: '/admin/inbox',
    tabs: [
      { title: 'Inbox', url: '/admin/inbox' },
      { title: 'Announcements', url: '/admin/messages' },
      { title: 'Forms & waivers', url: '/admin/forms' },
      { title: 'Incident reports', url: '/admin/incidents' },
    ],
  },
  {
    id: 'club',
    title: 'Club',
    icon: Anchor,
    url: '/admin/equipment',
    tabs: [
      { title: 'Boats', url: '/admin/equipment' },
      { title: 'Reports', url: '/admin/reports' },
      { title: 'Settings', url: '/admin/settings' },
    ],
  },
]

const clean = (p: string) => p.replace(/\/+$/, '') || '/'

export function sectionFor(pathname: string): Section | undefined {
  const path = clean(pathname)
  if (path === '/admin') return SECTIONS[0]
  return SECTIONS.slice(1).find(
    (s) => s.tabs.some((t) => path === t.url || path.startsWith(`${t.url}/`)) || s.match?.some((m) => path.startsWith(m))
  )
}
