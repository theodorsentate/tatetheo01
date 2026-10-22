import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AdminMessages } from '@/features/admin/messages'

export const Route = createFileRoute('/admin/messages')({
  validateSearch: z.object({ session: z.string().optional() }),
  component: function MessagesRoute() {
    const { session } = Route.useSearch()
    return <AdminMessages key={session ?? 'all'} sessionId={session} />
  },
})
