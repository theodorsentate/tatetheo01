import { createFileRoute } from '@tanstack/react-router'
import { CoachHome } from '@/features/coach/coach'

export const Route = createFileRoute('/coach/')({ component: CoachHome })
