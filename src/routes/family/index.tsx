import { createFileRoute } from '@tanstack/react-router'
import { FamilyHome } from '@/features/family/home'

export const Route = createFileRoute('/family/')({ component: FamilyHome })
