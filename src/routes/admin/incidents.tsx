import { createFileRoute } from '@tanstack/react-router'
import { AdminIncidents } from '@/features/admin/incidents'

export const Route = createFileRoute('/admin/incidents')({ component: AdminIncidents })
