import { createFileRoute } from '@tanstack/react-router'
import { FamilyMessages } from '@/features/family/home'

export const Route = createFileRoute('/family/messages')({ component: FamilyMessages })
