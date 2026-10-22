import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AdminFamilies } from '@/features/admin/families'

export const Route = createFileRoute('/admin/families')({
  validateSearch: z.object({ family: z.string().optional() }),
  component: function FamiliesRoute() {
    const { family } = Route.useSearch()
    return <AdminFamilies familyId={family} />
  },
})
