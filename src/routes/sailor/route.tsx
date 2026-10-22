import { createFileRoute, Outlet } from '@tanstack/react-router'
import { MessageSquare, Sun } from 'lucide-react'
import { PERSONAS } from '@/data/catalog'
import { useUnreadCount } from '@/features/inbox/inbox'
import { PhoneShell } from '@/components/burgee/phone-shell'

export const Route = createFileRoute('/sailor')({
  component: function SailorLayout() {
    const unread = useUnreadCount(`sailor:${PERSONAS.sailorId}`)
    return (
      <PhoneShell
        tabs={[
          { to: '/sailor', label: 'Today', icon: Sun, exact: true },
          { to: '/sailor/messages', label: 'Messages', icon: MessageSquare, badge: unread },
        ]}
        aside={{
          title: 'The sailor view',
          body: (
            <>
              <p>Older sailors get their own login: today’s call and plan, their skills and their coach’s evaluation.</p>
              <p>They can message their coaches directly. Their parents are copied on every conversation automatically, which is what SafeSport requires.</p>
            </>
          ),
        }}
      >
        <Outlet />
      </PhoneShell>
    )
  },
})
