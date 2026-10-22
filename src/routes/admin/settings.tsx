import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { AdminSettings } from '@/features/admin/settings'

export const Route = createFileRoute('/admin/settings')({
  validateSearch: z.object({ tab: z.string().optional() }),
  component: function SettingsRoute() {
    const { tab } = Route.useSearch()
    return <AdminSettings tab={tab} />
  },
})
