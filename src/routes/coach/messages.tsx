import { createFileRoute } from '@tanstack/react-router'
import { CoachMessages } from '@/features/coach/coach'

export const Route = createFileRoute('/coach/messages')({ component: CoachMessages })
