import { createFileRoute } from '@tanstack/react-router'
import { AdminStaff } from '@/features/admin/staff'

export const Route = createFileRoute('/admin/staff')({
  component: AdminStaff,
})
