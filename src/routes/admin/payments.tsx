import { createFileRoute } from '@tanstack/react-router'
import { AdminPayments } from '@/features/admin/payments'

export const Route = createFileRoute('/admin/payments')({ component: AdminPayments })
