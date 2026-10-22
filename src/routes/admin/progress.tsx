import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AdminProgress } from '@/features/admin/progress'

export const Route = createFileRoute('/admin/progress')({
  validateSearch: z.object({ session: z.string().optional() }),
  component: function ProgressRoute() {
    const { session } = Route.useSearch()
    return <AdminProgress session={session} />
  },
})
