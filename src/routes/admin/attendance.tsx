import { createFileRoute } from '@tanstack/react-router'
import { AttendanceOverview } from '@/features/admin/attendance-overview'

export const Route = createFileRoute('/admin/attendance')({ component: AttendanceOverview })
