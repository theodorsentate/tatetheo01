import { createFileRoute } from '@tanstack/react-router'
import { AdminPrograms } from '@/features/admin/programs'

export const Route = createFileRoute('/admin/programs')({
  component: AdminPrograms,
})
