import { useMemo } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { CalendarDays, Home, MessageSquare, Sailboat } from 'lucide-react'
import { PERSONAS } from '@/data/catalog'
import { familyRegs } from '@/data/hooks'
import { useStore } from '@/data/store'
import { useFamilyPending } from '@/features/family/home'
import { PhoneShell } from '@/components/burgee/phone-shell'

export const Route = createFileRoute('/family')({
  component: function FamilyLayout() {
    const cart = useStore((s) => s.cart)
    const regs = useStore((s) => s.registrations)
    const sailors = useStore((s) => s.sailors)
    const forms = useFamilyPending().length
    const todo = useMemo(
      () => familyRegs(regs, sailors, PERSONAS.familyId).filter((r) => r.status === 'offered' || r.status === 'pending-payment').length,
      [regs, sailors]
    )
    return (
      <PhoneShell
        tabs={[
          { to: '/family', label: 'Home', icon: Home, exact: true, badge: todo + forms },
          { to: '/family/schedule', label: 'Schedule', icon: CalendarDays },
          { to: '/family/register', label: 'Sign up', icon: Sailboat, badge: cart.length },
          { to: '/family/messages', label: 'Messages', icon: MessageSquare },
        ]}
        aside={{
          title: 'The parent view',
          body: (
            <>
              <p>One place for everything about each kid, instead of five apps and a group chat.</p>
              <p>
                Is practice on today, is my kid on the water, what do I need to sign or pay, are we going to the
                regatta, and how is my kid doing: all on one screen.
              </p>
              <p>Texts and emails still go out. The app is where it all lives afterwards.</p>
            </>
          ),
        }}
      >
        <Outlet />
      </PhoneShell>
    )
  },
})
