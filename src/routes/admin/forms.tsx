import { createFileRoute } from '@tanstack/react-router'
import { AdminForms } from '@/features/admin/forms'

export const Route = createFileRoute('/admin/forms')({
  component: AdminForms,
})
