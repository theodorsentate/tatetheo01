import { createFileRoute } from '@tanstack/react-router'
import { AdminSettings } from '@/features/admin/settings'

export const Route = createFileRoute('/admin/settings')({
  component: AdminSettings,
})
