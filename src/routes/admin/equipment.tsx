import { createFileRoute } from '@tanstack/react-router'
import { AdminEquipment } from '@/features/admin/equipment'

export const Route = createFileRoute('/admin/equipment')({ component: AdminEquipment })
