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
              <p>Built for the dock: big type, one hand, bright sun.</p>
              <p>
                Coaches see only their own groups, with allergies and medical notes up front, a tap-to-call for every
                guardian, and a one-tap weather call to their families.
              </p>
              <p>Certification renewals get uploaded here, so the director never chases paper cards again.</p>
            </>
          ),
        }}
      >
        <Outlet />
      </PhoneShell>
    )
  },
})
