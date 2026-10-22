import { useMemo } from 'react'
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { ClipboardList, Home, MessageSquare, Sailboat } from 'lucide-react'
import { FORM_TEMPLATES, PERSONAS } from '@/data/catalog'
import { familyRegs } from '@/data/hooks'
import { useStore } from '@/data/store'
import { outstandingForms } from '@/domain/rules'
import { PhoneShell } from '@/components/burgee/phone-shell'

export const Route = createFileRoute('/family')({
  component: function FamilyLayout() {
    const cart = useStore((s) => s.cart)
    const regs = useStore((s) => s.registrations)
    const sailors = useStore((s) => s.sailors)
    const submissions = useStore((s) => s.submissions)
    const season = useStore((s) => s.settings.season)
    const { todo, forms } = useMemo(() => {
      const mine = familyRegs(regs, sailors, PERSONAS.familyId)
      const kids = sailors.filter((s) => s.familyId === PERSONAS.familyId)
      return {
        todo: mine.filter((r) => r.status === 'offered' || r.status === 'pending-payment').length,
        forms: kids.reduce((n, k) => n + outstandingForms(k, FORM_TEMPLATES, submissions, season).filter((t) => t.scope === 'sailor').length, 0) +
          (outstandingForms(kids[0], FORM_TEMPLATES, submissions, season).some((t) => t.scope === 'family') ? 1 : 0),
      }
    }, [regs, sailors, submissions, season])
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
            </>
          ),
        }}
      >
        <Outlet />
      </PhoneShell>
    )
  },
})
