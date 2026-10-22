import { createFileRoute } from '@tanstack/react-router'
import { CoachGroup } from '@/features/coach/group'

export const Route = createFileRoute('/coach/groups/$groupId')({
  component: function CoachGroupRoute() {
    const { groupId } = Route.useParams()
    return <CoachGroup key={groupId} groupId={groupId} />
  },
})
