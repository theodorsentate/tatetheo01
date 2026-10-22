import { useMemo } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ClipboardList, Home, MessageSquare, Sailboat } from 'lucide-react'
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
          { to: '/family', label: 'Home', icon: Home, exact: true, badge: todo },
          { to: '/family/register', label: 'Sign up', icon: Sailboat, badge: cart.length },
          { to: '/family/forms', label: 'Forms', icon: ClipboardList, badge: forms },
          { to: '/family/messages', label: 'Messages', icon: MessageSquare },
        ]}
        aside={{
          title: 'The parent view',
          body: (
            <>
              <p>Most parents register from their phone, often the minute registration opens.</p>
              <p>
                Burgee shows only the programs each child is eligible for, prices siblings and multi-week bookings
                automatically, and turns a full week into a waitlist spot with no charge.
              </p>
              <p>When a spot opens, the family gets a text and a held seat, and claims it in two taps.</p>
              <p>Forms the club sends show up here with a due date. Parents leave notes for coaches and see when their sailor is on the water and who picked them up.</p>
            </>
          ),
        }}
      >
        <Outlet />
      </PhoneShell>
    )
  },
})
