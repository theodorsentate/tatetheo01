import { createFileRoute } from '@tanstack/react-router'
import { AdminInbox } from '@/features/admin/inbox'

export const Route = createFileRoute('/admin/inbox')({
  component: AdminInbox,
})
