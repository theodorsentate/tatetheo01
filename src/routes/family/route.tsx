import { createFileRoute, Outlet } from '@tanstack/react-router'
import { CalendarDays, Home, MessageSquare } from 'lucide-react'
import { PERSONAS } from '@/data/catalog'
import { useFamilyPending, useKidRegattas } from '@/features/family/home'
import { useUnreadCount } from '@/features/inbox/inbox'
import { PhoneShell } from '@/components/burgee/phone-shell'

export const Route = createFileRoute('/family')({
  component: function FamilyLayout() {
    const forms = useFamilyPending().length
    const regattas = useKidRegattas()
    const asks = regattas.reduce((n, r) => n + [...r.eligible].filter((id) => !r.responses.get(id)).length, 0)
    const unread = useUnreadCount(`family:${PERSONAS.familyId}`)
    return (
      <PhoneShell
        tabs={[
          { to: '/family', label: 'Home', icon: Home, exact: true, badge: forms + asks },
          { to: '/family/schedule', label: 'Schedule', icon: CalendarDays },
          { to: '/family/messages', label: 'Messages', icon: MessageSquare, badge: unread },
        ]}
        aside={{
          title: 'The parent view',
          body: (
            <>
              <p>One place for everything about each kid, instead of five apps and a group chat.</p>
              <p>
                Is sailing on today, is my kid on the water, what do I need to sign, who is in their group, and how are
                they doing: all on one screen.
              </p>
              <p>Out sick, running late or Grandma picking up? Two taps and the coaches know. Questions go straight to the coach or director.</p>
            </>
          ),
        }}
      >
        <Outlet />
      </PhoneShell>
    )
  },
})
