import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AdminDocuments } from '@/features/admin/documents'

export const Route = createFileRoute('/admin/documents')({
  validateSearch: z.object({ person: z.string().optional(), cert: z.string().optional(), tab: z.string().optional() }),
  component: function DocumentsRoute() {
    const { person, cert, tab } = Route.useSearch()
    return <AdminDocuments person={person} cert={cert} tab={tab} />
  },
})
