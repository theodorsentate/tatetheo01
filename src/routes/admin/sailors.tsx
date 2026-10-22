import { createFileRoute } from '@tanstack/react-router'
import { SailorsDirectory } from '@/features/admin/sailors'

export const Route = createFileRoute('/admin/sailors')({ component: SailorsDirectory })
