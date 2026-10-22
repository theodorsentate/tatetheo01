import { createFileRoute } from '@tanstack/react-router'
import { FamilySchedule } from '@/features/family/schedule'

export const Route = createFileRoute('/family/schedule')({ component: FamilySchedule })
