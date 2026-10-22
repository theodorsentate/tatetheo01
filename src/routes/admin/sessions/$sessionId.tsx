import { createFileRoute } from '@tanstack/react-router'
import { SessionDetail } from '@/features/admin/session-detail'

export const Route = createFileRoute('/admin/sessions/$sessionId')({
  component: function SessionRoute() {
    const { sessionId } = Route.useParams()
    return <SessionDetail key={sessionId} sessionId={sessionId} />
  },
})
