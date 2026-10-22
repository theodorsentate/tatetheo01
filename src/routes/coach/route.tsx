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
                Coaches take attendance as sailors arrive, launch them, and bring everyone ashore with a live count of
                who is still on the water. Nobody launches without a passed swim check, and sailors only go home with
                someone on their family’s pickup list.
              </p>
              <p>Allergies, parent notes and a tap-to-call for every guardian sit right on the roster.</p>
            </>
          ),
        }}
      >
        <Outlet />
      </PhoneShell>
    )
  },
})
