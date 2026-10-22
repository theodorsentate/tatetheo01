import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AdminRegistrations } from '@/features/admin/registrations'

export const Route = createFileRoute('/admin/registrations')({
  validateSearch: z.object({ status: z.string().optional() }),
  component: function RegistrationsRoute() {
    const { status } = Route.useSearch()
    return <AdminRegistrations status={status} />
  },
})
