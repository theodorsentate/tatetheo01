import { createFileRoute } from '@tanstack/react-router'
import { StaffDirectory } from '@/features/admin/staff-directory'

export const Route = createFileRoute('/admin/directory')({ component: StaffDirectory })
