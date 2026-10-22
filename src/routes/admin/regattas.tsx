import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AdminRegattas } from '@/features/admin/regattas'

export const Route = createFileRoute('/admin/regattas')({
  validateSearch: z.object({ regatta: z.string().optional() }),
  component: function RegattasRoute() {
    const { regatta } = Route.useSearch()
    return <AdminRegattas regatta={regatta} />
  },
})
