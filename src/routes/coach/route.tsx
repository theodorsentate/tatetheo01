import { createFileRoute, Outlet } from '@tanstack/react-router'
import { MessageSquare, ShieldCheck, Sun } from 'lucide-react'
import { PhoneShell } from '@/components/burgee/phone-shell'

export const Route = createFileRoute('/coach')({
  component: function CoachLayout() {
    return (
      <PhoneShell
        tabs={[
          { to: '/coach', label: 'Today', icon: Sun, exact: true },
          { to: '/coach/certs', label: 'Certifications', icon: ShieldCheck },
          { to: '/coach/messages', label: 'Messages', icon: MessageSquare },
        ]}
        aside={{
          title: 'The coach view',
          body: (
            <>
              <p>Built for the dock: big buttons, one hand, bright sun.</p>
              <p>
                Roster takes attendance from arrival to pickup, with a live count of who is on the water. Plan holds
                today’s practice. Boats assigns hulls and coach boats. Skills is where coaches tick off what each sailor
                can do and write the evaluation parents read.
              </p>
            </>
          ),
        }}
      >
        <Outlet />
      </PhoneShell>
    )
  },
})
