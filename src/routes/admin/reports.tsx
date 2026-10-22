import { createFileRoute } from '@tanstack/react-router'
import { AdminReports } from '@/features/admin/reports'

export const Route = createFileRoute('/admin/reports')({ component: AdminReports })
